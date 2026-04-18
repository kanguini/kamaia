/**
 * Temporary helper: switch a user's email address so Resend (with the
 * shared onboarding@resend.dev sender) can deliver to it. Once a real
 * domain is verified in Resend, switch back via the same script.
 *
 * Usage:
 *   DATABASE_URL=... OLD_EMAIL=... NEW_EMAIL=... \
 *     npx ts-node apps/api/scripts/switch-email.ts
 */
import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  const OLD = process.env.OLD_EMAIL;
  const NEW = process.env.NEW_EMAIL;
  if (!OLD || !NEW) throw new Error('Set OLD_EMAIL and NEW_EMAIL');

  const user = await prisma.user.findFirst({ where: { email: OLD, deletedAt: null } });
  if (!user) {
    console.log(`No user found with email ${OLD}`);
    await prisma.$disconnect();
    return;
  }

  const collision = await prisma.user.findFirst({
    where: { email: NEW, gabineteId: user.gabineteId, deletedAt: null },
  });
  if (collision && collision.id !== user.id) {
    console.log(`Collision: another user in same gabinete already has ${NEW}`);
    await prisma.$disconnect();
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { email: NEW },
  });

  console.log(`✅ User ${user.firstName} ${user.lastName} email switched from ${OLD} to ${NEW}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
