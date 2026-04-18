import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../src/modules/prisma/prisma.service';

export type KamaiaRoleName =
  | 'SOCIO_GESTOR'
  | 'ADVOGADO_SOLO'
  | 'ADVOGADO_MEMBRO'
  | 'ESTAGIARIO';

export interface TestUserFixture {
  id: string;
  email: string;
  password: string;
  gabineteId: string;
  role: KamaiaRoleName;
  accessToken: string;
}

/**
 * Unique tag appended to every entity created by the fixture so parallel
 * tests don't collide in a shared database.
 */
function tag(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

/**
 * Seeds a fresh gabinete + user and returns a signed JWT ready to use
 * as a Bearer token. Caller is responsible for cleanup via `cleanupGabinete`.
 */
export async function seedGabineteWithUser(
  app: INestApplication,
  opts: { role?: KamaiaRoleName; password?: string } = {},
): Promise<TestUserFixture> {
  const prisma = app.get(PrismaService);
  const jwt = app.get(JwtService);

  const role = opts.role ?? 'SOCIO_GESTOR';
  const password = opts.password ?? 'Test@12345';
  const passwordHash = await bcrypt.hash(password, 10);

  const gabineteName = tag('Gabinete');
  const gabinete = await prisma.gabinete.create({
    data: {
      name: gabineteName,
      plan: 'PRO_BUSINESS',
      isActive: true,
    },
  });

  const userId = randomUUID();
  const email = `${tag('user')}@test.kamaia.local`;
  const user = await prisma.user.create({
    data: {
      id: userId,
      gabineteId: gabinete.id,
      email,
      passwordHash,
      firstName: 'Test',
      lastName: 'User',
      role,
      isActive: true,
      provider: 'credentials',
    },
  });

  const accessToken = jwt.sign({
    sub: user.id,
    gabineteId: gabinete.id,
    role,
    email: user.email,
  });

  return {
    id: user.id,
    email,
    password,
    gabineteId: gabinete.id,
    role,
    accessToken,
  };
}

/**
 * Best-effort cleanup of all records owned by a test gabinete.
 * Order matters: delete child rows before gabinete.
 */
export async function cleanupGabinete(
  prisma: PrismaService,
  gabineteId: string,
): Promise<void> {
  const where = { gabineteId };
  // Deletions are wrapped in try/catch so a missing model doesn't tank the suite.
  const safeDeleteMany = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch {
      /* noop */
    }
  };

  await safeDeleteMany(() => prisma.projectMilestone.deleteMany({ where: { project: { gabineteId } } }));
  await safeDeleteMany(() => prisma.projectMember.deleteMany({ where: { project: { gabineteId } } }));
  await safeDeleteMany(() => prisma.project.deleteMany({ where }));
  await safeDeleteMany(() => prisma.processoStageInstance.deleteMany({ where: { processo: { gabineteId } } }));
  await safeDeleteMany(() => prisma.workflowStage.deleteMany({ where: { workflow: { gabineteId } } }));
  await safeDeleteMany(() => prisma.workflow.deleteMany({ where }));
  await safeDeleteMany(() => prisma.notification.deleteMany({ where }));
  await safeDeleteMany(() => prisma.taskComment.deleteMany({ where: { task: { gabineteId } } }));
  await safeDeleteMany(() => prisma.task.deleteMany({ where }));
  await safeDeleteMany(() => prisma.taskColumn.deleteMany({ where }));
  await safeDeleteMany(() => prisma.timeEntry.deleteMany({ where }));
  await safeDeleteMany(() => prisma.expense.deleteMany({ where }));
  await safeDeleteMany(() => prisma.clienteInteraction.deleteMany({ where }));
  await safeDeleteMany(() => prisma.calendarEvent.deleteMany({ where }));
  await safeDeleteMany(() => prisma.document.deleteMany({ where }));
  await safeDeleteMany(() => prisma.prazo.deleteMany({ where }));
  await safeDeleteMany(() => prisma.processoEvent.deleteMany({ where: { processo: { gabineteId } } }));
  await safeDeleteMany(() => prisma.processo.deleteMany({ where }));
  await safeDeleteMany(() => prisma.cliente.deleteMany({ where }));
  await safeDeleteMany(() => prisma.aIConversation.deleteMany({ where }));
  await safeDeleteMany(() => prisma.auditLog.deleteMany({ where }));
  await safeDeleteMany(() => prisma.userSession.deleteMany({ where: { user: { gabineteId } } }));
  await safeDeleteMany(() => prisma.notificationPreference.deleteMany({ where: { user: { gabineteId } } }));
  await safeDeleteMany(() => prisma.pushSubscription.deleteMany({ where: { user: { gabineteId } } }));
  await safeDeleteMany(() => prisma.user.deleteMany({ where }));
  await safeDeleteMany(() => prisma.usageQuota.deleteMany({ where }));
  await safeDeleteMany(() => prisma.subscription.deleteMany({ where }));
  await safeDeleteMany(() => prisma.gabinete.delete({ where: { id: gabineteId } }));
}
