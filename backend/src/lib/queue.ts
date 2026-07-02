import { Queue } from 'bullmq';
import { redis } from './redis';

export const generationQueue = new Queue('generation', { connection: redis });
