import { Router } from 'express';
import { getJob } from '../controllers/projects.controller';
import { jobIdParamsSchema } from '../domain/schemas';
import { validate } from '../lib/validation';

const router = Router();
router.get('/:id', validate({ params: jobIdParamsSchema }), getJob);
export default router;
