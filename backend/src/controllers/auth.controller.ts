import type { RequestHandler } from 'express';
import prisma from '../lib/prisma';
import { clearSessionCookie, hashPassword, normalizeEmail, setSessionCookie, toAuthUser, verifyPassword } from '../lib/auth';
import { ApiError } from '../lib/errors';
import { loginSchema, signupSchema } from '../domain/schemas';

export const signup: RequestHandler = async (req, res) => {
  const { email, password, name } = signupSchema.parse(req.body);
  const normalizedEmail = normalizeEmail(email);

  const [allowedEmail, existingUser] = await Promise.all([
    prisma.allowedEmail.findUnique({ where: { email: normalizedEmail } }),
    prisma.user.findUnique({ where: { email: normalizedEmail } }),
  ]);

  if (!allowedEmail) throw new ApiError(403, 'EMAIL_NOT_ALLOWED', 'This email is not approved for the beta yet');
  if (existingUser) throw new ApiError(409, 'ACCOUNT_EXISTS', 'An account already exists for this email');

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash: await hashPassword(password),
      name: name?.trim() || null,
    },
    select: { id: true, email: true, name: true, role: true },
  });

  const authUser = toAuthUser(user);
  setSessionCookie(res, authUser);
  res.status(201).json({ user: authUser });
};

export const login: RequestHandler = async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const normalizedEmail = normalizeEmail(email);
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password');
  }

  const authUser = toAuthUser(user);
  setSessionCookie(res, authUser);
  res.json({ user: authUser });
};

export const logout: RequestHandler = async (_req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
};

export const me: RequestHandler = async (req, res) => {
  if (!req.user) throw new ApiError(401, 'AUTH_REQUIRED', 'Sign in to continue');
  res.json({ user: req.user });
};
