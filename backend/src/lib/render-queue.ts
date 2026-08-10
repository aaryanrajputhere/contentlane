import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
export const renderConnection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
export const renderQueue = new Queue('contentlane-render-reels', { connection: renderConnection });

export interface RenderJobInput {
  projectId: string;
  conceptIds: string[];
  assignments: Array<{ conceptId: string; clipUrl: string; clipId: string; creatorName: string }>;
}
