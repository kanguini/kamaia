import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Result, ok, err } from '@kamaia/shared-types';

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Populates an existing gabinete with demo data linked to every active
 * processo. This was originally a standalone script — now also exposed
 * as an endpoint (/seed/demo-data) so users can re-seed their sandbox
 * from Configurações without SSH access.
 */
@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(private prisma: PrismaService) {}

  async seedDemoDataForGabinete(
    gabineteId: string,
    userId: string,
  ): Promise<Result<Record<string, number>>> {
    try {
      const processos = await this.prisma.processo.findMany({
        where: { gabineteId, deletedAt: null },
        include: { cliente: true },
      });

      const results = {
        timesheets: 0,
        expenses: 0,
        prazos: 0,
        tasks: 0,
        calendarEvents: 0,
        projects: 0,
        invoices: 0,
      };

      const timeCats = ['PESQUISA', 'REDACCAO', 'AUDIENCIA', 'REUNIAO', 'DESLOCACAO'];
      const expCats = ['EMOLUMENTOS', 'DESLOCACAO', 'COPIAS', 'HONORARIOS_PERITOS'];
      const now = new Date();

      // Ensure two baseline columns
      let todoCol = await this.prisma.taskColumn.findFirst({
        where: { gabineteId, position: 0 },
      });
      if (!todoCol) {
        todoCol = await this.prisma.taskColumn.create({
          data: { gabineteId, title: 'Por Fazer', position: 0, color: '#3B82F6' },
        });
      }
      let inProgressCol = await this.prisma.taskColumn.findFirst({
        where: { gabineteId, title: { contains: 'Curso', mode: 'insensitive' } },
      });
      if (!inProgressCol) {
        inProgressCol = await this.prisma.taskColumn.create({
          data: { gabineteId, title: 'Em Curso', position: 1, color: '#F59E0B' },
        });
      }

      for (const p of processos) {
        // 6 timesheets
        for (let i = 0; i < 6; i++) {
          const d = new Date(now);
          d.setDate(d.getDate() - Math.floor(Math.random() * 30));
          d.setHours(0, 0, 0, 0);
          const category = pick(timeCats);
          const duration = pick([30, 45, 60, 75, 90, 120, 180]);
          const billable = Math.random() > 0.25;
          await this.prisma.timeEntry.create({
            data: {
              gabineteId,
              processoId: p.id,
              userId,
              category,
              description: `${category.toLowerCase()} sobre ${p.title.slice(0, 40)}`,
              date: d,
              durationMinutes: duration,
              billable,
              hourlyRate: billable ? p.feeAmount ?? 12_000_00 : null,
            },
          });
          results.timesheets++;
        }

        // 2 expenses
        for (let i = 0; i < 2; i++) {
          const d = new Date(now);
          d.setDate(d.getDate() - Math.floor(Math.random() * 30));
          d.setHours(0, 0, 0, 0);
          const category = pick(expCats);
          await this.prisma.expense.create({
            data: {
              gabineteId,
              processoId: p.id,
              userId,
              category,
              description:
                category === 'EMOLUMENTOS'
                  ? 'Taxa de justiça'
                  : category === 'DESLOCACAO'
                    ? 'Deslocação ao tribunal'
                    : category === 'COPIAS'
                      ? 'Fotocópias e autenticações'
                      : 'Honorários de peritos',
              amount: pick([2_500_00, 5_000_00, 8_000_00, 12_000_00, 18_000_00]),
              date: d,
            },
          });
          results.expenses++;
        }

        // 1 upcoming + 1 overdue prazo
        const up = new Date(now);
        up.setDate(up.getDate() + 5 + Math.floor(Math.random() * 10));
        await this.prisma.prazo.create({
          data: {
            gabineteId,
            processoId: p.id,
            title: 'Contestação',
            type: 'CONTESTACAO',
            dueDate: up,
            alertHoursBefore: 48,
            status: 'PENDENTE',
          },
        });
        const over = new Date(now);
        over.setDate(over.getDate() - (2 + Math.floor(Math.random() * 5)));
        await this.prisma.prazo.create({
          data: {
            gabineteId,
            processoId: p.id,
            title: 'Resposta a excepções',
            type: 'RESPOSTA',
            dueDate: over,
            alertHoursBefore: 48,
            status: 'PENDENTE',
          },
        });
        results.prazos += 2;

        // 2 tasks
        const n1 = await this.prisma.task.count({ where: { columnId: todoCol.id } });
        await this.prisma.task.create({
          data: {
            gabineteId,
            columnId: todoCol.id,
            title: `Rever documentos — ${p.processoNumber}`,
            priority: 'ALTA',
            position: n1,
            createdById: userId,
            assigneeId: userId,
            processoId: p.id,
            clienteId: p.clienteId,
          },
        });
        const n2 = await this.prisma.task.count({ where: { columnId: inProgressCol.id } });
        await this.prisma.task.create({
          data: {
            gabineteId,
            columnId: inProgressCol.id,
            title: `Preparar audiência — ${p.processoNumber}`,
            priority: 'MEDIA',
            position: n2,
            createdById: userId,
            assigneeId: userId,
            processoId: p.id,
            clienteId: p.clienteId,
          },
        });
        results.tasks += 2;

        // 1 calendar event
        const ev = new Date(now);
        ev.setDate(ev.getDate() + 3 + Math.floor(Math.random() * 14));
        ev.setHours(10, 0, 0, 0);
        const evEnd = new Date(ev);
        evEnd.setHours(11, 30, 0, 0);
        await this.prisma.calendarEvent.create({
          data: {
            gabineteId,
            userId,
            processoId: p.id,
            title: `Reunião ${p.cliente.name}`,
            type: 'REUNIAO',
            startAt: ev,
            endAt: evEnd,
            description: `Preparação do processo ${p.processoNumber}`,
            location: 'Escritório',
            allDay: false,
          },
        });
        results.calendarEvents++;
      }

      return ok(results);
    } catch (e) {
      this.logger.error(`Seed demo failed: ${(e as Error).message}`, e as Error);
      return err('Seed demo failed', 'SEED_FAILED');
    }
  }
}
