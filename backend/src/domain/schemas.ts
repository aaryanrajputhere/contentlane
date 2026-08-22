import { z } from 'zod';

const emailSchema = z.string().trim().email().max(320);
const passwordSchema = z.string().min(8).max(128);

export const projectIdParamsSchema = z.object({ id: z.string().cuid() });
export const checkoutInputSchema = z.object({ projectId: z.string().cuid().optional() }).strict().default({});
export const jobIdParamsSchema = z.object({ id: z.string().cuid() });
export const creatorParamsSchema = z.object({ id: z.string().cuid() });
export const creatorClipParamsSchema = z.object({ clipId: z.string().cuid() });
export const creatorListQuerySchema = z.object({
  search: z.string().trim().min(1).max(120).optional(),
  tag: z.string().trim().min(1).max(80).optional(),
});

export const supportRequestSchema = z.object({
  email: emailSchema,
  message: z.string().trim().min(20).max(4000),
  website: z.string().max(2048).optional().default(''),
}).strict();
export const supportIdParamsSchema = z.object({ id: z.string().cuid() });
export const supportStatusSchema = z.enum(['NEW', 'OPEN', 'RESOLVED']);
export const supportListQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  status: supportStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export const supportUpdateSchema = z.object({
  status: z.enum(['OPEN', 'RESOLVED']),
}).strict();

export const adminListQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  status: z.string().trim().max(40).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
}).strict();
export const adminIdParamsSchema = z.object({ id: z.string().cuid() });

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
export const conceptStageInputSchema = z.object({
  count: z.number().int().min(1).max(8).default(8),
  forceRegenerate: z.boolean().default(false),
  useHookPreferences: z.boolean().default(true),
  append: z.boolean().default(false),
}).strict();
export const conceptReviewParamsSchema = projectIdParamsSchema.extend({
  conceptId: z.string().trim().min(1).max(128),
});
export const conceptReviewSchema = z.object({
  decision: z.enum(['LIKED', 'REJECTED']).nullable(),
  creatorId: z.string().cuid().optional(),
  clipId: z.string().cuid().optional(),
}).strict();
export const conceptReviewResetSchema = z.object({
  clearDependentOutputs: z.boolean().default(false),
}).strict();
export const hookPreferenceExampleSchema = z.object({
  hookText: z.string().trim().min(1).max(240),
  demoOverlayText: z.string().trim().min(1).max(240),
  angle: z.string().trim().min(1).max(240),
  score: z.number().int(),
  selectedAt: z.coerce.date(),
}).strict();
const currentHookPreferencesSchema = z.object({
  liked: z.array(hookPreferenceExampleSchema).max(8),
  rejected: z.array(hookPreferenceExampleSchema).max(8),
  patterns: z.array(z.string().trim().min(1).max(240)).max(50).default([]),
  updatedAt: z.coerce.date(),
}).strict().refine((value) => value.liked.length + value.rejected.length <= 8, {
  message: "At most eight hook preferences are allowed",
});
const legacyHookPreferencesSchema = z.object({
  examples: z.array(hookPreferenceExampleSchema).min(1).max(8),
  updatedAt: z.coerce.date(),
}).strict();
export const hookPreferencesSchema = z.union([currentHookPreferencesSchema, legacyHookPreferencesSchema]).transform((value) => "examples" in value
  ? { ...value, patterns: [] as string[], liked: value.examples, rejected: [] as z.infer<typeof hookPreferenceExampleSchema>[] }
  : { ...value, examples: [] as z.infer<typeof hookPreferenceExampleSchema>[] });
const currentHookPreferenceSelectionSchema = z.object({
  // Ownership is checked against the loaded project below. Do not require a
  // particular database ID encoding here; older projects may contain IDs
  // created before the current Prisma default was introduced.
  likedConceptIds: z.array(z.string().trim().min(1).max(128)).max(8).default([]),
  rejectedConceptIds: z.array(z.string().trim().min(1).max(128)).max(8).default([]),
}).strict().superRefine((value, context) => {
  const decisionCount = value.likedConceptIds.length + value.rejectedConceptIds.length;
  if (decisionCount === 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "At least one hook decision is required" });
  }
  if (decisionCount > 8) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "At most eight hook decisions are allowed" });
  }
  if (new Set(value.likedConceptIds).size !== value.likedConceptIds.length
    || new Set(value.rejectedConceptIds).size !== value.rejectedConceptIds.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "A hook decision cannot be repeated" });
  }
  const rejectedIds = new Set(value.rejectedConceptIds);
  if (value.likedConceptIds.some((conceptId) => rejectedIds.has(conceptId))) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "A hook cannot be both liked and rejected" });
  }
});
export const hookPreferenceSelectionSchema = currentHookPreferenceSelectionSchema
  .or(z.object({ conceptIds: z.array(z.string().trim().min(1).max(128)).min(1).max(8) }).strict()
    .refine((value) => new Set(value.conceptIds).size === value.conceptIds.length, {
      message: "A hook cannot be selected more than once",
    }))
  .transform((value) => "conceptIds" in value
    ? { ...value, likedConceptIds: value.conceptIds, rejectedConceptIds: [], legacy: true as const }
    : { ...value, conceptIds: [] as string[], legacy: false as const });
export const hookPreferencesUpdateSchema = z.object({
  liked: z.array(hookPreferenceExampleSchema).max(8),
  rejected: z.array(hookPreferenceExampleSchema).max(8),
  patterns: z.array(z.string().trim().min(1).max(240)).max(50).optional(),
}).strict().refine((value) => value.liked.length + value.rejected.length <= 8, {
  message: "At most eight hook preferences are allowed",
});
export const conceptEditSchema = z.object({
  hookText: z.string().trim().min(1).max(240),
  demoOverlayText: z.string().trim().min(1).max(240),
}).strict();
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
  description: z.string().min(1).nullable(),
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
  description: z.string().trim().optional(),
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

export const projectCreatorSelectionSchema = z.object({
  mode: z.enum(['single', 'mix']),
  characters: z.array(creatorCharacterSchema).min(1),
}).strict().superRefine((selection, context) => {
  if (selection.mode === 'single' && selection.characters.length !== 1) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Single creator selections must contain exactly one creator',
      path: ['characters'],
    });
  }
  if (selection.mode === 'mix' && selection.characters.length < 2) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Mixed creator selections require at least two creators',
      path: ['characters'],
    });
  }
});

const creatorSelectionRequestSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('mix') }).strict(),
  z.object({ mode: z.literal('single'), creatorId: z.string().cuid() }).strict(),
]);

export const characterSelectionSchema = z.union([
  z.object({ character: creatorCharacterSchema.nullable() }).strict(),
  z.object({ selection: creatorSelectionRequestSchema }).strict(),
]);

export const userRoleSchema = z.enum(['USER', 'ADMIN']);
export const projectStatusSchema = z.enum(['DRAFT', 'ANALYZING', 'READY', 'HOOKS_READY', 'SCRIPTS_READY', 'MEDIA_READY', 'EXPORT_READY', 'FAILED']);
export const analysisExtractionStatusSchema = z.enum(['success', 'failed']);
export const analysisExtractionSourceSchema = z.enum(['firecrawl', 'fallback']);
export const jobStatusSchema = z.enum(['QUEUED', 'ACTIVE', 'COMPLETED', 'FAILED', 'CANCELLED']);
export const jobTypeSchema = z.enum(['ANALYZE_WEBSITE', 'GENERATE_CONCEPTS', 'GENERATE_MEDIA', 'SAVE_EXPORT', 'GENERATE_HOOKS', 'GENERATE_SCRIPTS', 'RENDER_REELS']);

export const renderRequestSchema = z.object({
  conceptIds: z.array(z.string().cuid()).min(1).max(8).optional(),
  assignments: z.array(z.object({
    conceptId: z.string().cuid(),
    clipId: z.string().cuid(),
  }).strict()).min(1).max(8).optional(),
}).strict();
export const mediaTypeSchema = z.enum(['IMAGE', 'VIDEO']);

export const authUserSchema = z.object({
  id: z.string().cuid(),
  email: emailSchema,
  name: z.string().nullable(),
  role: userRoleSchema,
}).strict();

export const brandProfileSchema = z.object({
  id: z.string().cuid(),
  projectId: z.string().cuid(),
  brandName: z.string().min(1),
  productSummary: z.string().min(1),
  targetAudience: z.string().min(1),
  customerProblems: z.array(z.string().min(1)).min(1).max(5),
  keyBenefits: z.array(z.string().min(1)).min(1).max(5),
  proofPoints: z.array(z.string().min(1)).max(5),
  claimConstraints: z.array(z.string().min(1)).max(4),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
}).strict();
export const brandProfileUpdateSchema = brandProfileSchema.omit({ id: true, projectId: true, createdAt: true, updatedAt: true });
export const brandProfileConfirmationSchema = brandProfileUpdateSchema;
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
  hookPreferences: hookPreferencesSchema.nullable(),
  brandProfileConfirmedAt: z.coerce.date().nullable(),
}).strict();

export const projectSnapshotSchema = projectSchema.extend({
  brandProfile: brandProfileSchema.nullable(),
  websiteAnalysis: websiteAnalysisSchema.nullable(),
  concepts: z.array(conceptCardSchema),
  mediaAssets: z.array(mediaAssetSchema),
  exportState: projectExportSchema.nullable(),
  jobs: z.array(generationJobSchema),
  selectedCharacter: creatorCharacterSchema.nullable(),
  creatorSelection: projectCreatorSelectionSchema.nullable(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type AuthUser = z.infer<typeof authUserSchema>;
export type WebsiteInput = z.infer<typeof websiteInputSchema>;
export type StageInput = z.infer<typeof stageInputSchema>;
export type ConceptStageInput = z.infer<typeof conceptStageInputSchema>;
export type HookPreferenceExample = z.infer<typeof hookPreferenceExampleSchema>;
export type HookPreferences = z.infer<typeof hookPreferencesSchema>;
export type MediaStageInput = z.infer<typeof mediaStageInputSchema>;
export type ExportState = z.infer<typeof exportStateSchema>;
export type BrandProfile = z.infer<typeof brandProfileSchema>;
export type WebsiteAnalysisHomepage = z.infer<typeof websiteAnalysisHomepageSchema>;
export type WebsiteAnalysis = z.infer<typeof websiteAnalysisSchema>;
export type CreatorCharacter = z.infer<typeof creatorCharacterSchema>;
export type ProjectCreatorSelection = z.infer<typeof projectCreatorSelectionSchema>;
export type CreatorRecord = z.infer<typeof creatorSchema>;
export type CreatorClipRecord = z.infer<typeof creatorClipSchema>;
export type ConceptCard = z.infer<typeof conceptCardSchema>;
export type MediaAsset = z.infer<typeof mediaAssetSchema>;
export type ProjectExport = z.infer<typeof projectExportSchema>;
export type GenerationJob = z.infer<typeof generationJobSchema>;
export type ProjectSnapshot = z.infer<typeof projectSnapshotSchema>;
export type CharacterSelection = z.infer<typeof characterSelectionSchema>;
