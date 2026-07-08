import { Router } from 'express';
import { login, logout, me, signup } from '../controllers/auth.controller';
import { loginSchema, signupSchema } from '../domain/schemas';
import { requireAuth } from '../middleware/auth';
import { validate } from '../lib/validation';

const router = Router();

router.post('/signup', validate({ body: signupSchema }), signup);
router.post('/login', validate({ body: loginSchema }), login);
router.post('/logout', logout);
router.get('/me', requireAuth, me);

export default router;
