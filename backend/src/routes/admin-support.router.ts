import { Router } from 'express';
import { getSupportRequest, listSupportRequests, updateSupportRequest } from '../controllers/support.controller';
import { validate } from '../lib/validation';
import { requireAdmin } from '../middleware/auth';
import { supportIdParamsSchema, supportListQuerySchema, supportUpdateSchema } from '../domain/schemas';

const router = Router();
router.use(requireAdmin);
router.get('/', validate({ query: supportListQuerySchema }), listSupportRequests);
router.get('/:id', validate({ params: supportIdParamsSchema }), getSupportRequest);
router.patch('/:id', validate({ params: supportIdParamsSchema, body: supportUpdateSchema }), updateSupportRequest);
export default router;
