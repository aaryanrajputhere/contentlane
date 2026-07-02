import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { ApiError } from '../lib/errors';
import { requireAdmin, requireAuth } from '../lib/auth';
import { validate } from '../lib/validation';
import { uploadBufferToCloudinary } from '../services/providers';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
const creatorIdParamsSchema = z.object({ id: z.string().min(1).max(100) });
const creatorSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
});
const creatorPayload = (body: z.infer<typeof creatorSchema>) => ({
  name: body.name.trim(),
  description: body.description?.trim() ? body.description.trim() : null,
  imageUrl: body.imageUrl ?? null,
});

router.use(requireAuth);
router.get('/', async (_req, res) => res.json(await prisma.creator.findMany({ orderBy: { createdAt: 'desc' } })));
router.post('/upload', requireAdmin, upload.single('image'), async (req, res) => {
  if (!req.file) throw new ApiError(400, 'BAD_REQUEST', 'Image file is required');
  if (!req.file.mimetype.startsWith('image/')) throw new ApiError(400, 'BAD_REQUEST', 'Only image files are supported');
  const imageUrl = await uploadBufferToCloudinary(req.file.buffer, 'image', 'reelswarm_creators');
  res.status(201).json({ imageUrl });
});
router.post('/', requireAdmin, validate({ body: creatorSchema }), async (req, res) => res.status(201).json(await prisma.creator.create({ data: creatorPayload(req.body) })));
router.put('/:id', requireAdmin, validate({ params: creatorIdParamsSchema, body: creatorSchema }), async (req, res) => {
  const creator = await prisma.creator.update({ where: { id: String(req.params.id) }, data: creatorPayload(req.body) });
  res.json(creator);
});
router.delete('/:id', requireAdmin, validate({ params: creatorIdParamsSchema }), async (req, res) => { await prisma.creator.delete({ where: { id: String(req.params.id) } }); res.status(204).end(); });
export default router;
