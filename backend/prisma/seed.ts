import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashPassword, normalizeEmail } from "../src/lib/auth";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim();
  const password = process.env.SEED_ADMIN_PASSWORD?.trim();
  const name = process.env.SEED_ADMIN_NAME?.trim() || "ContentLane Admin";

  if (!email || !password) {
    console.log(
      "Seed skipped: SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are not set.",
    );
    return;
  }

  const normalizedEmail = normalizeEmail(email);

  await prisma.allowedEmail.upsert({
    where: { email: normalizedEmail },
    update: {},
    create: { email: normalizedEmail },
  });

  await prisma.user.upsert({
    where: { email: normalizedEmail },
    update: {
      name,
      role: "ADMIN",
      passwordHash: await hashPassword(password),
    },
    create: {
      email: normalizedEmail,
      name,
      role: "ADMIN",
      passwordHash: await hashPassword(password),
    },
  });

  console.log(`Seeded admin user ${normalizedEmail}`);
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
