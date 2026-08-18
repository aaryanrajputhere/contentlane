import type { RequestHandler } from 'express';
import type { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { ApiError } from '../lib/errors';
import { adminListQuerySchema, adminIdParamsSchema } from '../domain/schemas';

const userSelect = {
  id: true, name: true, email: true, role: true, createdAt: true, updatedAt: true,
  _count: { select: { projects: true, supportRequests: true, subscriptions: true } },
} satisfies Prisma.UserSelect;

const projectSelect = {
  id: true, website: true, normalizedWebsite: true, status: true, createdAt: true, updatedAt: true,
  user: { select: { id: true, name: true, email: true } },
  _count: { select: { concepts: true, mediaAssets: true, jobs: true } },
} satisfies Prisma.ProjectSelect;

function pagination(page: number, pageSize: number, total: number) {
  return { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export const getAdminOverview: RequestHandler = async (_req, res) => {
  const [users, projects, jobs, subscriptions, projectStatuses, jobStatuses, recentUsers, recentProjects, recentJobs] = await prisma.$transaction([
    prisma.user.count(),
    prisma.project.count(),
    prisma.generationJob.count(),
    prisma.subscription.count({ where: { status: { in: ['active', 'Active', 'ACTIVE'] } } }),
    prisma.project.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.generationJob.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.user.findMany({ select: userSelect, orderBy: { createdAt: 'desc' }, take: 6 }),
    prisma.project.findMany({ select: projectSelect, orderBy: { updatedAt: 'desc' }, take: 6 }),
    prisma.generationJob.findMany({
      select: { id: true, type: true, status: true, progress: true, errorMessage: true, createdAt: true, updatedAt: true, project: { select: { id: true, website: true, user: { select: { email: true } } } } },
      orderBy: { updatedAt: 'desc' }, take: 8,
    }),
  ]);

  res.json({
    metrics: { users, projects, jobs, activeSubscriptions: subscriptions },
    projectStatuses: Object.fromEntries(projectStatuses.map((item) => [item.status, item._count._all])),
    jobStatuses: Object.fromEntries(jobStatuses.map((item) => [item.status, item._count._all])),
    recentUsers, recentProjects, recentJobs,
  });
};

export const listAdminUsers: RequestHandler = async (req, res) => {
  const { search, page, pageSize } = adminListQuerySchema.parse(req.query);
  const where: Prisma.UserWhereInput = search ? {
    OR: [
      { email: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
      { id: { contains: search, mode: 'insensitive' } },
    ],
  } : {};
  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({ where, select: userSelect, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.user.count({ where }),
  ]);
  res.json({ users, pagination: pagination(page, pageSize, total) });
};

export const getAdminUser: RequestHandler = async (req, res) => {
  const { id } = adminIdParamsSchema.parse(req.params);
  const user = await prisma.user.findUnique({
    where: { id }, select: {
      ...userSelect,
      projects: { select: projectSelect, orderBy: { updatedAt: 'desc' } },
      subscriptions: { orderBy: { updatedAt: 'desc' }, take: 10 },
      supportRequests: { orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, email: true, message: true, status: true, createdAt: true, updatedAt: true } },
    },
  });
  if (!user) throw new ApiError(404, 'NOT_FOUND', 'User not found');
  res.json({ user });
};

export const listAdminProjects: RequestHandler = async (req, res) => {
  const { search, status, page, pageSize } = adminListQuerySchema.parse(req.query);
  const where: Prisma.ProjectWhereInput = {
    ...(status ? { status: status as Prisma.ProjectWhereInput['status'] } : {}),
    ...(search ? { OR: [
      { website: { contains: search, mode: 'insensitive' } },
      { normalizedWebsite: { contains: search, mode: 'insensitive' } },
      { user: { email: { contains: search, mode: 'insensitive' } } },
      { user: { name: { contains: search, mode: 'insensitive' } } },
    ] } : {}),
  };
  const [projects, total] = await prisma.$transaction([
    prisma.project.findMany({ where, select: projectSelect, orderBy: { updatedAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.project.count({ where }),
  ]);
  res.json({ projects, pagination: pagination(page, pageSize, total) });
};

export const getAdminProject: RequestHandler = async (req, res) => {
  const { id } = adminIdParamsSchema.parse(req.params);
  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      ...projectSelect,
      brandProfile: true,
      websiteAnalysis: { select: { id: true, sourceUrl: true, rootDomain: true, sourceContentFingerprint: true, createdAt: true, updatedAt: true } },
      concepts: { orderBy: { sortOrder: 'asc' }, select: { id: true, angle: true, hookText: true, score: true, scoreLabel: true, reviewDecision: true, sortOrder: true, createdAt: true, updatedAt: true } },
      mediaAssets: { orderBy: { createdAt: 'desc' }, select: { id: true, conceptId: true, type: true, provider: true, url: true, mimeType: true, createdAt: true } },
      exportState: { select: { id: true, settings: true, createdAt: true, updatedAt: true } },
      jobs: { orderBy: { createdAt: 'desc' }, select: { id: true, type: true, status: true, progress: true, progressMessage: true, errorMessage: true, createdAt: true, updatedAt: true } },
    },
  });
  if (!project) throw new ApiError(404, 'NOT_FOUND', 'Project not found');
  res.json({ project });
};

export const listAdminJobs: RequestHandler = async (req, res) => {
  const { search, status, page, pageSize } = adminListQuerySchema.parse(req.query);
  const where: Prisma.GenerationJobWhereInput = {
    ...(status ? { status: status as Prisma.GenerationJobWhereInput['status'] } : {}),
    ...(search ? { project: { OR: [
      { website: { contains: search, mode: 'insensitive' } },
      { user: { email: { contains: search, mode: 'insensitive' } } },
    ] } } : {}),
  };
  const [jobs, total] = await prisma.$transaction([
    prisma.generationJob.findMany({ where, orderBy: { updatedAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize, select: { id: true, projectId: true, type: true, status: true, progress: true, progressMessage: true, errorMessage: true, createdAt: true, updatedAt: true, project: { select: { website: true, user: { select: { email: true } } } } } }),
    prisma.generationJob.count({ where }),
  ]);
  res.json({ jobs, pagination: pagination(page, pageSize, total) });
};
