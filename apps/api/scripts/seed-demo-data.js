/**
 * Demo data seeder — populates an existing gabinete with realistic
 * inter-connected records so the app feels alive. Idempotent: only adds,
 * never deletes. Run via:
 *   railway ssh --service kamaia -- sh -c "cd /app/apps/api && node scripts/seed-demo-data.js [email]"
 *
 * For each processo in the gabinete, seeds:
 *   - 6 timesheets spread across the last 30 days (billable + non-billable mix)
 *   - 2 expenses (court fees + copies)
 *   - 1 upcoming prazo + 1 overdue prazo (missing)
 *   - 2 tasks on the Kanban (one TODO, one in-progress)
 *   - 1 calendar event
 *
 * Also creates 1 project linked to the largest cliente, and 1 invoice
 * aggregating the billable timesheets of the last 30 days for 1 cliente.
 */

const { PrismaClient } = require('@prisma/client');

const TARGET_EMAIL = process.argv[2] || 'kanguinimaiato32@gmail.com';

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  const prisma = new PrismaClient();
  const user = await prisma.user.findFirst({
    where: { email: TARGET_EMAIL, deletedAt: null },
    include: { gabinete: true },
  });
  if (!user) {
    console.log(`No user ${TARGET_EMAIL}`);
    await prisma.$disconnect();
    return;
  }
  const gabineteId = user.gabineteId;

  const processos = await prisma.processo.findMany({
    where: { gabineteId, deletedAt: null },
    include: { cliente: true },
  });

  console.log(`Seeding demo data for ${processos.length} processos in ${user.gabinete.name}...`);

  const categoriesTime = ['PESQUISA', 'REDACCAO', 'AUDIENCIA', 'REUNIAO', 'DESLOCACAO'];
  const categoriesExpense = ['EMOLUMENTOS', 'DESLOCACAO', 'COPIAS', 'HONORARIOS_PERITOS'];

  const now = new Date();
  const results = {
    timesheets: 0,
    expenses: 0,
    prazos: 0,
    tasks: 0,
    calendarEvents: 0,
    projects: 0,
    invoices: 0,
  };

  // Ensure at least one task column exists
  let column = await prisma.taskColumn.findFirst({
    where: { gabineteId },
    orderBy: { position: 'asc' },
  });
  if (!column) {
    column = await prisma.taskColumn.create({
      data: { gabineteId, title: 'Por Fazer', position: 0, color: '#3B82F6' },
    });
  }
  let inProgressCol = await prisma.taskColumn.findFirst({
    where: { gabineteId, title: { contains: 'Curso', mode: 'insensitive' } },
  });
  if (!inProgressCol) {
    inProgressCol = await prisma.taskColumn.create({
      data: { gabineteId, title: 'Em Curso', position: 1, color: '#F59E0B' },
    });
  }

  for (const processo of processos) {
    // ── Timesheets (6 per processo) ───────────────────────
    for (let i = 0; i < 6; i++) {
      const daysBack = Math.floor(Math.random() * 30);
      const date = new Date(now);
      date.setDate(date.getDate() - daysBack);
      date.setHours(0, 0, 0, 0);
      const category = pickRandom(categoriesTime);
      const duration = [30, 45, 60, 75, 90, 120, 180][Math.floor(Math.random() * 7)];
      const billable = Math.random() > 0.25;
      await prisma.timeEntry.create({
        data: {
          gabineteId,
          processoId: processo.id,
          userId: user.id,
          category,
          description: `${category.toLowerCase()} sobre ${processo.title.slice(0, 40)}`,
          date,
          durationMinutes: duration,
          billable,
          hourlyRate: billable ? processo.feeAmount ?? 12_000_00 : null,
        },
      });
      results.timesheets++;
    }

    // ── Expenses (2 per processo) ────────────────────────
    for (let i = 0; i < 2; i++) {
      const daysBack = Math.floor(Math.random() * 30);
      const date = new Date(now);
      date.setDate(date.getDate() - daysBack);
      date.setHours(0, 0, 0, 0);
      const category = pickRandom(categoriesExpense);
      const amount = [2_500_00, 5_000_00, 8_000_00, 12_000_00, 18_000_00][Math.floor(Math.random() * 5)];
      await prisma.expense.create({
        data: {
          gabineteId,
          processoId: processo.id,
          userId: user.id,
          category,
          description:
            category === 'EMOLUMENTOS'
              ? 'Taxa de justiça'
              : category === 'DESLOCACAO'
              ? 'Deslocação ao tribunal'
              : category === 'COPIAS'
              ? 'Fotocópias e autenticações'
              : 'Honorários de peritos',
          amount,
          date,
        },
      });
      results.expenses++;
    }

    // ── Prazos (1 upcoming + 1 overdue) ──────────────────
    const upcomingDue = new Date(now);
    upcomingDue.setDate(upcomingDue.getDate() + 5 + Math.floor(Math.random() * 10));
    await prisma.prazo.create({
      data: {
        gabineteId,
        processoId: processo.id,
        title: 'Contestação',
        description: 'Prazo para apresentar contestação',
        type: 'CONTESTACAO',
        dueDate: upcomingDue,
        alertHoursBefore: 48,
        status: 'PENDENTE',
      },
    });
    results.prazos++;

    const overdueDue = new Date(now);
    overdueDue.setDate(overdueDue.getDate() - (2 + Math.floor(Math.random() * 5)));
    await prisma.prazo.create({
      data: {
        gabineteId,
        processoId: processo.id,
        title: 'Resposta a excepções',
        type: 'RESPOSTA',
        dueDate: overdueDue,
        alertHoursBefore: 48,
        status: 'PENDENTE',
      },
    });
    results.prazos++;

    // ── Tasks (1 TODO + 1 in progress) ────────────────────
    const taskCount = await prisma.task.count({ where: { columnId: column.id } });
    await prisma.task.create({
      data: {
        gabineteId,
        columnId: column.id,
        title: `Rever documentos — ${processo.processoNumber}`,
        description: 'Verificar procuração e petição inicial',
        priority: 'ALTA',
        position: taskCount,
        createdById: user.id,
        assigneeId: user.id,
        processoId: processo.id,
        clienteId: processo.clienteId,
      },
    });
    results.tasks++;

    const inProgCount = await prisma.task.count({ where: { columnId: inProgressCol.id } });
    await prisma.task.create({
      data: {
        gabineteId,
        columnId: inProgressCol.id,
        title: `Preparar audiência — ${processo.processoNumber}`,
        priority: 'MEDIA',
        position: inProgCount,
        createdById: user.id,
        assigneeId: user.id,
        processoId: processo.id,
        clienteId: processo.clienteId,
      },
    });
    results.tasks++;

    // ── Calendar event (1 per processo) ───────────────────
    const eventDate = new Date(now);
    eventDate.setDate(eventDate.getDate() + 3 + Math.floor(Math.random() * 14));
    eventDate.setHours(10, 0, 0, 0);
    const endEvent = new Date(eventDate);
    endEvent.setHours(11, 30, 0, 0);
    await prisma.calendarEvent.create({
      data: {
        gabineteId,
        userId: user.id,
        processoId: processo.id,
        title: `Reunião ${processo.cliente.name}`,
        type: 'REUNIAO',
        startAt: eventDate,
        endAt: endEvent,
        description: `Preparação do processo ${processo.processoNumber}`,
        location: 'Escritório',
        allDay: false,
      },
    });
    results.calendarEvents++;
  }

  // ── Project linking the largest cliente ────────────────
  const clientes = await prisma.cliente.findMany({
    where: { gabineteId, deletedAt: null },
    include: { processos: { where: { deletedAt: null } } },
  });
  const topCliente = clientes.sort((a, b) => b.processos.length - a.processos.length)[0];
  if (topCliente && topCliente.processos.length > 0) {
    const existingProject = await prisma.project.findFirst({
      where: { gabineteId, clienteId: topCliente.id, name: { contains: 'Demo', mode: 'insensitive' } },
    });
    if (!existingProject) {
      const projCode = `DEMO-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')}`;
      const project = await prisma.project.create({
        data: {
          gabineteId,
          clienteId: topCliente.id,
          managerId: user.id,
          code: projCode,
          name: `Demo · Carteira ${topCliente.name}`,
          category: 'LITIGIO',
          status: 'ACTIVO',
          healthStatus: 'YELLOW',
          scope: `Gestão integrada dos processos activos de ${topCliente.name}.`,
          startDate: new Date(now.getFullYear(), now.getMonth() - 1, 1),
          endDate: new Date(now.getFullYear(), now.getMonth() + 3, 1),
          budgetAmount: 2_500_000_00,
        },
      });
      // Link this cliente's processos to the project
      await prisma.processo.updateMany({
        where: { id: { in: topCliente.processos.map((p) => p.id) } },
        data: { projectId: project.id },
      });
      // Add 3 milestones
      const msStart = project.startDate;
      await prisma.projectMilestone.createMany({
        data: [
          {
            projectId: project.id,
            title: 'Revisão de contestações',
            startDate: msStart,
            dueDate: new Date(msStart.getTime() + 20 * 86_400_000),
            position: 0,
            progress: 100,
            completedAt: new Date(msStart.getTime() + 15 * 86_400_000),
          },
          {
            projectId: project.id,
            title: 'Preparação audiências',
            startDate: new Date(msStart.getTime() + 20 * 86_400_000),
            dueDate: new Date(msStart.getTime() + 60 * 86_400_000),
            position: 1,
            progress: 45,
          },
          {
            projectId: project.id,
            title: 'Alegações finais',
            startDate: new Date(msStart.getTime() + 60 * 86_400_000),
            dueDate: new Date(msStart.getTime() + 120 * 86_400_000),
            position: 2,
            progress: 0,
          },
        ],
      });
      await prisma.projectMember.upsert({
        where: { projectId_userId: { projectId: project.id, userId: user.id } },
        create: {
          projectId: project.id,
          userId: user.id,
          role: 'ACCOUNTABLE',
          allocationPct: 40,
          hourlyRate: 15_000_00,
        },
        update: {},
      });
      results.projects++;
    }
  }

  // ── Invoice from some billable timesheets ──────────────
  if (topCliente && topCliente.processos.length > 0) {
    const firstProcesso = topCliente.processos[0];
    const unbilledTimes = await prisma.timeEntry.findMany({
      where: {
        gabineteId,
        processoId: firstProcesso.id,
        billable: true,
        invoiceId: null,
        deletedAt: null,
      },
      take: 4,
    });
    if (unbilledTimes.length >= 2) {
      const year = now.getFullYear();
      const count = await prisma.invoice.count({
        where: { gabineteId, number: { startsWith: `${year}/` } },
      });
      const number = `${year}/${String(count + 1).padStart(4, '0')}`;
      const subtotal = unbilledTimes.reduce((s, t) => {
        const rate = t.hourlyRate ?? firstProcesso.feeAmount ?? 12_000_00;
        return s + Math.round((t.durationMinutes / 60) * rate);
      }, 0);
      const taxAmount = Math.round(subtotal * 0.14);
      const invoice = await prisma.invoice.create({
        data: {
          gabineteId,
          clienteId: topCliente.id,
          processoId: firstProcesso.id,
          number,
          status: 'SENT',
          sentAt: new Date(),
          dueDate: new Date(now.getTime() + 30 * 86_400_000),
          taxRate: 14,
          subtotal,
          taxAmount,
          total: subtotal + taxAmount,
          notes: 'Serviços jurídicos prestados.',
          createdById: user.id,
          items: {
            create: unbilledTimes.map((t, i) => {
              const rate = t.hourlyRate ?? firstProcesso.feeAmount ?? 12_000_00;
              const hours = t.durationMinutes / 60;
              return {
                kind: 'TIME',
                description: `${firstProcesso.title.slice(0, 40)} — ${t.description ?? t.category}`,
                quantity: Number(hours.toFixed(2)),
                unitPrice: rate,
                total: Math.round(hours * rate),
                sourceId: t.id,
                position: i,
              };
            }),
          },
        },
      });
      await prisma.timeEntry.updateMany({
        where: { id: { in: unbilledTimes.map((t) => t.id) } },
        data: { invoiceId: invoice.id },
      });
      results.invoices++;
    }
  }

  console.log('\n✅ Seed complete:', results);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
