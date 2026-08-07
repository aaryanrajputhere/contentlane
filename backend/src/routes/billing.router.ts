import { Router } from 'express';
import { createCheckout, createPortal, getBillingStatus } from '../controllers/billing.controller';

const router = Router();
router.get('/status', getBillingStatus);
router.post('/checkout', createCheckout);
router.post('/portal', createPortal);
export default router;
