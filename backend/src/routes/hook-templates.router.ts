import { Router } from 'express';
import { Prisma, UserRole } from '@prisma/client';
import prisma from '../lib/prisma';
import { ApiError } from '../lib/errors';
import { requireAdmin, requireAuth } from '../lib/auth';
import { validate } from '../lib/validation';
import { z } from 'zod';
import { hookTemplateQuerySchema, hookTemplateSchema, type HookTemplateInput } from '../domain/schemas';

const router = Router();
const hookTemplateIdParamsSchema = z.object({ id: z.string().min(1).max(120) });

const hookTemplatePayload = (body: HookTemplateInput) => ({
  title: body.title.trim(),
  text: body.text.trim(),
  templateType: body.templateType.trim(),
  sceneDurationSeconds: body.sceneDurationSeconds,
  scenes: body.scenes as Prisma.InputJsonValue,
  sortOrder: body.sortOrder,
  isActive: body.isActive,
});

router.use(requireAuth);

router.get('/', validate({ query: hookTemplateQuerySchema }), async (req, res) => {
  const includeInactive = req.query.includeInactive === 'true';
  if (includeInactive && req.auth?.role !== UserRole.ADMIN) {
    throw new ApiError(403, 'FORBIDDEN', 'Administrator access required');
  }
  const templates = await prisma.hookTemplate.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  res.json(templates);
});

router.post('/', requireAdmin, validate({ body: hookTemplateSchema }), async (req, res) => {
  const template = await prisma.hookTemplate.create({ data: hookTemplatePayload(req.body) });
  res.status(201).json(template);
});

router.put('/:id', requireAdmin, validate({ params: hookTemplateIdParamsSchema, body: hookTemplateSchema }), async (req, res) => {
  const template = await prisma.hookTemplate.update({ where: { id: String(req.params.id) }, data: hookTemplatePayload(req.body) });
  res.json(template);
});

router.delete('/:id', requireAdmin, validate({ params: hookTemplateIdParamsSchema }), async (req, res) => {
  await prisma.hookTemplate.delete({ where: { id: String(req.params.id) } });
  res.status(204).end();
});

export default router;
