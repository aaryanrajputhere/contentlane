import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { randomUUID } from 'node:crypto';
import { config } from './config';
import { errorHandler, notFound } from './lib/errors';
import { logger } from './lib/logger';
import { requireAuth } from './middleware/auth';
import authRouter from './routes/auth.router';
import projectsRouter from './routes/projects.router';
import jobsRouter from './routes/jobs.router';
import creatorsRouter from './routes/creators.router';
import clipsRouter from './routes/clips.router';

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
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.get('/health/live', (_req, res) => res.json({ status: 'ok' }));
  app.get('/health/ready', async (_req, res) => res.json({ status: 'ready' }));
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/projects', requireAuth, projectsRouter);
  app.use('/api/v1/jobs', requireAuth, jobsRouter);
  app.use('/api/v1/creators', requireAuth, creatorsRouter);
  app.use('/api/v1/clips', requireAuth, clipsRouter);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

export default createApp();
