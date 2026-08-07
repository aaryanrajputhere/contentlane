import DodoPayments from 'dodopayments';
import { config } from '../config';
import { ApiError } from './errors';

let client: DodoPayments | undefined;

export function getDodoClient() {
  if (!config.DODO_PAYMENTS_API_KEY || !config.DODO_PAYMENTS_PRODUCT_ID) {
    throw new ApiError(503, 'BILLING_NOT_CONFIGURED', 'Billing is not configured');
  }
  client ??= new DodoPayments({
    bearerToken: config.DODO_PAYMENTS_API_KEY,
    webhookKey: config.DODO_PAYMENTS_WEBHOOK_KEY || undefined,
    environment: config.DODO_PAYMENTS_ENVIRONMENT,
  });
  return client;
}

export function requireWebhookConfiguration() {
  if (!config.DODO_PAYMENTS_WEBHOOK_KEY || !config.DODO_PAYMENTS_PRODUCT_ID) {
    throw new ApiError(503, 'BILLING_NOT_CONFIGURED', 'Billing webhook is not configured');
  }
  return { client: getDodoClient(), webhookKey: config.DODO_PAYMENTS_WEBHOOK_KEY };
}
