import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import { config } from '../config';
import prisma from './prisma';
import { ApiError } from './errors';

export const AUTH_COOKIE = 'reelswarm_session';

export const signSession = (userId: string) => jwt.sign({ sub: userId }, config.JWT_SECRET, { expiresIn: '7d' });

export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const token = req.cookies?.[AUTH_COOKIE] as string | undefined;
    if (!token) throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication required');
    const payload = jwt.verify(token, config.JWT_SECRET);
    const userId = typeof payload === 'object' ? payload.sub : undefined;
    if (typeof userId !== 'string') throw new ApiError(401, 'UNAUTHENTICATED', 'Invalid session');
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, role: true } });
    if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Invalid session');
    req.auth = { userId: user.id, email: user.email, role: user.role };
    next();
  } catch (error) {
    next(error instanceof ApiError ? error : new ApiError(401, 'UNAUTHENTICATED', 'Invalid or expired session'));
  }
};

export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (req.auth?.role !== UserRole.ADMIN) return next(new ApiError(403, 'FORBIDDEN', 'Administrator access required'));
  next();
};
