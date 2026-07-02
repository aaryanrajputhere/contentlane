import 'dotenv/config';
import prisma from '../lib/prisma';

async function main() {
  const [action, rawEmail] = process.argv.slice(2);
  const email = rawEmail?.trim().toLowerCase();
  if (!email || !email.includes('@')) throw new Error('Usage: npm run allow-email -- tester@example.com');
  if (action === 'add') await prisma.allowedEmail.upsert({ where: { email }, update: {}, create: { email } });
  else if (action === 'remove') await prisma.allowedEmail.deleteMany({ where: { email } });
  else throw new Error('Unknown action');
  console.log(`${action === 'add' ? 'Allowed' : 'Removed'} ${email}`);
}
main().finally(() => prisma.$disconnect());
