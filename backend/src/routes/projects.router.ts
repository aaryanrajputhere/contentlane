import { Router } from 'express';
import multer from 'multer';
import { analyzeProject, confirmBrandProfile, createProject, deleteBrandDemo, generateConceptImageAsset, generateConcepts, generateConceptVideoAsset, generateMedia, getProject, listProjects, renameBrandDemo, renderProject, resetConceptReviews, reviewConcept, saveExportState, selectCharacter, selectConcept, saveHookPreferences, setDefaultBrandDemo, uploadBrandDemo, uploadBrandDemos, updateBrandProfile, updateConcept, updateGenerationLanguage, updateHookPreferences } from '../controllers/projects.controller';
import { brandDemoParamsSchema, brandDemoRenameSchema, brandProfileConfirmationSchema, brandProfileUpdateSchema, characterSelectionSchema, conceptEditSchema, conceptReviewParamsSchema, conceptReviewResetSchema, conceptReviewSchema, conceptSelectionSchema, conceptStageInputSchema, exportPayloadSchema, generationLanguageUpdateSchema, hookPreferenceSelectionSchema, hookPreferencesUpdateSchema, mediaStageInputSchema, projectIdParamsSchema, renderRequestSchema, websiteInputSchema } from '../domain/schemas';
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
router.patch('/:id/language', validate({ params: projectIdParamsSchema, body: generationLanguageUpdateSchema }), updateGenerationLanguage);
router.post('/:id/analyze', validate({ params: projectIdParamsSchema }), analyzeProject);
router.post('/:id/brand-demo', requireSubscription, upload.single('demo'), validate({ params: projectIdParamsSchema }), uploadBrandDemo);
router.post('/:id/brand-demos', requireSubscription, upload.array('demos', 10), validate({ params: projectIdParamsSchema }), uploadBrandDemos);
router.patch('/:id/brand-demos/:demoId', requireSubscription, validate({ params: brandDemoParamsSchema, body: brandDemoRenameSchema }), renameBrandDemo);
router.put('/:id/brand-demos/:demoId/default', requireSubscription, validate({ params: brandDemoParamsSchema }), setDefaultBrandDemo);
router.delete('/:id/brand-demos/:demoId', requireSubscription, validate({ params: brandDemoParamsSchema }), deleteBrandDemo);
router.post('/:id/concepts', validate({ params: projectIdParamsSchema, body: conceptStageInputSchema }), generateConcepts);
router.patch('/:id/concepts/review/reset', requireSubscription, validate({ params: projectIdParamsSchema, body: conceptReviewResetSchema }), resetConceptReviews);
router.patch('/:id/concepts/:conceptId/review', validate({ params: conceptReviewParamsSchema, body: conceptReviewSchema }), reviewConcept);
router.patch('/:id/concepts/:conceptId', validate({ params: conceptReviewParamsSchema, body: conceptEditSchema }), updateConcept);
router.patch('/:id/concepts/preferences', requireSubscription, validate({ params: projectIdParamsSchema, body: hookPreferenceSelectionSchema }), saveHookPreferences);
router.patch('/:id/concepts/selection', requireSubscription, validate({ params: projectIdParamsSchema, body: conceptSelectionSchema }), selectConcept);
router.patch('/:id/character', requireSubscription, validate({ params: projectIdParamsSchema, body: characterSelectionSchema }), selectCharacter);
router.post('/:id/media/image', requireSubscription, validate({ params: projectIdParamsSchema, body: mediaStageInputSchema }), generateConceptImageAsset);
router.post('/:id/media/video', requireSubscription, validate({ params: projectIdParamsSchema, body: mediaStageInputSchema }), generateConceptVideoAsset);
router.post('/:id/media', requireSubscription, validate({ params: projectIdParamsSchema, body: mediaStageInputSchema }), generateMedia);
router.patch('/:id/export', requireSubscription, validate({ params: projectIdParamsSchema, body: exportPayloadSchema }), saveExportState);
router.post('/:id/render', requireSubscription, validate({ params: projectIdParamsSchema, body: renderRequestSchema }), renderProject);

export default router;
