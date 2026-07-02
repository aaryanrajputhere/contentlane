import bcrypt from 'bcryptjs';
import type { RequestHandler } from 'express';
import prisma from '../lib/prisma';
import { ApiError } from '../lib/errors';
import { AUTH_COOKIE, signSession } from '../lib/auth';
import { config } from '../config';

const cookieOptions = { httpOnly: true, sameSite: 'lax' as const, secure: config.NODE_ENV === 'production', path: '/', maxAge: 7 * 24 * 60 * 60 * 1000 };
const publicUser = (user: { id: string; email: string; name: string | null; role: string }) => ({ id: user.id, email: user.email, name: user.name, role: user.role });

export const signup: RequestHandler = async (req, res) => {
  const { email, password, name } = req.body;
  const allowed = await prisma.allowedEmail.findUnique({ where: { email } });
  if (!allowed) throw new ApiError(403, 'EMAIL_NOT_ALLOWED', 'This email is not enabled for the private beta');
  if (await prisma.user.findUnique({ where: { email } })) throw new ApiError(409, 'EMAIL_IN_USE', 'An account already exists for this email');
  const user = await prisma.user.create({ data: { email, password: await bcrypt.hash(password, 12), name } });
  res.cookie(AUTH_COOKIE, signSession(user.id), cookieOptions).status(201).json({ user: publicUser(user) });
};

export const login: RequestHandler = async (req, res) => {
  const user = await prisma.user.findUnique({ where: { email: req.body.email } });
  if (!user || !await bcrypt.compare(req.body.password, user.password)) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  res.cookie(AUTH_COOKIE, signSession(user.id), cookieOptions).json({ user: publicUser(user) });
};

export const me: RequestHandler = async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Invalid session');
  res.json({ user: publicUser(user) });
};

export const logout: RequestHandler = (_req, res) => { res.clearCookie(AUTH_COOKIE, { ...cookieOptions, maxAge: undefined }).status(204).end(); };
