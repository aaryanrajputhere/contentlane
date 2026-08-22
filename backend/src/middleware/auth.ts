import type { Request, RequestHandler } from 'express';
import { clerkClient, getAuth } from '@clerk/express';
import prisma from '../lib/prisma';
import { verifySession } from '../lib/auth';
import { ApiError } from '../lib/errors';
import { config } from '../config';

const authenticatedUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
} as const;

export async function resolveAuthenticatedUser(req: Request) {
  if (req.user) return req.user;
  const clerkAuth = config.NODE_ENV === 'test' ? null : getAuth(req);
  if (clerkAuth?.isAuthenticated && clerkAuth.userId) {
    // Clerk has already cryptographically verified the request token before this
    // middleware runs. Prefer the linked local account so routine API requests and
    // job polling do not depend on an additional Clerk network request.
    const linkedUser = await prisma.user.findUnique({
      where: { clerkId: clerkAuth.userId },
      select: authenticatedUserSelect,
    });
    if (linkedUser) {
      req.user = linkedUser;
      return linkedUser;
    }

    let clerkUser;
    try {
      clerkUser = await clerkClient.users.getUser(clerkAuth.userId);
    } catch {
      throw new ApiError(503, 'AUTH_PROVIDER_UNAVAILABLE', 'Sign-in is temporarily unavailable. Please try again.');
    }
    const email = clerkUser.primaryEmailAddress?.emailAddress.toLowerCase();
    if (!email) throw new ApiError(401, 'AUTH_REQUIRED', 'Your Clerk account needs an email address');
    const clerkRole = clerkUser.publicMetadata.role === 'ADMIN' ? 'ADMIN' : 'USER';

    const user = await prisma.user.upsert({
      where: { email },
      update: { clerkId: clerkAuth.userId, name: clerkUser.fullName, role: clerkRole },
      create: { clerkId: clerkAuth.userId, email, name: clerkUser.fullName, role: clerkRole },
      select: authenticatedUserSelect,
    });

    req.user = user;
    return user;
  }

  const token = (req as Request & { cookies?: Record<string, string> }).cookies?.[config.COOKIE_NAME];
  if (!token) throw new ApiError(401, 'AUTH_REQUIRED', 'Sign in to continue');

  let claims;
  try {
    claims = verifySession(token);
  } catch {
    throw new ApiError(401, 'AUTH_REQUIRED', 'Sign in to continue');
  }

  const user = await prisma.user.findUnique({
    where: { id: claims.sub },
    select: authenticatedUserSelect,
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

export async function resolveOptionalUser(req: Request) {
  if (req.user) return req.user;
  const clerkAuth = config.NODE_ENV === 'test' ? null : getAuth(req);
  const token = (req as Request & { cookies?: Record<string, string> }).cookies?.[config.COOKIE_NAME];
  const hasBearer = req.header('authorization')?.startsWith('Bearer ') ?? false;
  if (!clerkAuth?.isAuthenticated && !token && !hasBearer) return null;
  return resolveAuthenticatedUser(req);
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
