import { Router } from 'express';
import multer from 'multer';
import { createCreator, createCreatorClip, deleteCreator, getCreators, updateCreator } from '../controllers/creators.controller';
import { creatorListQuerySchema, creatorMutationSchema, creatorClipMutationSchema, creatorParamsSchema } from '../domain/schemas';
import { requireAdmin } from '../middleware/auth';
import { validate } from '../lib/validation';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

const router = Router();

router.get('/', validate({ query: creatorListQuerySchema }), getCreators);
router.post('/', requireAdmin, upload.single('baseImage'), validate({ body: creatorMutationSchema }), createCreator);
router.patch('/:id', requireAdmin, upload.single('baseImage'), validate({ params: creatorParamsSchema, body: creatorMutationSchema.partial() }), updateCreator);
router.delete('/:id', requireAdmin, validate({ params: creatorParamsSchema }), deleteCreator);
router.post('/:id/clips', requireAdmin, upload.single('clip'), validate({ params: creatorParamsSchema, body: creatorClipMutationSchema }), createCreatorClip);

export default router;
