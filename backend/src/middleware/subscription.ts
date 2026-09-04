import type { RequestHandler } from 'express';
import { ApiError } from '../lib/errors';
import { hasFullAccess } from '../lib/access';

export const requireSubscription: RequestHandler = async (req, _res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'AUTH_REQUIRED', 'Sign in to continue');
    if (!await hasFullAccess(req.user.id, req.user.role)) {
      throw new ApiError(402, 'SUBSCRIPTION_REQUIRED', 'An active ContentLane subscription is required');
    }
    next();
  } catch (error) {
    next(error);
  }
};
