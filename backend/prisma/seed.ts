import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashPassword, normalizeEmail } from "../src/lib/auth";

const prisma = new PrismaClient();

async function seedUser({
  email,
  password,
  name,
  role,
}: {
  email: string;
  password: string;
  name: string;
  role: "ADMIN" | "USER";
}) {
  const normalizedEmail = normalizeEmail(email);
  const passwordHash = await hashPassword(password);

  await prisma.allowedEmail.upsert({
    where: { email: normalizedEmail },
    update: {},
    create: { email: normalizedEmail },
  });

  await prisma.user.upsert({
    where: { email: normalizedEmail },
    update: {
      name,
      role,
      passwordHash,
    },
    create: {
      email: normalizedEmail,
      name,
      role,
      passwordHash,
    },
  });

  console.log(`Seeded ${role.toLowerCase()} user ${normalizedEmail}`);
}

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD?.trim();
  const adminName = process.env.SEED_ADMIN_NAME?.trim() || "ContentLane Admin";

  if (!adminEmail || !adminPassword) {
    console.log(
      "Seed skipped: SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are not set.",
    );
  } else {
    await seedUser({
      email: adminEmail,
      password: adminPassword,
      name: adminName,
      role: "ADMIN",
    });
  }

  const testEmail = process.env.SEED_TEST_USER_EMAIL?.trim();
  const testPassword = process.env.SEED_TEST_USER_PASSWORD?.trim();
  const testName = process.env.SEED_TEST_USER_NAME?.trim() || "Test User";

  if (testEmail && testPassword) {
    await seedUser({
      email: testEmail,
      password: testPassword,
      name: testName,
      role: "USER",
    });
  }
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
