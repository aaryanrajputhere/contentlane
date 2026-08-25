import { Router } from 'express';
import { cancelSubscription, changeSubscriptionPlan, createCheckout, createPortal, getBillingStatus, syncSubscription } from '../controllers/billing.controller';
import { changePlanInputSchema, checkoutInputSchema } from '../domain/schemas';
import { validate } from '../lib/validation';

const router = Router();
router.get('/status', getBillingStatus);
router.post('/checkout', validate({ body: checkoutInputSchema }), createCheckout);
router.post('/change-plan', validate({ body: changePlanInputSchema }), changeSubscriptionPlan);
router.post('/portal', createPortal);
router.post('/sync', syncSubscription);
router.post('/cancel', cancelSubscription);
export default router;
