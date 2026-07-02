import 'dotenv/config';
import { Prisma, PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { defaultHookTemplates } from '../src/domain/defaultHookTemplates';

const prisma = new PrismaClient();
const email = (process.env.SEED_ADMIN_EMAIL ?? 'admin@reelswarm.local').trim().toLowerCase();
const password = process.env.SEED_ADMIN_PASSWORD ?? 'local-admin-password';
if (password.length < 12) throw new Error('SEED_ADMIN_PASSWORD must contain at least 12 characters');

async function main() {
  await prisma.allowedEmail.upsert({ where: { email }, update: {}, create: { email } });
  const admin = await prisma.user.upsert({ where: { email }, update: { role: UserRole.ADMIN, password: await bcrypt.hash(password, 12) }, create: { email, password: await bcrypt.hash(password, 12), name: process.env.SEED_ADMIN_NAME ?? 'Local Admin', role: UserRole.ADMIN } });
  await prisma.campaign.updateMany({ where: { userId: '' }, data: { userId: admin.id } });
  for (const creator of [
    { name: 'Casual Creator', description: 'A young, energetic short-form creator.' },
    { name: 'Professional Expert', description: 'A confident expert in a modern office.' },
    { name: 'Tech Creator', description: 'A high-energy product reviewer.' },
  ]) await prisma.creator.upsert({ where: { id: creator.name.toLowerCase().replace(/ /g, '_') }, update: creator, create: { id: creator.name.toLowerCase().replace(/ /g, '_'), ...creator } });
  for (const template of defaultHookTemplates) {
    const id = template.templateType.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    await prisma.hookTemplate.upsert({
      where: { id },
      update: { ...template, scenes: template.scenes as Prisma.InputJsonValue },
      create: { id, ...template, scenes: template.scenes as Prisma.InputJsonValue },
    });
  }
  console.log(`Seeded admin ${admin.email}`);
}
main().finally(() => prisma.$disconnect());
