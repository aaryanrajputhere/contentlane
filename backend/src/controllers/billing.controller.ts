import type { RequestHandler } from 'express';
import { config } from '../config';
import { getDodoClient, requireCheckoutProducts } from '../lib/dodo';
import { ApiError } from '../lib/errors';
import prisma from '../lib/prisma';
import { getFreeAccess, hasPaidAccess } from '../lib/access';
import { getPlan, getPlanByProductId, getPublicPlanCatalog, getRecognizedProductIds, type BillingPlanId } from '../lib/billing-plans';
import { getActiveSubscription, getRenderUsage } from '../lib/render-quota';

export const getBillingStatus: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'AUTH_REQUIRED', 'Sign in to continue');
    const activeSubscription = await getActiveSubscription(req.user.id);
    const subscription = activeSubscription ?? await prisma.subscription.findFirst({
      where: { userId: req.user.id, dodoProductId: { in: getRecognizedProductIds() } },
      orderBy: [{ latestProviderEventAt: 'desc' }, { updatedAt: 'desc' }],
    });
    const isAdmin = req.user.role === 'ADMIN';
    const paid = await hasPaidAccess(req.user.id, req.user.role);
    const freeAccess = await getFreeAccess(req.user.id);
    const plan = subscription ? getPlanByProductId(subscription.dodoProductId) : null;
    const isLegacyPlan = Boolean(subscription && config.DODO_PAYMENTS_PRODUCT_ID && subscription.dodoProductId === config.DODO_PAYMENTS_PRODUCT_ID && subscription.dodoProductId !== config.DODO_PRO_PRODUCT_ID);
    const scheduledPlan = subscription?.scheduledDodoProductId ? getPlanByProductId(subscription.scheduledDodoProductId) : null;
    const videoUsage = await getRenderUsage(req.user.id, req.user.role);
    res.json({
      planId: isAdmin ? null : plan?.id ?? null,
      planName: isAdmin ? 'Admin' : plan?.name ?? null,
      price: isLegacyPlan ? 19 : plan?.price ?? null,
      isLegacyPlan,
      currency: 'USD',
      plans: getPublicPlanCatalog(),
      status: isAdmin ? 'active' : subscription?.status ?? 'none',
      hasAccess: paid,
      accessTier: isAdmin ? 'admin' : paid ? 'subscriber' : (!freeAccess.ended ? 'free' : 'none'),
      freeAccess,
      renewalDate: subscription?.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: subscription?.cancelAtNextBillingDate ?? false,
      scheduledPlanId: scheduledPlan?.id ?? null,
      videoUsage: {
        ...videoUsage,
        periodStart: videoUsage.periodStart?.toISOString() ?? null,
        periodEnd: videoUsage.periodEnd?.toISOString() ?? null,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createCheckout: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'AUTH_REQUIRED', 'Sign in to continue');
    if (req.user.role === 'ADMIN') throw new ApiError(409, 'ALREADY_SUBSCRIBED', 'This account already has access');
    const plans = requireCheckoutProducts();
    const planId = req.body.planId as BillingPlanId;
    const selectedPlan = plans[planId];
    const subscriptions = await prisma.subscription.findMany({
      where: { userId: req.user.id, dodoProductId: { in: getRecognizedProductIds() } },
      select: { id: true, status: true },
    });
    if (subscriptions.some((subscription) => subscription.status === 'active')) throw new ApiError(409, 'ALREADY_SUBSCRIBED', 'You already have an active subscription');
    const projectId = typeof req.body.projectId === 'string' ? req.body.projectId : undefined;
    if (projectId) {
      const owned = await prisma.project.findFirst({ where: { id: projectId, userId: req.user.id }, select: { id: true } });
      if (!owned) throw new ApiError(404, 'NOT_FOUND', 'Project not found');
    }
    const returnParams = new URLSearchParams({ plan: planId });
    if (projectId) returnParams.set('projectId', projectId);

    const session = await getDodoClient().checkoutSessions.create({
      product_cart: [{ product_id: selectedPlan.productId, quantity: 1 }],
      subscription_data: subscriptions.length === 0 ? { trial_period_days: 7 } : undefined,
      customer: req.user.name ? { email: req.user.email, name: req.user.name } : { email: req.user.email },
      metadata: { contentlane_user_id: req.user.id, contentlane_plan_id: planId },
      return_url: `${config.FRONTEND_URL}/billing/success?${returnParams.toString()}`,
      cancel_url: `${config.FRONTEND_URL}/billing?cancelled=1&${returnParams.toString()}`,
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

export const syncSubscription: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'AUTH_REQUIRED', 'Sign in to continue');
    const subscriptionId = req.body?.subscriptionId;
    if (typeof subscriptionId !== 'string' || !/^sub_[A-Za-z0-9_-]+$/.test(subscriptionId)) throw new ApiError(400, 'INVALID_SUBSCRIPTION', 'A valid subscription is required');

    const providerSubscription = await getDodoClient().subscriptions.retrieve(subscriptionId);
    const metadataUserId = typeof providerSubscription.metadata?.contentlane_user_id === 'string' ? providerSubscription.metadata.contentlane_user_id : undefined;
    if (!getPlanByProductId(providerSubscription.product_id)
      || providerSubscription.customer.email.toLowerCase() !== req.user.email.toLowerCase()
      || (metadataUserId && metadataUserId !== req.user.id)) {
      throw new ApiError(403, 'SUBSCRIPTION_MISMATCH', 'This subscription does not belong to your account');
    }

    const existing = await prisma.subscription.findUnique({ where: { dodoSubscriptionId: providerSubscription.subscription_id }, select: { latestProviderEventAt: true, scheduledDodoProductId: true } });
    await prisma.user.update({ where: { id: req.user.id }, data: { dodoCustomerId: providerSubscription.customer.customer_id } });
    if (providerSubscription.status === 'active') await prisma.$executeRaw`UPDATE "User" SET "freeAccessEndedAt" = COALESCE("freeAccessEndedAt", NOW()) WHERE "id" = ${req.user.id}`;
    const scheduledDodoProductId = existing?.scheduledDodoProductId === providerSubscription.product_id ? null : existing?.scheduledDodoProductId;
    await prisma.subscription.upsert({
      where: { dodoSubscriptionId: providerSubscription.subscription_id },
      create: {
        userId: req.user.id,
        dodoCustomerId: providerSubscription.customer.customer_id,
        dodoSubscriptionId: providerSubscription.subscription_id,
        dodoProductId: providerSubscription.product_id,
        status: providerSubscription.status,
        currentPeriodStart: new Date(providerSubscription.previous_billing_date),
        currentPeriodEnd: new Date(providerSubscription.next_billing_date),
        cancelAtNextBillingDate: providerSubscription.cancel_at_next_billing_date,
        latestProviderEventAt: new Date(0),
        scheduledDodoProductId,
      },
      update: {
        userId: req.user.id,
        dodoCustomerId: providerSubscription.customer.customer_id,
        dodoProductId: providerSubscription.product_id,
        status: providerSubscription.status,
        currentPeriodStart: new Date(providerSubscription.previous_billing_date),
        currentPeriodEnd: new Date(providerSubscription.next_billing_date),
        cancelAtNextBillingDate: providerSubscription.cancel_at_next_billing_date,
        latestProviderEventAt: existing?.latestProviderEventAt ?? new Date(0),
        scheduledDodoProductId,
      },
    });
    res.json({ status: providerSubscription.status });
  } catch (error) {
    next(error);
  }
};

export const cancelSubscription: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'AUTH_REQUIRED', 'Sign in to continue');
    if (req.user.role === 'ADMIN') throw new ApiError(409, 'NOT_APPLICABLE', 'Admin access does not have a subscription to cancel');
    const subscription = await getActiveSubscription(req.user.id);
    if (!subscription) throw new ApiError(404, 'SUBSCRIPTION_NOT_FOUND', 'No active subscription is available to cancel');
    if (subscription.cancelAtNextBillingDate) return res.json({ cancelAtPeriodEnd: true });
    await getDodoClient().subscriptions.update(subscription.dodoSubscriptionId, { cancel_at_next_billing_date: true, cancel_reason: 'cancelled_by_customer' });
    await prisma.subscription.update({ where: { id: subscription.id }, data: { cancelAtNextBillingDate: true } });
    res.json({ cancelAtPeriodEnd: true });
  } catch (error) {
    next(error);
  }
};

export const changeSubscriptionPlan: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, 'AUTH_REQUIRED', 'Sign in to continue');
    if (req.user.role === 'ADMIN') throw new ApiError(409, 'NOT_APPLICABLE', 'Admin access does not use a paid plan');
    const targetPlan = getPlan(req.body.planId as BillingPlanId);
    requireCheckoutProducts();
    const subscription = await getActiveSubscription(req.user.id);
    if (!subscription) throw new ApiError(404, 'SUBSCRIPTION_NOT_FOUND', 'No active subscription is available to change');
    const currentPlan = getPlanByProductId(subscription.dodoProductId);
    if (!currentPlan) throw new ApiError(409, 'PLAN_UNAVAILABLE', 'The current subscription plan is not recognized');
    if (currentPlan.id === targetPlan.id) throw new ApiError(409, 'ALREADY_ON_PLAN', `You are already on the ${targetPlan.name} plan`);

    const upgrading = currentPlan.videoLimit < targetPlan.videoLimit;
    await getDodoClient().subscriptions.changePlan(subscription.dodoSubscriptionId, {
      product_id: targetPlan.productId,
      quantity: 1,
      effective_at: upgrading ? 'immediately' : 'next_billing_date',
      proration_billing_mode: upgrading ? 'prorated_immediately' : 'do_not_bill',
      on_payment_failure: 'prevent_change',
      metadata: { contentlane_user_id: req.user.id, contentlane_plan_id: targetPlan.id },
    });
    await prisma.subscription.update({ where: { id: subscription.id }, data: { scheduledDodoProductId: upgrading ? null : targetPlan.productId } });
    res.json({ planId: targetPlan.id, effectiveAt: upgrading ? 'immediately' : 'next_billing_date' });
  } catch (error) {
    next(error);
  }
};
