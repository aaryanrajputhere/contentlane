import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { login, logout, me, signup } from '../controllers/auth.controller';
import { requireAuth } from '../lib/auth';
import { validate } from '../lib/validation';
import { authSchema, signupSchema } from '../domain/schemas';

const router = Router();
const loginLimit = rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: true, legacyHeaders: false });
router.post('/signup', loginLimit, validate({ body: signupSchema }), signup);
router.post('/login', loginLimit, validate({ body: authSchema }), login);
router.get('/me', requireAuth, me);
router.post('/logout', requireAuth, logout);
export default router;
