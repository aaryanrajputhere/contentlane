import { Router } from 'express';
import multer from 'multer';
import { analyzeProject, confirmBrandProfile, createProject, generateConceptImageAsset, generateConcepts, generateConceptVideoAsset, generateMedia, getProject, listProjects, renderProject, resetConceptReviews, reviewConcept, saveExportState, selectCharacter, selectConcept, saveHookPreferences, uploadBrandDemo, updateBrandProfile, updateConcept, updateHookPreferences } from '../controllers/projects.controller';
import { brandProfileConfirmationSchema, brandProfileUpdateSchema, characterSelectionSchema, conceptEditSchema, conceptReviewParamsSchema, conceptReviewResetSchema, conceptReviewSchema, conceptSelectionSchema, conceptStageInputSchema, exportPayloadSchema, hookPreferenceSelectionSchema, hookPreferencesUpdateSchema, mediaStageInputSchema, projectIdParamsSchema, renderRequestSchema, websiteInputSchema } from '../domain/schemas';
import { validate } from '../lib/validation';
import { requireSubscription } from '../middleware/subscription';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

const router = Router();

router.post('/', validate({ body: websiteInputSchema }), createProject);
router.get('/', requireSubscription, listProjects);
router.get('/:id', validate({ params: projectIdParamsSchema }), getProject);
router.post('/:id/brand-profile/confirm', validate({ params: projectIdParamsSchema, body: brandProfileConfirmationSchema }), confirmBrandProfile);
router.patch('/:id/brand-profile', requireSubscription, validate({ params: projectIdParamsSchema, body: brandProfileUpdateSchema }), updateBrandProfile);
router.patch('/:id/hook-preferences', requireSubscription, validate({ params: projectIdParamsSchema, body: hookPreferencesUpdateSchema }), updateHookPreferences);
router.post('/:id/analyze', validate({ params: projectIdParamsSchema }), analyzeProject);
router.post('/:id/brand-demo', requireSubscription, upload.single('demo'), validate({ params: projectIdParamsSchema }), uploadBrandDemo);
router.post('/:id/concepts', validate({ params: projectIdParamsSchema, body: conceptStageInputSchema }), generateConcepts);
router.patch('/:id/concepts/review/reset', requireSubscription, validate({ params: projectIdParamsSchema, body: conceptReviewResetSchema }), resetConceptReviews);
router.patch('/:id/concepts/:conceptId/review', validate({ params: conceptReviewParamsSchema, body: conceptReviewSchema }), reviewConcept);
router.patch('/:id/concepts/:conceptId', requireSubscription, validate({ params: conceptReviewParamsSchema, body: conceptEditSchema }), updateConcept);
router.patch('/:id/concepts/preferences', requireSubscription, validate({ params: projectIdParamsSchema, body: hookPreferenceSelectionSchema }), saveHookPreferences);
router.patch('/:id/concepts/selection', requireSubscription, validate({ params: projectIdParamsSchema, body: conceptSelectionSchema }), selectConcept);
router.patch('/:id/character', requireSubscription, validate({ params: projectIdParamsSchema, body: characterSelectionSchema }), selectCharacter);
router.post('/:id/media/image', requireSubscription, validate({ params: projectIdParamsSchema, body: mediaStageInputSchema }), generateConceptImageAsset);
router.post('/:id/media/video', requireSubscription, validate({ params: projectIdParamsSchema, body: mediaStageInputSchema }), generateConceptVideoAsset);
router.post('/:id/media', requireSubscription, validate({ params: projectIdParamsSchema, body: mediaStageInputSchema }), generateMedia);
router.patch('/:id/export', requireSubscription, validate({ params: projectIdParamsSchema, body: exportPayloadSchema }), saveExportState);
router.post('/:id/render', requireSubscription, validate({ params: projectIdParamsSchema, body: renderRequestSchema }), renderProject);

export default router;
