import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  try {
    const existing = await prisma.project.findFirst();
    if (!existing) { console.log("no project"); return; }
    console.log("Found project:", existing.id);
    await prisma.project.delete({ where: { id: existing.id } });
    console.log("Deleted successfully");
  } catch (e) {
    console.error("Error:", e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
