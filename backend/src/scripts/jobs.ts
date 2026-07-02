import 'dotenv/config';
import prisma from '../lib/prisma';
import { generationQueue } from '../lib/queue';

async function main() {
  const [action, id] = process.argv.slice(2);
  if (action === 'failed') console.table(await prisma.generationJob.findMany({ where: { status: 'FAILED' }, select: { id: true, type: true, errorCode: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 50 }));
  else if (action === 'retry' && id) {
    const job = await prisma.generationJob.update({ where: { id }, data: { status: 'QUEUED', errorCode: null, errorMessage: null, progress: 0, progressMessage: 'Queued for retry' } });
    await generationQueue.add(job.type, { generationJobId: job.id }, { jobId: `${job.id}-retry-${Date.now()}`, attempts: 3, backoff: { type: 'exponential', delay: 2000 } });
    console.log(`Retried ${job.id}`);
  } else throw new Error('Usage: jobs.ts failed | jobs.ts retry <job-id>');
}
main().finally(async () => { await generationQueue.close(); await prisma.$disconnect(); });
