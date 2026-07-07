import 'dotenv/config';
import prisma from '../lib/prisma';
import { normalizeEmail } from '../lib/auth';

function usage() {
  console.log('Usage: ts-node src/scripts/allow-email.ts <add|remove|list> [email]');
}

async function main() {
  const command = process.argv[2];
  const rawEmail = process.argv[3];

  if (!command || !['add', 'remove', 'list'].includes(command)) {
    usage();
    process.exitCode = 1;
    return;
  }

  if (command === 'list') {
    const entries = await prisma.allowedEmail.findMany({ orderBy: { email: 'asc' } });
    for (const entry of entries) {
      console.log(entry.email);
    }
    return;
  }

  if (!rawEmail) {
    usage();
    process.exitCode = 1;
    return;
  }

  const email = normalizeEmail(rawEmail);

  if (command === 'add') {
    await prisma.allowedEmail.upsert({
      where: { email },
      update: {},
      create: { email },
    });
    console.log(`Allowed ${email}`);
    return;
  }

  await prisma.allowedEmail.deleteMany({ where: { email } });
  console.log(`Removed ${email}`);
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
