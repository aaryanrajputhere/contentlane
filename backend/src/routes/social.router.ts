import { Router } from 'express';
import {
  connectTikTok,
  disconnectTikTok,
  getPublicationAnalytics,
  getTikTokMusic,
  getTikTokPublishingOptions,
  listSocialAccounts,
} from '../controllers/social.controller';

const router = Router();

router.get('/accounts', listSocialAccounts);
router.post('/connect/tiktok', connectTikTok);
router.delete('/accounts/:accountId', disconnectTikTok);
router.get('/accounts/:accountId/tiktok/music', getTikTokMusic);
router.get('/accounts/:accountId/tiktok/publishing-options', getTikTokPublishingOptions);
router.get('/publications/:publicationId/analytics', getPublicationAnalytics);

export default router;
