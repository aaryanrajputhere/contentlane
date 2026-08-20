import { Router } from 'express';
import { cancelSubscription, createCheckout, createPortal, getBillingStatus, syncSubscription } from '../controllers/billing.controller';

const router = Router();
router.get('/status', getBillingStatus);
router.post('/checkout', createCheckout);
router.post('/portal', createPortal);
router.post('/sync', syncSubscription);
router.post('/cancel', cancelSubscription);
export default router;
