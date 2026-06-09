import { Router } from 'express';
import { analyzeCampaign, getCampaign, generateProductHooks } from '../controllers/campaigns.controller';

const router = Router();

router.post('/analyze', analyzeCampaign);
router.get('/:id', getCampaign);
router.post('/:id/generate-hooks', generateProductHooks);

export default router;
