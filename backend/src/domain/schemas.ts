import { z } from 'zod';

const emailSchema = z.string().trim().email().max(320);
const passwordSchema = z.string().min(8).max(128);

export const projectIdParamsSchema = z.object({ id: z.string().cuid() });
export const jobIdParamsSchema = z.object({ id: z.string().cuid() });
export const creatorParamsSchema = z.object({ id: z.string().cuid() });
export const creatorClipParamsSchema = z.object({ clipId: z.string().cuid() });
export const creatorListQuerySchema = z.object({
  search: z.string().trim().min(1).max(120).optional(),
  tag: z.string().trim().min(1).max(80).optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
}).strict();

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().min(1).max(80).optional(),
}).strict();

export const websiteInputSchema = z.object({ website: z.string().trim().min(1).max(2048) });
export const stageInputSchema = z.object({ forceRegenerate: z.boolean().default(false) });
export const conceptStageInputSchema = z.object({ count: z.number().int().min(1).max(8).default(8), forceRegenerate: z.boolean().default(false) });
export const mediaStageInputSchema = z.object({
  conceptId: z.string().cuid().nullable().optional(),
  forceRegenerate: z.boolean().default(false),
});
export const exportStateSchema = z.object({
  selectedConceptId: z.string().cuid().nullable().optional(),
  selectedCharacterId: z.string().min(1).nullable().optional(),
  selectedCharacterName: z.string().min(1).nullable().optional(),
  selectedCharacterSource: z.enum(['preset', 'custom']).nullable().optional(),
  selectedCreatorClipId: z.string().cuid().nullable().optional(),
  selectedImageId: z.string().cuid().nullable().optional(),
  selectedVideoId: z.string().cuid().nullable().optional(),
  creatorOverlayText: z.string().trim().min(1).max(240).optional(),
  brandDemoOverlayText: z.string().trim().min(1).max(240).optional(),
  overlayText: z.string().trim().min(1).max(240),
  notes: z.string().trim().max(500).optional(),
}).strict();
export const exportPayloadSchema = z.object({ settings: exportStateSchema });
export const creatorCharacterSchema = z.object({
  id: z.string().min(1),
  source: z.enum(['preset', 'custom']),
  name: z.string().min(1).max(80),
  persona: z.string().min(1).max(160),
  appearance: z.string().min(1).max(240),
  voice: z.string().min(1).max(160),
  prompt: z.string().min(1).max(800),
  baseImageUrl: z.string().min(1).nullable().optional(),
  baseImageProvider: z.string().min(1).nullable().optional(),
  baseImageMimeType: z.string().min(1).nullable().optional(),
  clipCount: z.number().int().min(0).optional(),
  clipTags: z.array(z.string().min(1)).optional(),
}).strict();

export const creatorSchema = z.object({
  id: z.string().cuid(),
  name: z.string().min(1).max(80),
  description: z.string().min(1).max(280).nullable(),
  baseImageUrl: z.string().min(1),
  baseImageProvider: z.string().min(1),
  baseImageProviderId: z.string().nullable(),
  baseImageMimeType: z.string().nullable(),
  baseImageMetadata: z.record(z.string(), z.unknown()).nullable(),
  sortOrder: z.number().int(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
}).strict();

export const creatorClipSchema = z.object({
  id: z.string().cuid(),
  creatorId: z.string().cuid(),
  title: z.string().min(1).max(120).nullable(),
  url: z.string().min(1),
  provider: z.string().min(1),
  providerId: z.string().nullable(),
  mimeType: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  tags: z.array(z.string().min(1)),
  sortOrder: z.number().int(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
}).strict();

export const creatorMutationSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(280).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
}).strict();

export const creatorClipMutationSchema = z.object({
  title: z.string().trim().max(120).optional(),
  tags: z.union([z.string(), z.array(z.string())]).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  trimStart: z.coerce.number().optional(),
  trimEnd: z.coerce.number().optional(),
}).strict();

export const creatorClipUpdateSchema = creatorClipMutationSchema.partial();

export const conceptSelectionSchema = z.object({
  conceptId: z.string().cuid().nullable(),
}).strict();

export const characterSelectionSchema = z.object({
  character: creatorCharacterSchema.nullable(),
}).strict();

export const userRoleSchema = z.enum(['USER', 'ADMIN']);
export const projectStatusSchema = z.enum(['DRAFT', 'ANALYZING', 'READY', 'HOOKS_READY', 'SCRIPTS_READY', 'MEDIA_READY', 'EXPORT_READY', 'FAILED']);
export const analysisExtractionStatusSchema = z.enum(['success', 'failed']);
export const analysisExtractionSourceSchema = z.enum(['firecrawl', 'fallback']);
export const jobStatusSchema = z.enum(['QUEUED', 'ACTIVE', 'COMPLETED', 'FAILED', 'CANCELLED']);
export const jobTypeSchema = z.enum(['ANALYZE_WEBSITE', 'GENERATE_CONCEPTS', 'GENERATE_MEDIA', 'SAVE_EXPORT', 'GENERATE_HOOKS', 'GENERATE_SCRIPTS']);
export const mediaTypeSchema = z.enum(['IMAGE', 'VIDEO']);

export const authUserSchema = z.object({
  id: z.string().cuid(),
  email: emailSchema,
  name: z.string().nullable(),
  role: userRoleSchema,
}).strict();

export const creativeBriefSchema = z.object({
  id: z.string().uuid(),
  pattern: z.string().min(1),
  moment: z.string().min(1),
  viewerEmotion: z.string().min(1),
  creatorEmotion: z.string().min(1),
  payoff: z.string().min(1),
  location: z.string().min(1),
  creatorAction: z.string().min(1),
  avoid: z.array(z.string()),
}).strict();

export const brandProfileSchema = z.object({
  id: z.string().cuid(),
  projectId: z.string().cuid(),
  brandName: z.string().min(1),
  product: z.string().min(1),
  audience: z.string().min(1),
  audienceIdentity: z.string().min(1),
  audienceStage: z.string().min(1),
  emotionalDrivers: z.array(z.string().min(1)),
  fears: z.array(z.string().min(1)),
  realThoughts: z.array(z.string().min(1)),
  dailyMoments: z.array(z.string().min(1)),
  dreamOutcomes: z.array(z.string().min(1)),
  misconceptions: z.array(z.string().min(1)),
  objections: z.array(z.string().min(1)),
  proofPoints: z.array(z.string().min(1)),
  socialProofMoments: z.array(z.string().min(1)),
  transformation: z.string().min(1),
  uniqueMechanism: z.string().min(1),
  conversationStarters: z.array(z.string().min(1)),
  viralTriggers: z.array(z.string().min(1)),
  emotionalLanguage: z.array(z.string().min(1)),
  forbiddenClaims: z.array(z.string().min(1)),
  ugcScenarios: z.array(z.string().min(1)),
  testimonials: z.array(z.string().min(1)),
  cta: z.string().min(1),
  summary: z.string().min(1),
  campaignStrategy: z.array(creativeBriefSchema).nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
}).strict();
export const websiteAnalysisPageSchema = z.object({
  url: z.string().url(),
  title: z.string().min(1).nullable().optional(),
  metaDescription: z.string().min(1).nullable().optional(),
  visibleTextSnippet: z.string().min(1),
  pageTypeHint: z.string().min(1),
  crawlDepth: z.number().int().min(0),
  canonicalUrl: z.string().url().nullable().optional(),
  score: z.number().int().min(0).max(100).optional(),
  scoreReason: z.string().min(1).nullable().optional(),
  extractionStatus: analysisExtractionStatusSchema.optional(),
  extractionSource: analysisExtractionSourceSchema.optional(),
  extractionError: z.string().min(1).nullable().optional(),
  extractedTextSnippet: z.string().min(1).nullable().optional(),
}).strict();

export const websiteAnalysisHomepageSchema = z.object({
  url: z.string().url(),
  title: z.string().min(1).nullable().optional(),
  metaDescription: z.string().min(1).nullable().optional(),
  visibleTextSnippet: z.string().min(1),
  extractedTextSnippet: z.string().min(1).nullable().optional(),
  canonicalUrl: z.string().url().nullable().optional(),
  extractionStatus: analysisExtractionStatusSchema.optional(),
  extractionSource: analysisExtractionSourceSchema.optional(),
  extractionError: z.string().min(1).nullable().optional(),
}).strict();

export const websiteAnalysisSchema = z.object({
  id: z.string().cuid(),
  projectId: z.string().cuid(),
  sourceUrl: z.string().url(),
  rootDomain: z.string().min(1),
  homepage: websiteAnalysisHomepageSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
}).strict();


export const conceptCardSchema = z.object({
  id: z.string().cuid(),
  projectId: z.string().cuid(),
  angle: z.string().min(1),
  hookText: z.string().min(1),
  hookImagePrompt: z.string().min(1),
  demoOverlayText: z.string().min(1),
  videoDirection: z.string().min(1),
  targetDurationLabel: z.string().min(1),
  targetDurationSeconds: z.number().int().min(1).max(30),
  score: z.number().int(),
  scoreLabel: z.string().min(1),
  rationale: z.string().min(1),
  generatedImageUrl: z.string().min(1).nullable(),
  generatedVideoUrl: z.string().min(1).nullable(),
  sortOrder: z.number().int(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
}).strict();

export const mediaAssetSchema = z.object({
  id: z.string().cuid(),
  projectId: z.string().cuid(),
  conceptId: z.string().cuid().nullable(),
  type: mediaTypeSchema,
  provider: z.string().min(1),
  providerId: z.string().nullable(),
  url: z.string().min(1),
  mimeType: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.coerce.date(),
}).strict();

export const projectExportSchema = z.object({
  id: z.string().cuid(),
  projectId: z.string().cuid(),
  settings: exportStateSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
}).strict();

export const generationJobSchema = z.object({
  id: z.string().cuid(),
  projectId: z.string().cuid(),
  type: jobTypeSchema,
  status: jobStatusSchema,
  progress: z.number().int().min(0).max(100),
  progressMessage: z.string().nullable(),
  input: z.record(z.string(), z.unknown()),
  result: z.unknown().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
}).strict();

export const projectSchema = z.object({
  id: z.string().cuid(),
  website: z.string().min(1),
  normalizedWebsite: z.string().min(1),
  status: projectStatusSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  selectedConceptId: z.string().cuid().nullable(),
  selectedCharacterId: z.string().min(1).nullable(),
}).strict();

export const projectSnapshotSchema = projectSchema.extend({
  brandProfile: brandProfileSchema.nullable(),
  websiteAnalysis: websiteAnalysisSchema.nullable(),
  concepts: z.array(conceptCardSchema),
  mediaAssets: z.array(mediaAssetSchema),
  exportState: projectExportSchema.nullable(),
  jobs: z.array(generationJobSchema),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type AuthUser = z.infer<typeof authUserSchema>;
export type WebsiteInput = z.infer<typeof websiteInputSchema>;
export type StageInput = z.infer<typeof stageInputSchema>;
export type ConceptStageInput = z.infer<typeof conceptStageInputSchema>;
export type MediaStageInput = z.infer<typeof mediaStageInputSchema>;
export type ExportState = z.infer<typeof exportStateSchema>;
export type BrandProfile = z.infer<typeof brandProfileSchema>;
export type WebsiteAnalysisPage = z.infer<typeof websiteAnalysisPageSchema>;
export type WebsiteAnalysisHomepage = z.infer<typeof websiteAnalysisHomepageSchema>;
export type WebsiteAnalysis = z.infer<typeof websiteAnalysisSchema>;
export type CreatorCharacter = z.infer<typeof creatorCharacterSchema>;
export type CreatorRecord = z.infer<typeof creatorSchema>;
export type CreatorClipRecord = z.infer<typeof creatorClipSchema>;
export type ConceptCard = z.infer<typeof conceptCardSchema>;
export type MediaAsset = z.infer<typeof mediaAssetSchema>;
export type ProjectExport = z.infer<typeof projectExportSchema>;
export type GenerationJob = z.infer<typeof generationJobSchema>;
export type ProjectSnapshot = z.infer<typeof projectSnapshotSchema>;
export type CharacterSelection = z.infer<typeof characterSelectionSchema>;
export type CreativeBrief = z.infer<typeof creativeBriefSchema>;
