import { Router } from 'express';
import { deleteCreatorClip, updateCreatorClip } from '../controllers/creators.controller';
import { creatorClipParamsSchema, creatorClipUpdateSchema } from '../domain/schemas';
import { requireAdmin } from '../middleware/auth';
import { validate } from '../lib/validation';

const router = Router();

router.patch('/:clipId', requireAdmin, validate({ params: creatorClipParamsSchema, body: creatorClipUpdateSchema }), updateCreatorClip);
router.delete('/:clipId', requireAdmin, validate({ params: creatorClipParamsSchema }), deleteCreatorClip);

export default router;
