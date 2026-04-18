/**
 * One-off bootstrap script — ensures heldermaiato@outlook.com exists in
 * production and prints either a login password or a reset-token URL so
 * the user can get in without waiting for Resend to be wired up.
 *
 * Run via: railway run -- npx ts-node apps/api/scripts/bootstrap-user.ts
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';

const TARGET_EMAIL = 'heldermaiato@outlook.com';
const FIRST_NAME = 'Helder';
const LAST_NAME = 'Maiato';
const GABINETE_NAME = 'GMS Advogados';
const TEMP_PASSWORD = 'Kamaia@2026!';

async function main() {
  const prisma = new PrismaClient();
  const JWT_SECRET = process.env.JWT_SECRET;
  const FRONTEND_URL = (process.env.FRONTEND_URL ?? 'https://kamaia.vercel.app')
    .split(',')[0]
    .trim();
  if (!JWT_SECRET) throw new Error('JWT_SECRET not in env');

  let user = await prisma.user.findFirst({
    where: { email: TARGET_EMAIL, deletedAt: null },
    include: { gabinete: true },
  });

  if (!user) {
    // Create fresh gabinete + user
    console.log(`Creating new gabinete + user for ${TARGET_EMAIL}...`);
    const gabinete = await prisma.gabinete.create({
      data: { name: GABINETE_NAME, plan: 'PRO_BUSINESS', isActive: true },
    });
    const passwordHash = await bcrypt.hash(TEMP_PASSWORD, 12);
    user = await prisma.user.create({
      data: {
        gabineteId: gabinete.id,
        email: TARGET_EMAIL,
        passwordHash,
        firstName: FIRST_NAME,
        lastName: LAST_NAME,
        role: 'SOCIO_GESTOR',
        isActive: true,
        provider: 'credentials',
      },
      include: { gabinete: true },
    });
    // Seed a usage quota so IA quota endpoint works
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    await prisma.usageQuota.upsert({
      where: { gabineteId: gabinete.id },
      update: {},
      create: {
        gabineteId: gabinete.id,
        periodStart: now,
        periodEnd: nextMonth,
        aiQueriesUsed: 0,
      },
    });
    console.log('\n✅ User created.\n');
    console.log(`   Email:    ${TARGET_EMAIL}`);
    console.log(`   Password: ${TEMP_PASSWORD}`);
    console.log(`   Role:     SOCIO_GESTOR`);
    console.log(`   Gabinete: ${gabinete.name}`);
    console.log(`\n   Login at: ${FRONTEND_URL}/login`);
  } else {
    // Already exists — reset password to the temp value AND issue a reset
    // token URL (either method lets the user in)
    const passwordHash = await bcrypt.hash(TEMP_PASSWORD, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, isActive: true },
    });
    await prisma.userSession.deleteMany({ where: { userId: user.id } });

    const resetToken = jwt.sign(
      { sub: user.id, purpose: 'password-reset' },
      JWT_SECRET,
      { expiresIn: '24h' },
    );
    const resetUrl = `${FRONTEND_URL}/reset-password?token=${encodeURIComponent(resetToken)}`;

    console.log(`\n✅ User already exists — reset applied.\n`);
    console.log(`   Email:    ${TARGET_EMAIL}`);
    console.log(`   Password: ${TEMP_PASSWORD}  (troca no primeiro login)`);
    console.log(`   Gabinete: ${user.gabinete.name}`);
    console.log(`   Role:     ${user.role}`);
    console.log(`\n   Option 1 — Login direto:`);
    console.log(`   ${FRONTEND_URL}/login`);
    console.log(`\n   Option 2 — Reset via token (24h válido):`);
    console.log(`   ${resetUrl}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Bootstrap failed:', e);
  process.exit(1);
});
