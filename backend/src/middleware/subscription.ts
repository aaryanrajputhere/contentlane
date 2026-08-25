import type { RequestHandler } from 'express';
import prisma from '../lib/prisma';
import { ApiError } from '../lib/errors';
import { getRecognizedProductIds } from '../lib/billing-plans';

export const requireSubscription: RequestHandler = async (req, _res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'AUTH_REQUIRED', 'Sign in to continue');
    if (req.user.role === 'ADMIN') return next();

    const subscription = await prisma.subscription.findFirst({
      where: {
        userId: req.user.id,
        dodoProductId: { in: getRecognizedProductIds() },
        status: 'active',
      },
      select: { id: true },
    });
    if (!subscription) {
      throw new ApiError(402, 'SUBSCRIPTION_REQUIRED', 'An active ContentLane subscription is required');
    }
    next();
  } catch (error) {
    next(error);
  }
};
