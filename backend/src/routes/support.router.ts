import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { createSupportRequest } from '../controllers/support.controller';
import { validate } from '../lib/validation';
import { supportRequestSchema } from '../domain/schemas';

const router = Router();
const supportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many support requests. Try again in 15 minutes.' } },
});
router.post('/', supportLimiter, validate({ body: supportRequestSchema }), createSupportRequest);
export default router;
