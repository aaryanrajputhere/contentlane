import type { RequestHandler } from 'express';
import { config } from '../config';
import { getDodoClient } from '../lib/dodo';
import { ApiError } from '../lib/errors';
import prisma from '../lib/prisma';

export const getBillingStatus: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'AUTH_REQUIRED', 'Sign in to continue');
    const subscription = await prisma.subscription.findFirst({
      where: { userId: req.user.id, dodoProductId: config.DODO_PAYMENTS_PRODUCT_ID },
      orderBy: { latestProviderEventAt: 'desc' },
    });
    const isAdmin = req.user.role === 'ADMIN';
    res.json({
      plan: 'ContentLane',
      price: 19,
      currency: 'USD',
      status: isAdmin ? 'active' : subscription?.status ?? 'none',
      hasAccess: isAdmin || subscription?.status === 'active',
      renewalDate: subscription?.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: subscription?.cancelAtNextBillingDate ?? false,
    });
  } catch (error) {
    next(error);
  }
};

export const createCheckout: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'AUTH_REQUIRED', 'Sign in to continue');
    if (req.user.role === 'ADMIN') throw new ApiError(409, 'ALREADY_SUBSCRIBED', 'This account already has access');
    const active = await prisma.subscription.findFirst({
      where: { userId: req.user.id, dodoProductId: config.DODO_PAYMENTS_PRODUCT_ID, status: 'active' },
      select: { id: true },
    });
    if (active) throw new ApiError(409, 'ALREADY_SUBSCRIBED', 'You already have an active subscription');

    const session = await getDodoClient().checkoutSessions.create({
      product_cart: [{ product_id: config.DODO_PAYMENTS_PRODUCT_ID, quantity: 1 }],
      subscription_data: { trial_period_days: 3 },
      customer: req.user.name
        ? { email: req.user.email, name: req.user.name }
        : { email: req.user.email },
      metadata: { contentlane_user_id: req.user.id },
      return_url: `${config.FRONTEND_URL}/billing/success`,
      cancel_url: `${config.FRONTEND_URL}/billing?cancelled=1`,
      feature_flags: {
        allow_customer_editing_email: false,
        allow_customer_editing_name: true,
        allow_discount_code: true,
      },
    });
    if (!session.checkout_url) throw new ApiError(502, 'CHECKOUT_FAILED', 'Dodo did not return a checkout URL');
    res.json({ url: session.checkout_url });
  } catch (error) {
    next(error);
  }
};

export const createPortal: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'AUTH_REQUIRED', 'Sign in to continue');
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { dodoCustomerId: true } });
    if (!user?.dodoCustomerId) throw new ApiError(404, 'BILLING_ACCOUNT_NOT_FOUND', 'No billing account is available yet');
    const session = await getDodoClient().customers.customerPortal.create(user.dodoCustomerId, {
      return_url: `${config.FRONTEND_URL}/billing`,
    });
    res.json({ url: session.link });
  } catch (error) {
    next(error);
  }
};

export const cancelSubscription: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'AUTH_REQUIRED', 'Sign in to continue');
    if (req.user.role === 'ADMIN') throw new ApiError(409, 'NOT_APPLICABLE', 'Admin access does not have a subscription to cancel');

    const subscription = await prisma.subscription.findFirst({
      where: { userId: req.user.id, dodoProductId: config.DODO_PAYMENTS_PRODUCT_ID, status: 'active' },
      orderBy: { latestProviderEventAt: 'desc' },
    });
    if (!subscription) throw new ApiError(404, 'SUBSCRIPTION_NOT_FOUND', 'No active subscription is available to cancel');
    if (subscription.cancelAtNextBillingDate) {
      res.json({ cancelAtPeriodEnd: true });
      return;
    }

    await getDodoClient().subscriptions.update(subscription.dodoSubscriptionId, {
      cancel_at_next_billing_date: true,
      cancel_reason: 'cancelled_by_customer',
    });
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { cancelAtNextBillingDate: true },
    });
    res.json({ cancelAtPeriodEnd: true });
  } catch (error) {
    next(error);
  }
};
