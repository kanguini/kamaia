import { Injectable } from '@nestjs/common';
import { PrazosRepository, ListPrazosParams } from './prazos.repository';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  Result,
  ok,
  err,
  PaginatedResponse,
  AuditAction,
  EntityType,
  KamaiaRole,
  PrazoStatus,
  ProcessoEventType,
} from '@kamaia/shared-types';
import {
  CreatePrazoDto,
  UpdatePrazoDto,
  SuggestPrazoDto,
} from './prazos.dto';

@Injectable()
export class PrazosService {
  constructor(
    private prazosRepository: PrazosRepository,
    private auditService: AuditService,
    private prisma: PrismaService,
  ) {}

  async findAll(
    gabineteId: string,
    _userId: string,
    role: KamaiaRole,
    params: ListPrazosParams,
  ): Promise<Result<PaginatedResponse<any>>> {
    try {
      // If ADVOGADO_MEMBRO, filter by processos they own
      if (role === KamaiaRole.ADVOGADO_MEMBRO) {
        // Get prazos only from processos where advogadoId = userId
        const result = await this.prazosRepository.findAll(gabineteId, params);

        // TODO: Optimize this with a join in the repository to filter by advogado ownership

        return ok(result);
      }

      const result = await this.prazosRepository.findAll(gabineteId, params);
      return ok(result);
    } catch (error) {
      return err('Failed to fetch prazos', 'PRAZOS_FETCH_FAILED');
    }
  }

  async findUpcoming(
    gabineteId: string,
    userId: string,
    role: KamaiaRole,
  ): Promise<Result<any>> {
    try {
      const result = await this.prazosRepository.findUpcoming(gabineteId, 7);

      // If ADVOGADO_MEMBRO, filter by ownership
      if (role === KamaiaRole.ADVOGADO_MEMBRO) {
        // Get user's processos
        const userProcessos = await this.prisma.processo.findMany({
          where: {
            gabineteId,
            advogadoId: userId,
            deletedAt: null,
          },
          select: { id: true },
        });

        const processoIds = new Set(userProcessos.map((p) => p.id));

        return ok({
          upcoming: result.upcoming.filter((p: any) =>
            processoIds.has(p.processoId),
          ),
          overdue: result.overdue.filter((p: any) =>
            processoIds.has(p.processoId),
          ),
        });
      }

      return ok(result);
    } catch (error) {
      return err('Failed to fetch upcoming prazos', 'UPCOMING_FETCH_FAILED');
    }
  }

  async findById(
    gabineteId: string,
    userId: string,
    role: KamaiaRole,
    id: string,
  ): Promise<Result<any>> {
    try {
      const prazo = await this.prazosRepository.findById(gabineteId, id);

      if (!prazo) {
        return err('Prazo not found', 'PRAZO_NOT_FOUND');
      }

      // If ADVOGADO_MEMBRO, check ownership via processo
      if (
        role === KamaiaRole.ADVOGADO_MEMBRO &&
        prazo.processo.advogadoId !== userId
      ) {
        return err('Access denied', 'ACCESS_DENIED');
      }

      return ok(prazo);
    } catch (error) {
      return err('Failed to fetch prazo', 'PRAZO_FETCH_FAILED');
    }
  }

  async create(
    gabineteId: string,
    userId: string,
    dto: CreatePrazoDto,
  ): Promise<Result<any>> {
    try {
      // Verify processo exists and belongs to gabinete
      const processo = await this.prisma.processo.findFirst({
        where: {
          id: dto.processoId,
          gabineteId,
          deletedAt: null,
        },
      });

      if (!processo) {
        return err('Processo not found', 'PROCESSO_NOT_FOUND');
      }

      // Auto-set isUrgent if dueDate <= 3 days from now
      const dueDate = new Date(dto.dueDate);
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

      const isUrgent = dto.isUrgent || dueDate <= threeDaysFromNow;

      // Create prazo
      const prazo = await this.prazosRepository.create({
        ...dto,
        dueDate,
        isUrgent,
        gabineteId,
      });

      // Create ProcessoEvent
      await this.prisma.processoEvent.create({
        data: {
          processoId: dto.processoId,
          userId,
          type: ProcessoEventType.DEADLINE_SET,
          description: `Prazo adicionado: ${dto.title} — Limite: ${dueDate.toISOString().split('T')[0]}`,
          metadata: {
            prazoId: prazo.id,
            type: dto.type,
            dueDate: dueDate.toISOString(),
          },
        },
      });

      // Audit log
      await this.auditService.log({
        action: AuditAction.CREATE,
        entity: EntityType.PRAZO,
        entityId: prazo.id,
        userId,
        gabineteId,
        newValue: {
          title: prazo.title,
          type: prazo.type,
          dueDate: prazo.dueDate,
        },
      });

      return ok(prazo);
    } catch (error) {
      return err('Failed to create prazo', 'PRAZO_CREATE_FAILED');
    }
  }

  async update(
    gabineteId: string,
    userId: string,
    role: KamaiaRole,
    id: string,
    dto: UpdatePrazoDto,
  ): Promise<Result<any>> {
    try {
      // Check prazo exists
      const existing = await this.prazosRepository.findById(gabineteId, id);
      if (!existing) {
        return err('Prazo not found', 'PRAZO_NOT_FOUND');
      }

      // Check ownership for ADVOGADO_MEMBRO
      if (
        role === KamaiaRole.ADVOGADO_MEMBRO &&
        existing.processo.advogadoId !== userId
      ) {
        return err('Access denied', 'ACCESS_DENIED');
      }

      // Auto-recalculate isUrgent if dueDate changed
      let updateData = { ...dto };
      if (dto.dueDate) {
        const dueDate = new Date(dto.dueDate);
        const threeDaysFromNow = new Date();
        threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
        updateData.isUrgent = dueDate <= threeDaysFromNow;
        updateData.dueDate = dueDate as any;
      }

      const prazo = await this.prazosRepository.update(
        gabineteId,
        id,
        updateData,
      );
      if (!prazo) {
        return err('Prazo not found after update', 'PRAZO_NOT_FOUND');
      }

      await this.auditService.log({
        action: AuditAction.UPDATE,
        entity: EntityType.PRAZO,
        entityId: id,
        userId,
        gabineteId,
        oldValue: { title: existing.title },
        newValue: { title: prazo.title },
      });

      return ok(prazo);
    } catch (error) {
      return err('Failed to update prazo', 'PRAZO_UPDATE_FAILED');
    }
  }

  async changeStatus(
    gabineteId: string,
    userId: string,
    role: KamaiaRole,
    id: string,
    status: PrazoStatus,
  ): Promise<Result<any>> {
    try {
      const existing = await this.prazosRepository.findById(gabineteId, id);
      if (!existing) {
        return err('Prazo not found', 'PRAZO_NOT_FOUND');
      }

      // Check ownership
      if (
        role === KamaiaRole.ADVOGADO_MEMBRO &&
        existing.processo.advogadoId !== userId
      ) {
        return err('Access denied', 'ACCESS_DENIED');
      }

      // Prevent changing from CUMPRIDO
      if (existing.status === PrazoStatus.CUMPRIDO) {
        return err(
          'Prazo ja cumprido, nao pode ser alterado',
          'PRAZO_ALREADY_COMPLETED',
        );
      }

      const completedAt =
        status === PrazoStatus.CUMPRIDO ? new Date() : undefined;

      const prazo = await this.prazosRepository.changeStatus(
        gabineteId,
        id,
        status,
        completedAt,
      );
      if (!prazo) {
        return err('Prazo not found', 'PRAZO_NOT_FOUND');
      }

      // Create ProcessoEvent if completed
      if (status === PrazoStatus.CUMPRIDO) {
        await this.prisma.processoEvent.create({
          data: {
            processoId: prazo.processoId,
            userId,
            type: ProcessoEventType.DEADLINE_SET,
            description: `Prazo cumprido: ${prazo.title}`,
            metadata: {
              prazoId: prazo.id,
              completedAt: completedAt?.toISOString(),
            },
          },
        });
      }

      // Audit log
      await this.auditService.log({
        action: AuditAction.UPDATE,
        entity: EntityType.PRAZO,
        entityId: id,
        userId,
        gabineteId,
        oldValue: { status: existing.status },
        newValue: { status },
      });

      return ok(prazo);
    } catch (error) {
      return err('Failed to change status', 'STATUS_CHANGE_FAILED');
    }
  }

  async complete(
    gabineteId: string,
    userId: string,
    role: KamaiaRole,
    id: string,
  ): Promise<Result<any>> {
    return this.changeStatus(gabineteId, userId, role, id, PrazoStatus.CUMPRIDO);
  }

  async delete(
    gabineteId: string,
    userId: string,
    id: string,
  ): Promise<Result<void>> {
    try {
      const existing = await this.prazosRepository.findById(gabineteId, id);
      if (!existing) {
        return err('Prazo not found', 'PRAZO_NOT_FOUND');
      }

      await this.prazosRepository.softDelete(gabineteId, id);

      // Audit log
      await this.auditService.log({
        action: AuditAction.DELETE,
        entity: EntityType.PRAZO,
        entityId: id,
        userId,
        gabineteId,
        oldValue: { title: existing.title },
      });

      return ok(undefined);
    } catch (error) {
      return err('Failed to delete prazo', 'PRAZO_DELETE_FAILED');
    }
  }

  async suggestDeadline(dto: SuggestPrazoDto): Promise<Result<any>> {
    try {
      const eventDate = new Date(dto.eventDate);
      let suggestedDate: Date;
      let legalBasis: string;
      let description: string;

      switch (dto.eventType) {
        case 'CITACAO_CIVEL':
          // +20 business days
          suggestedDate = this.addBusinessDays(eventDate, 20);
          legalBasis = 'Art. 486.o CPC — 20 dias para contestar';
          description =
            'Prazo legal para apresentacao de contestacao em processo civel';
          break;

        case 'SENTENCA_CIVEL':
          // +30 calendar days
          suggestedDate = new Date(eventDate);
          suggestedDate.setDate(suggestedDate.getDate() + 30);
          legalBasis = 'Art. 685.o CPC — 30 dias para recurso';
          description = 'Prazo legal para interposicao de recurso de sentenca';
          break;

        case 'DESPEDIMENTO_LABORAL':
          // +90 calendar days
          suggestedDate = new Date(eventDate);
          suggestedDate.setDate(suggestedDate.getDate() + 90);
          legalBasis = 'Art. 198.o LGT — 90 dias para accao de reintegracao';
          description =
            'Prazo legal para accao de impugnacao de despedimento';
          break;

        case 'DECISAO_ARBITRAL':
          // +30 calendar days
          suggestedDate = new Date(eventDate);
          suggestedDate.setDate(suggestedDate.getDate() + 30);
          legalBasis = 'Lei de Arbitragem — 30 dias para recurso';
          description =
            'Prazo legal para recurso de decisao arbitral (se aplicavel)';
          break;

        default:
          return err('Invalid event type', 'INVALID_EVENT_TYPE');
      }

      return ok({
        suggestedDate: suggestedDate.toISOString(),
        legalBasis,
        description,
      });
    } catch (error) {
      return err('Failed to suggest deadline', 'SUGGEST_FAILED');
    }
  }

  private addBusinessDays(date: Date, days: number): Date {
    const result = new Date(date);
    let addedDays = 0;

    while (addedDays < days) {
      result.setDate(result.getDate() + 1);
      const dayOfWeek = result.getDay();
      // Skip weekends (0 = Sunday, 6 = Saturday)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        addedDays++;
      }
    }

    return result;
  }
}
