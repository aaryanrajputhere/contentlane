import { config } from '../config';

export type BillingPlanId = 'starter' | 'pro';

export interface BillingPlan {
  id: BillingPlanId;
  name: 'Starter' | 'Pro';
  price: number;
  currency: 'USD';
  interval: 'month';
  videoLimit: number;
  productId: string;
}

export function getBillingPlans(): Record<BillingPlanId, BillingPlan> {
  return {
    starter: { id: 'starter', name: 'Starter', price: 9.99, currency: 'USD', interval: 'month', videoLimit: 30, productId: config.DODO_STARTER_PRODUCT_ID },
    pro: { id: 'pro', name: 'Pro', price: 19.99, currency: 'USD', interval: 'month', videoLimit: 100, productId: config.DODO_PRO_PRODUCT_ID },
  };
}

export function getPlan(planId: BillingPlanId) {
  return getBillingPlans()[planId];
}

export function getPlanByProductId(productId: string): BillingPlan | null {
  const plans = getBillingPlans();
  if (productId && productId === plans.starter.productId) return plans.starter;
  if (productId && (productId === plans.pro.productId || productId === config.DODO_PAYMENTS_PRODUCT_ID)) return plans.pro;
  return null;
}

export function getRecognizedProductIds() {
  return [...new Set([config.DODO_STARTER_PRODUCT_ID, config.DODO_PRO_PRODUCT_ID, config.DODO_PAYMENTS_PRODUCT_ID].filter(Boolean))];
}

export function getPublicPlanCatalog() {
  return Object.values(getBillingPlans()).map(({ productId: _productId, ...plan }) => plan);
}
