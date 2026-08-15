import { Router } from 'express';
import multer from 'multer';
import { analyzeProject, createProject, generateConceptImageAsset, generateConcepts, generateConceptVideoAsset, generateMedia, getProject, listProjects, renderProject, resetConceptReviews, reviewConcept, saveExportState, selectCharacter, selectConcept, saveHookPreferences, uploadBrandDemo, updateBrandProfile, updateConcept, updateHookPreferences } from '../controllers/projects.controller';
import { brandProfileUpdateSchema, characterSelectionSchema, conceptEditSchema, conceptReviewParamsSchema, conceptReviewResetSchema, conceptReviewSchema, conceptSelectionSchema, conceptStageInputSchema, exportPayloadSchema, hookPreferenceSelectionSchema, hookPreferencesUpdateSchema, mediaStageInputSchema, projectIdParamsSchema, renderRequestSchema, websiteInputSchema } from '../domain/schemas';
import { validate } from '../lib/validation';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

const router = Router();

router.post('/', validate({ body: websiteInputSchema }), createProject);
router.get('/', listProjects);
router.get('/:id', validate({ params: projectIdParamsSchema }), getProject);
router.patch('/:id/brand-profile', validate({ params: projectIdParamsSchema, body: brandProfileUpdateSchema }), updateBrandProfile);
router.patch('/:id/hook-preferences', validate({ params: projectIdParamsSchema, body: hookPreferencesUpdateSchema }), updateHookPreferences);
router.post('/:id/analyze', validate({ params: projectIdParamsSchema }), analyzeProject);
router.post('/:id/brand-demo', upload.single('demo'), validate({ params: projectIdParamsSchema }), uploadBrandDemo);
router.post('/:id/concepts', validate({ params: projectIdParamsSchema, body: conceptStageInputSchema }), generateConcepts);
router.patch('/:id/concepts/review/reset', validate({ params: projectIdParamsSchema, body: conceptReviewResetSchema }), resetConceptReviews);
router.patch('/:id/concepts/:conceptId/review', validate({ params: conceptReviewParamsSchema, body: conceptReviewSchema }), reviewConcept);
router.patch('/:id/concepts/:conceptId', validate({ params: conceptReviewParamsSchema, body: conceptEditSchema }), updateConcept);
router.patch('/:id/concepts/preferences', validate({ params: projectIdParamsSchema, body: hookPreferenceSelectionSchema }), saveHookPreferences);
router.patch('/:id/concepts/selection', validate({ params: projectIdParamsSchema, body: conceptSelectionSchema }), selectConcept);
router.patch('/:id/character', validate({ params: projectIdParamsSchema, body: characterSelectionSchema }), selectCharacter);
router.post('/:id/media/image', validate({ params: projectIdParamsSchema, body: mediaStageInputSchema }), generateConceptImageAsset);
router.post('/:id/media/video', validate({ params: projectIdParamsSchema, body: mediaStageInputSchema }), generateConceptVideoAsset);
router.post('/:id/media', validate({ params: projectIdParamsSchema, body: mediaStageInputSchema }), generateMedia);
router.patch('/:id/export', validate({ params: projectIdParamsSchema, body: exportPayloadSchema }), saveExportState);
router.post('/:id/render', validate({ params: projectIdParamsSchema, body: renderRequestSchema }), renderProject);

export default router;
