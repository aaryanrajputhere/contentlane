import type { RequestHandler } from 'express';
import prisma from '../lib/prisma';
import { verifySession } from '../lib/auth';
import { ApiError } from '../lib/errors';
import { config } from '../config';

async function resolveAuthenticatedUser(req: Express.Request) {
  if (req.user) return req.user;
  const token = (req as Express.Request & { cookies?: Record<string, string> }).cookies?.[config.COOKIE_NAME];
  if (!token) throw new ApiError(401, 'AUTH_REQUIRED', 'Sign in to continue');

  let claims;
  try {
    claims = verifySession(token);
  } catch {
    throw new ApiError(401, 'AUTH_REQUIRED', 'Sign in to continue');
  }

  const user = await prisma.user.findUnique({
    where: { id: claims.sub },
    select: { id: true, email: true, name: true, role: true },
  });

  if (!user) throw new ApiError(401, 'AUTH_REQUIRED', 'Sign in to continue');

  req.user = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
  return req.user;
}

export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    await resolveAuthenticatedUser(req);
    next();
  } catch (error) {
    next(error);
  }
};

export const requireAdmin: RequestHandler = async (req, _res, next) => {
  try {
    const user = await resolveAuthenticatedUser(req);
    if (user.role !== 'ADMIN') throw new ApiError(403, 'FORBIDDEN', 'Admin access required');
    next();
  } catch (error) {
    next(error);
  }
};
