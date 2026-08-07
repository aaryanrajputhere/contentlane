import type { RequestHandler } from 'express';
import type { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { normalizeEmail } from '../lib/auth';
import { ApiError } from '../lib/errors';
import { resolveOptionalUser } from '../middleware/auth';
import { supportIdParamsSchema, supportListQuerySchema, supportRequestSchema, supportUpdateSchema } from '../domain/schemas';

const supportSelect = {
  id: true, email: true, message: true, userId: true, status: true,
  createdAt: true, updatedAt: true, resolvedAt: true,
  user: { select: { id: true, name: true, email: true } },
} satisfies Prisma.SupportRequestSelect;

async function findSupportRequest(id: string) {
  const request = await prisma.supportRequest.findUnique({ where: { id }, select: supportSelect });
  if (!request) throw new ApiError(404, 'NOT_FOUND', 'Support request not found');
  return request;
}

export const createSupportRequest: RequestHandler = async (req, res) => {
  const input = supportRequestSchema.parse(req.body);
  if (input.website.trim()) {
    res.status(201).json({ accepted: true });
    return;
  }
  const user = await resolveOptionalUser(req);
  const request = await prisma.supportRequest.create({
    data: {
      email: user?.email ?? normalizeEmail(input.email),
      message: input.message,
      userId: user?.id ?? null,
    },
    select: { id: true, status: true, createdAt: true },
  });
  res.status(201).json({ accepted: true, request });
};

export const listSupportRequests: RequestHandler = async (req, res) => {
  const { search, status, page, pageSize } = supportListQuerySchema.parse(req.query);
  const where: Prisma.SupportRequestWhereInput = {
    ...(status ? { status } : {}),
    ...(search ? { OR: [
      { email: { contains: search, mode: 'insensitive' } },
      { message: { contains: search, mode: 'insensitive' } },
      { user: { name: { contains: search, mode: 'insensitive' } } },
    ] } : {}),
  };
  const [requests, total, grouped] = await prisma.$transaction([
    prisma.supportRequest.findMany({ where, select: supportSelect, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.supportRequest.count({ where }),
    prisma.supportRequest.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);
  const counts = { NEW: 0, OPEN: 0, RESOLVED: 0 };
  grouped.forEach((item) => { counts[item.status] = item._count._all; });
  res.json({ requests, counts, pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } });
};

export const getSupportRequest: RequestHandler = async (req, res) => {
  const { id } = supportIdParamsSchema.parse(req.params);
  const existing = await findSupportRequest(id);
  if (existing.status !== 'NEW') {
    res.json({ request: existing });
    return;
  }
  const request = await prisma.supportRequest.update({ where: { id }, data: { status: 'OPEN' }, select: supportSelect });
  res.json({ request });
};

export const updateSupportRequest: RequestHandler = async (req, res) => {
  const { id } = supportIdParamsSchema.parse(req.params);
  const { status } = supportUpdateSchema.parse(req.body);
  await findSupportRequest(id);
  const request = await prisma.supportRequest.update({
    where: { id },
    data: { status, resolvedAt: status === 'RESOLVED' ? new Date() : null },
    select: supportSelect,
  });
  res.json({ request });
};
