import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { config } from './config';
import prisma from './lib/prisma';
import { redis } from './lib/redis';
import { logger } from './lib/logger';
import { errorHandler, notFound } from './lib/errors';
import apiRouter from './routes/api.router';
import authRouter from './routes/auth.router';
import creatorsRouter from './routes/creators.router';
import hookTemplatesRouter from './routes/hook-templates.router';
import { generationQueue } from './lib/queue';
import { requireAdmin, requireAuth } from './lib/auth';

const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => { req.requestId = req.header('x-request-id') ?? randomUUID(); res.setHeader('x-request-id', req.requestId); next(); });
app.use(pinoHttp({ logger, customProps: req => ({ requestId: req.requestId, userId: req.auth?.userId }) }));
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: config.FRONTEND_URL, credentials: true, methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use('/api', rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false }));

app.get('/health/live', (_req, res) => res.json({ status: 'ok' }));
app.get('/health/ready', async (_req, res) => {
  try { await prisma.$queryRaw`SELECT 1`; if (await redis.ping() !== 'PONG') throw new Error('Redis unavailable'); res.json({ status: 'ready' }); }
  catch { res.status(503).json({ status: 'not_ready' }); }
});
app.use('/api/v1/auth', authRouter);
app.use('/api/v1', apiRouter);
app.use('/api/v1/creators', creatorsRouter);
app.use('/api/v1/hook-templates', hookTemplatesRouter);
if (config.NODE_ENV === 'development') {
  const dashboard = new ExpressAdapter();
  dashboard.setBasePath('/admin/queues');
  createBullBoard({ queues: [new BullMQAdapter(generationQueue)], serverAdapter: dashboard });
  app.use('/admin/queues', requireAuth, requireAdmin, dashboard.getRouter());
}
app.use(notFound);
app.use(errorHandler);

const server = app.listen(config.PORT, () => logger.info({ port: config.PORT, providerMode: config.AI_PROVIDER_MODE }, 'ReelSwarm API started'));
async function shutdown(signal: string) {
  logger.info({ signal }, 'API shutting down');
  server.close(async () => { await redis.quit(); await prisma.$disconnect(); process.exit(0); });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
