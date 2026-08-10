import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { randomUUID } from 'node:crypto';
import { clerkMiddleware } from '@clerk/express';
import { config } from './config';
import { errorHandler, notFound } from './lib/errors';
import { logger } from './lib/logger';
import { requireAuth } from './middleware/auth';
import authRouter from './routes/auth.router';
import projectsRouter from './routes/projects.router';
import jobsRouter from './routes/jobs.router';
import creatorsRouter from './routes/creators.router';
import clipsRouter from './routes/clips.router';
import billingRouter from './routes/billing.router';
import { handleDodoWebhook } from './controllers/dodo-webhook.controller';
import { requireSubscription } from './middleware/subscription';
import supportRouter from './routes/support.router';
import adminSupportRouter from './routes/admin-support.router';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    req.requestId = req.header('x-request-id') ?? randomUUID();
    res.setHeader('x-request-id', req.requestId);
    next();
  });
  app.use(pinoHttp({ logger, autoLogging: false, customProps: (req) => ({ requestId: req.requestId }) }));
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({
    origin: [
      config.FRONTEND_URL,
      "https://contentlane.vercel.app",
      "https://contentlane-aaryanrajputheres-projects.vercel.app",
      "https://contentlane-git-main-aaryanrajputheres-projects.vercel.app",
    ],
    credentials: true,
  }));
  app.post('/api/v1/webhooks/dodo', express.raw({ type: 'application/json', limit: '1mb' }), handleDodoWebhook);
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  if (config.NODE_ENV !== 'test') app.use(clerkMiddleware());
  app.get('/health/live', (_req, res) => res.json({ status: 'ok' }));
  app.get('/health/ready', async (_req, res) => res.json({ status: 'ready' }));
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/support', supportRouter);
  app.use('/api/v1/admin/support', adminSupportRouter);
  app.use('/api/v1/billing', requireAuth, billingRouter);
  app.use('/api/v1/projects', requireAuth, requireSubscription, projectsRouter);
  app.use('/api/v1/jobs', requireAuth, requireSubscription, jobsRouter);
  app.use('/api/v1/creators', requireAuth, requireSubscription, creatorsRouter);
  app.use('/api/v1/clips', requireAuth, requireSubscription, clipsRouter);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

export default createApp();
