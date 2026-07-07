import { Router } from 'express';
import multer from 'multer';
import { analyzeProject, createProject, generateConceptImageAsset, generateConcepts, generateConceptVideoAsset, generateMedia, getProject, saveExportState, selectCharacter, selectConcept, uploadBrandDemo } from '../controllers/projects.controller';
import { characterSelectionSchema, conceptSelectionSchema, conceptStageInputSchema, exportPayloadSchema, mediaStageInputSchema, projectIdParamsSchema, websiteInputSchema } from '../domain/schemas';
import { validate } from '../lib/validation';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

const router = Router();

router.post('/', validate({ body: websiteInputSchema }), createProject);
router.get('/:id', validate({ params: projectIdParamsSchema }), getProject);
router.post('/:id/analyze', validate({ params: projectIdParamsSchema }), analyzeProject);
router.post('/:id/brand-demo', upload.single('demo'), validate({ params: projectIdParamsSchema }), uploadBrandDemo);
router.post('/:id/concepts', validate({ params: projectIdParamsSchema, body: conceptStageInputSchema }), generateConcepts);
router.patch('/:id/concepts/selection', validate({ params: projectIdParamsSchema, body: conceptSelectionSchema }), selectConcept);
router.patch('/:id/character', validate({ params: projectIdParamsSchema, body: characterSelectionSchema }), selectCharacter);
router.post('/:id/media/image', validate({ params: projectIdParamsSchema, body: mediaStageInputSchema }), generateConceptImageAsset);
router.post('/:id/media/video', validate({ params: projectIdParamsSchema, body: mediaStageInputSchema }), generateConceptVideoAsset);
router.post('/:id/media', validate({ params: projectIdParamsSchema, body: mediaStageInputSchema }), generateMedia);
router.patch('/:id/export', validate({ params: projectIdParamsSchema, body: exportPayloadSchema }), saveExportState);

export default router;
