import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('[Kamaia Seed] Starting...');

  // ── Gabinete ────────────────────────────────────────────
  const gabinete = await prisma.gabinete.upsert({
    where: { nif: '5417865000' },
    update: {},
    create: {
      name: 'Escritorio Dr. Carlos & Associados',
      nif: '5417865000',
      address: 'Rua Major Kanhangulo, 45, Luanda',
      phone: '+244 923 456 789',
      email: 'geral@drcarlos.ao',
      plan: 'PRO_BUSINESS',
      isActive: true,
    },
  });

  console.log(`[Seed] Gabinete: ${gabinete.name} (${gabinete.id})`);

  // ─�� Users ──────��────────────────────────────────────────
  const passwordHash = await bcrypt.hash('Kamaia2026!', 12);

  const socio = await prisma.user.upsert({
    where: {
      provider_providerId: { provider: 'credentials', providerId: 'seed-socio' },
    },
    update: {},
    create: {
      gabineteId: gabinete.id,
      email: 'socio@kamaia.dev',
      passwordHash,
      firstName: 'Carlos',
      lastName: 'Mendes',
      role: 'SOCIO_GESTOR',
      oaaNumber: 'OAA-2015-1234',
      specialty: 'Direito Laboral e Civel',
      phone: '+244 923 456 789',
      provider: 'credentials',
      providerId: 'seed-socio',
    },
  });

  const advogado = await prisma.user.upsert({
    where: {
      provider_providerId: { provider: 'credentials', providerId: 'seed-advogado' },
    },
    update: {},
    create: {
      gabineteId: gabinete.id,
      email: 'advogado@kamaia.dev',
      passwordHash,
      firstName: 'Maria',
      lastName: 'Santos',
      role: 'ADVOGADO_MEMBRO',
      oaaNumber: 'OAA-2020-5678',
      specialty: 'Direito Comercial',
      phone: '+244 912 345 678',
      provider: 'credentials',
      providerId: 'seed-advogado',
    },
  });

  const estagiario = await prisma.user.upsert({
    where: {
      provider_providerId: { provider: 'credentials', providerId: 'seed-estagiario' },
    },
    update: {},
    create: {
      gabineteId: gabinete.id,
      email: 'estagiario@kamaia.dev',
      passwordHash,
      firstName: 'Tiago',
      lastName: 'Ferreira',
      role: 'ESTAGIARIO',
      oaaNumber: 'OAA-2025-9012',
      specialty: 'Direito Penal',
      provider: 'credentials',
      providerId: 'seed-estagiario',
    },
  });

  console.log(`[Seed] Users: ${socio.firstName}, ${advogado.firstName}, ${estagiario.firstName}`);

  // ── Clientes ────────────────────────────────────────────
  const cliente1 = await prisma.cliente.upsert({
    where: {
      gabineteId_nif: { gabineteId: gabinete.id, nif: '5400123456' },
    },
    update: {},
    create: {
      gabineteId: gabinete.id,
      advogadoId: socio.id,
      type: 'INDIVIDUAL',
      name: 'Joao Silva',
      nif: '5400123456',
      email: 'joao.silva@email.ao',
      phone: '+244 945 678 901',
      address: 'Bairro Ingombotas, Luanda',
      notes: 'Cliente desde 2024. Caso laboral em curso.',
    },
  });

  const cliente2 = await prisma.cliente.upsert({
    where: {
      gabineteId_nif: { gabineteId: gabinete.id, nif: '5400789012' },
    },
    update: {},
    create: {
      gabineteId: gabinete.id,
      advogadoId: advogado.id,
      type: 'EMPRESA',
      name: 'Sonangol Distribuidora, SA',
      nif: '5400789012',
      email: 'juridico@sonangol.co.ao',
      phone: '+244 222 345 678',
      address: 'Av. 1.o Congresso do MPLA, Luanda',
      notes: 'Contrato de assessoria juridica permanente.',
    },
  });

  console.log(`[Seed] Clientes: ${cliente1.name}, ${cliente2.name}`);

  // ── Processos ────────────��──────────────────────────────
  const processo1 = await prisma.processo.upsert({
    where: {
      gabineteId_processoNumber: { gabineteId: gabinete.id, processoNumber: 'PROC-2026-0001' },
    },
    update: {},
    create: {
      gabineteId: gabinete.id,
      clienteId: cliente1.id,
      advogadoId: socio.id,
      processoNumber: 'PROC-2026-0001',
      title: 'Joao Silva vs. TechAngola, Lda — Despedimento Ilicito',
      description: 'Accao laboral por despedimento sem justa causa. Cliente foi despedido apos 5 anos de servico sem processo disciplinar.',
      type: 'LABORAL',
      status: 'ACTIVO',
      stage: 'Audiencia de Conciliacao',
      court: 'Tribunal Provincial do Trabalho de Luanda',
      courtCaseNumber: 'TPT-LDA-2026-04521',
      judge: 'Dr. Manuel Domingos',
      opposingParty: 'TechAngola, Lda',
      opposingLawyer: 'Dr. Pedro Neto',
      priority: 'ALTA',
      feeType: 'FIXO',
      feeAmount: 50000000, // 500,000 AKZ in centavos
    },
  });

  const processo2 = await prisma.processo.upsert({
    where: {
      gabineteId_processoNumber: { gabineteId: gabinete.id, processoNumber: 'PROC-2026-0002' },
    },
    update: {},
    create: {
      gabineteId: gabinete.id,
      clienteId: cliente2.id,
      advogadoId: advogado.id,
      processoNumber: 'PROC-2026-0002',
      title: 'Sonangol vs. Fornecedor Y — Incumprimento Contratual',
      description: 'Accao comercial por incumprimento de contrato de fornecimento de equipamento.',
      type: 'COMERCIAL',
      status: 'ACTIVO',
      stage: 'Peticao',
      court: 'Tribunal Provincial de Luanda — Sala do Civel',
      priority: 'MEDIA',
      feeType: 'HORA',
      feeAmount: 2500000, // 25,000 AKZ/hora in centavos
    },
  });

  const processo3 = await prisma.processo.upsert({
    where: {
      gabineteId_processoNumber: { gabineteId: gabinete.id, processoNumber: 'PROC-2026-0003' },
    },
    update: {},
    create: {
      gabineteId: gabinete.id,
      clienteId: cliente1.id,
      advogadoId: socio.id,
      processoNumber: 'PROC-2026-0003',
      title: 'Joao Silva — Divorcio Litigioso',
      description: 'Processo de divorcio litigioso com partilha de bens.',
      type: 'FAMILIA',
      status: 'ACTIVO',
      stage: 'Peticao',
      court: 'Tribunal Provincial de Luanda — Sala da Familia',
      priority: 'MEDIA',
      feeType: 'FIXO',
      feeAmount: 30000000, // 300,000 AKZ
    },
  });

  console.log(`[Seed] Processos: ${processo1.processoNumber}, ${processo2.processoNumber}, ${processo3.processoNumber}`);

  // ── Prazos ───────���──────────────────────────────────────
  const now = new Date();
  const inDays = (d: number) => new Date(now.getTime() + d * 24 * 60 * 60 * 1000);

  await prisma.prazo.createMany({
    data: [
      {
        gabineteId: gabinete.id,
        processoId: processo1.id,
        title: 'Audiencia de Conciliacao',
        description: 'Comparecer no Tribunal Provincial do Trabalho de Luanda as 10h.',
        type: 'AUDIENCIA',
        dueDate: inDays(3),
        alertHoursBefore: 48,
        status: 'PENDENTE',
        isUrgent: true,
      },
      {
        gabineteId: gabinete.id,
        processoId: processo1.id,
        title: 'Preparar documentacao para audiencia',
        description: 'Reunir contrato de trabalho, recibos de vencimento, comunicacao de despedimento.',
        type: 'OUTRO',
        dueDate: inDays(2),
        alertHoursBefore: 24,
        status: 'PENDENTE',
        isUrgent: true,
      },
      {
        gabineteId: gabinete.id,
        processoId: processo2.id,
        title: 'Prazo para entrega da peticao inicial',
        description: 'Submeter peticao inicial no tribunal civel.',
        type: 'CONTESTACAO',
        dueDate: inDays(10),
        alertHoursBefore: 72,
        status: 'PENDENTE',
        isUrgent: false,
      },
      {
        gabineteId: gabinete.id,
        processoId: processo3.id,
        title: 'Reuniao com cliente — divorcio',
        description: 'Discutir estrategia processual e documentacao necessaria.',
        type: 'OUTRO',
        dueDate: inDays(5),
        alertHoursBefore: 24,
        status: 'PENDENTE',
        isUrgent: false,
      },
      {
        gabineteId: gabinete.id,
        processoId: processo2.id,
        title: 'Prazo para recurso — decisao cautelar',
        description: 'Recurso da decisao cautelar proferida em 15/03/2026.',
        type: 'RECURSO',
        dueDate: inDays(1),
        alertHoursBefore: 24,
        status: 'PENDENTE',
        isUrgent: true,
      },
    ],
    skipDuplicates: true,
  });

  console.log('[Seed] 5 Prazos created');

  // ── Calendar Events ─────────────────────────────────────
  await prisma.calendarEvent.createMany({
    data: [
      {
        gabineteId: gabinete.id,
        userId: socio.id,
        processoId: processo1.id,
        title: 'Audiencia de Conciliacao — Caso Silva',
        type: 'AUDIENCIA',
        location: 'Tribunal Provincial do Trabalho, Sala 3',
        startAt: inDays(3),
        endAt: new Date(inDays(3).getTime() + 2 * 60 * 60 * 1000), // +2h
        allDay: false,
        reminderMinutes: 120,
      },
      {
        gabineteId: gabinete.id,
        userId: socio.id,
        title: 'Reuniao com Equipa',
        type: 'REUNIAO',
        location: 'Escritorio — Sala de Reunioes',
        startAt: inDays(1),
        endAt: new Date(inDays(1).getTime() + 60 * 60 * 1000), // +1h
        allDay: false,
        reminderMinutes: 30,
      },
      {
        gabineteId: gabinete.id,
        userId: advogado.id,
        processoId: processo2.id,
        title: 'Diligencia — Registo Comercial',
        type: 'DILIGENCIA',
        location: 'Conservatoria do Registo Comercial de Luanda',
        startAt: inDays(5),
        endAt: new Date(inDays(5).getTime() + 3 * 60 * 60 * 1000), // +3h
        allDay: false,
      },
      {
        gabineteId: gabinete.id,
        userId: socio.id,
        title: 'Formacao — Novo Codigo Processo Civil',
        type: 'OUTRO',
        startAt: inDays(7),
        endAt: inDays(7),
        allDay: true,
      },
      {
        gabineteId: gabinete.id,
        userId: advogado.id,
        processoId: processo3.id,
        title: 'Reuniao com cliente — divorcio',
        type: 'REUNIAO',
        location: 'Escritorio',
        startAt: inDays(2),
        endAt: new Date(inDays(2).getTime() + 90 * 60 * 1000), // +1.5h
        allDay: false,
        reminderMinutes: 60,
      },
    ],
    skipDuplicates: true,
  });

  console.log('[Seed] 5 Calendar events created');

  // ── AI Conversations ─────────────────────────────────────
  const aiConversation = await prisma.aIConversation.create({
    data: {
      gabineteId: gabinete.id,
      userId: socio.id,
      title: 'Prazo para contestacao civel',
      context: 'GERAL',
    },
  });

  await prisma.aIMessage.createMany({
    data: [
      {
        conversationId: aiConversation.id,
        role: 'user',
        content: 'Qual e o prazo para contestar uma accao ordinaria civel em Angola?',
        tokenCount: 15,
      },
      {
        conversationId: aiConversation.id,
        role: 'assistant',
        content: 'De acordo com o Codigo de Processo Civil angolano (Art. 486.o), o prazo para apresentar contestacao numa accao ordinaria civel e de 20 dias uteis a contar da data da citacao.\n\n_Nota: Esta e uma resposta simulada._',
        tokenCount: 45,
        model: 'mock-v1',
      },
      {
        conversationId: aiConversation.id,
        role: 'user',
        content: 'E se o reu estiver no estrangeiro?',
        tokenCount: 8,
      },
      {
        conversationId: aiConversation.id,
        role: 'assistant',
        content: 'Quando o reu se encontra no estrangeiro, o prazo para contestacao pode ser alargado, dependendo do metodo de citacao utilizado. A citacao edital ou por via diplomatica pode implicar prazos adicionais.\n\n_Nota: Esta e uma resposta simulada._',
        tokenCount: 40,
        model: 'mock-v1',
      },
    ],
  });

  console.log('[Seed] AI conversation created with 4 messages');

  // ── Time Entries ──────────────────────────────────────────
  await prisma.timeEntry.createMany({
    data: [
      {
        gabineteId: gabinete.id,
        processoId: processo1.id,
        userId: socio.id,
        category: 'AUDIENCIA',
        description: 'Audiencia de conciliacao no tribunal',
        date: inDays(-2),
        durationMinutes: 120,
        billable: true,
      },
      {
        gabineteId: gabinete.id,
        processoId: processo1.id,
        userId: socio.id,
        category: 'PESQUISA',
        description: 'Pesquisa jurisprudencia laboral',
        date: inDays(-3),
        durationMinutes: 180,
        billable: true,
      },
      {
        gabineteId: gabinete.id,
        processoId: processo2.id,
        userId: advogado.id,
        category: 'REDACCAO',
        description: 'Redaccao de peticao inicial',
        date: inDays(-1),
        durationMinutes: 240,
        billable: true,
      },
      {
        gabineteId: gabinete.id,
        processoId: processo1.id,
        userId: socio.id,
        category: 'REUNIAO',
        description: 'Reuniao com cliente',
        date: inDays(-4),
        durationMinutes: 60,
        billable: true,
      },
      {
        gabineteId: gabinete.id,
        processoId: processo3.id,
        userId: socio.id,
        category: 'DESLOCACAO',
        description: 'Deslocacao ao conservatoria',
        date: inDays(-1),
        durationMinutes: 90,
        billable: false,
      },
    ],
    skipDuplicates: true,
  });
  console.log('[Seed] 5 Time entries created');

  // ── Expenses ──────────────────────────────────────────────
  await prisma.expense.createMany({
    data: [
      {
        gabineteId: gabinete.id,
        processoId: processo1.id,
        userId: socio.id,
        category: 'EMOLUMENTOS',
        description: 'Emolumentos judiciais',
        amount: 2500000,
        date: inDays(-5),
      },
      {
        gabineteId: gabinete.id,
        processoId: processo2.id,
        userId: advogado.id,
        category: 'COPIAS',
        description: 'Copias certificadas',
        amount: 150000,
        date: inDays(-2),
      },
      {
        gabineteId: gabinete.id,
        processoId: processo1.id,
        userId: socio.id,
        category: 'DESLOCACAO',
        description: 'Transporte ao tribunal',
        amount: 500000,
        date: inDays(-2),
      },
    ],
    skipDuplicates: true,
  });
  console.log('[Seed] 3 Expenses created');

  // ── Usage Quota ─────────────────────────────────────────
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  await prisma.usageQuota.upsert({
    where: { gabineteId: gabinete.id },
    update: {},
    create: {
      gabineteId: gabinete.id,
      aiQueriesUsed: 3,
      docAnalysesUsed: 0,
      storageUsedBytes: BigInt(0),
      periodStart,
      periodEnd,
    },
  });

  console.log('[Seed] Usage quota created');

  // ── Notification Preferences ─────────────────────────────
  await prisma.notificationPreference.createMany({
    data: [
      {
        userId: socio.id,
        emailEnabled: true,
        pushEnabled: true,
        smsEnabled: true,
        smsOnlyUrgent: true,
      },
      {
        userId: advogado.id,
        emailEnabled: true,
        pushEnabled: true,
        smsEnabled: false,
        smsOnlyUrgent: true,
      },
      {
        userId: estagiario.id,
        emailEnabled: true,
        pushEnabled: false,
        smsEnabled: false,
        smsOnlyUrgent: true,
      },
    ],
    skipDuplicates: true,
  });
  console.log('[Seed] 3 Notification preferences created');

  console.log('[Kamaia Seed] Done!');
  console.log('');
  console.log('Login credentials:');
  console.log('  socio@kamaia.dev     / Kamaia2026!  (SOCIO_GESTOR)');
  console.log('  advogado@kamaia.dev  / Kamaia2026!  (ADVOGADO_MEMBRO)');
  console.log('  estagiario@kamaia.dev / Kamaia2026! (ESTAGIARIO)');
}

main()
  .catch((e) => {
    console.error('[Seed Error]', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
