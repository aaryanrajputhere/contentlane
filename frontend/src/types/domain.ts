export type UserRole = 'USER' | 'ADMIN';
export type ProjectStatus = 'DRAFT' | 'ANALYZING' | 'READY' | 'HOOKS_READY' | 'SCRIPTS_READY' | 'MEDIA_READY' | 'EXPORT_READY' | 'FAILED';
export type JobStatus = 'QUEUED' | 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type JobType = 'ANALYZE_WEBSITE' | 'GENERATE_CONCEPTS' | 'GENERATE_MEDIA' | 'SAVE_EXPORT' | 'GENERATE_HOOKS' | 'GENERATE_SCRIPTS' | 'RENDER_REELS';
export type MediaType = 'IMAGE' | 'VIDEO';
export type CharacterSource = 'preset' | 'custom';
export type SupportStatus = 'NEW' | 'OPEN' | 'RESOLVED';
export interface SupportRequest { id: string; email: string; message: string; userId: string | null; status: SupportStatus; createdAt: string; updatedAt: string; resolvedAt: string | null; user: { id: string; name: string | null; email: string } | null; }
export interface SupportListResponse { requests: SupportRequest[]; counts: Record<SupportStatus, number>; pagination: { page: number; pageSize: number; total: number; totalPages: number }; }
export interface AdminProjectRow { id: string; website: string; normalizedWebsite: string; status: ProjectStatus; createdAt: string; updatedAt: string; user: { id: string; name: string | null; email: string } | null; _count: { concepts: number; mediaAssets: number; jobs: number }; }
export interface AdminUserRow { id: string; name: string | null; email: string; role: UserRole; createdAt: string; updatedAt: string; _count: { projects: number; supportRequests: number; subscriptions: number }; }
export interface AdminJobRow { id: string; projectId: string; type: JobType; status: JobStatus; progress: number; progressMessage: string | null; errorMessage: string | null; createdAt: string; updatedAt: string; project: { website: string; user: { email: string } | null }; }
export interface AdminOverview { metrics: { users: number; projects: number; jobs: number; activeSubscriptions: number }; projectStatuses: Record<string, number>; jobStatuses: Record<string, number>; recentUsers: AdminUserRow[]; recentProjects: AdminProjectRow[]; recentJobs: Array<AdminJobRow & { project: { id: string; website: string; user: { email: string } | null } }>; }
export interface AdminRenderReel { conceptId: string; creatorName: string; demoAssetId: string; demoName: string; sortOrder: number; url: string; mimeType: string; format: string; }
export interface AdminRenderBatch { id: string; completedAt: string; reels: AdminRenderReel[]; }
export interface AdminProjectDetail extends AdminProjectRow { defaultBrandDemoAssetId: string | null; brandProfile: BrandProfile | null; websiteAnalysis: { id: string; sourceUrl: string; rootDomain: string; sourceContentFingerprint: string | null; createdAt: string; updatedAt: string } | null; concepts: Array<{ id: string; angle: string; hookText: string; score: number; scoreLabel: string; reviewDecision: 'LIKED' | 'REJECTED' | null; sortOrder: number; createdAt: string; updatedAt: string }>; mediaAssets: Array<{ id: string; conceptId: string | null; type: MediaType; provider: string; url: string; mimeType: string | null; metadata: Record<string, unknown> | null; createdAt: string }>; exportState: { id: string; settings: unknown; createdAt: string; updatedAt: string } | null; jobs: Array<{ id: string; type: JobType; status: JobStatus; progress: number; progressMessage: string | null; errorMessage: string | null; createdAt: string; updatedAt: string }>; renderBatches: AdminRenderBatch[]; }

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest extends LoginRequest {
  name: string;
}

export interface AuthResponse {
  user: AuthUser;
}

export interface BillingStatus {
  planId: 'starter' | 'pro' | null;
  planName: string | null;
  price: number | null;
  isLegacyPlan: boolean;
  currency: string;
  plans: Array<{
    id: 'starter' | 'pro';
    name: 'Starter' | 'Pro';
    price: number;
    currency: 'USD';
    interval: 'month';
    videoLimit: number;
  }>;
  status: string;
  hasAccess: boolean;
  accessTier: 'admin' | 'subscriber' | 'free' | 'none';
  renewalDate: string | null;
  cancelAtPeriodEnd: boolean;
  scheduledPlanId: 'starter' | 'pro' | null;
  videoUsage: {
    limit: number | null;
    consumed: number;
    reserved: number;
    remaining: number | null;
    periodStart: string | null;
    periodEnd: string | null;
  };
  freeAccess: {
    projectId: string | null;
    limit: number;
    generated: number;
    reviewed: number;
    selected: number;
    remaining: number;
    conversionRequired: boolean;
    ended: boolean;
  };
}

export interface CreatorCharacter {
  id: string;
  source: CharacterSource;
  name: string;
  persona: string;
  appearance: string;
  voice: string;
  prompt: string;
  baseImageUrl?: string | null;
  baseImageProvider?: string | null;
  baseImageMimeType?: string | null;
  clipCount?: number;
  clipTags?: string[];
}

export type CreatorSelectionMode = 'single' | 'mix';

export interface CreatorSelection {
  mode: CreatorSelectionMode;
  characters: CreatorCharacter[];
}

export interface CreatorClipRecord {
  id: string;
  creatorId: string;
  title: string | null;
  url: string;
  provider: string;
  providerId: string | null;
  mimeType: string | null;
  metadata: Record<string, unknown> | null;
  tags: string[];
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreatorRecord {
  id: string;
  name: string;
  description: string | null;
  baseImageUrl: string;
  baseImageProvider: string;
  baseImageProviderId: string | null;
  baseImageMimeType: string | null;
  baseImageMetadata: Record<string, unknown> | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  clipCount: number;
  clips: CreatorClipRecord[];
  character: CreatorCharacter;
}

export interface BrandProfile {
  id: string;
  projectId: string;
  brandName: string;
  productSummary: string;
  targetAudience: string;
  customerProblems: string[];
  keyBenefits: string[];
  proofPoints: string[];
  claimConstraints: string[];
  createdAt: string;
  updatedAt: string;
}

export type AnalysisExtractionStatus = 'success' | 'failed';
export type AnalysisExtractionSource = 'firecrawl' | 'fallback';

export interface WebsiteAnalysisHomepage {
  url: string;
  title?: string | null;
  metaDescription?: string | null;
  visibleTextSnippet: string;
  extractedTextSnippet?: string | null;
  canonicalUrl?: string | null;
  extractionStatus?: AnalysisExtractionStatus;
  extractionSource?: AnalysisExtractionSource;
  extractionError?: string | null;
}

export interface WebsiteAnalysis {
  id: string;
  projectId: string;
  sourceUrl: string;
  rootDomain: string;
  homepage: WebsiteAnalysisHomepage;
  createdAt: string;
  updatedAt: string;
}

export interface ConceptCard {
  id: string;
  projectId: string;
  angle: string;
  hookText: string;
  hookImagePrompt: string;
  demoOverlayText: string;
  videoDirection: string;
  targetDurationLabel: string;
  targetDurationSeconds: number;
  score: number;
  scoreLabel: string;
  rationale: string;
  generatedImageUrl: string | null;
  generatedVideoUrl: string | null;
  sortOrder: number;
  reviewDecision: 'LIKED' | 'REJECTED' | null;
  assignedCreatorId?: string | null;
  assignedClipId?: string | null;
  assignedBrandDemoAssetId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HookPreferenceExample {
  hookText: string;
  demoOverlayText: string;
  angle: string;
  score: number;
  selectedAt: string;
}

export interface HookPreferences {
  liked: HookPreferenceExample[];
  rejected: HookPreferenceExample[];
  patterns: string[];
  language?: GenerationLanguage;
  /** Legacy first-version preferences, normalized by the API when used. */
  examples?: HookPreferenceExample[];
  updatedAt: string;
}

export type GenerationLanguage = 'English' | 'Spanish' | 'French' | 'German' | 'Portuguese' | 'Hindi' | 'Arabic' | 'Japanese' | 'Korean';

export interface MediaAsset {
  id: string;
  projectId: string;
  conceptId: string | null;
  type: MediaType;
  provider: string;
  providerId: string | null;
  url: string;
  mimeType: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface ExportState {
  selectedConceptId: string | null;
  selectedCharacterId: string | null;
  selectedCharacterName: string | null;
  selectedCharacterSource: CharacterSource | null;
  selectedCreatorClipId?: string | null;
  selectedImageId: string | null;
  selectedVideoId: string | null;
  creatorOverlayText?: string;
  brandDemoOverlayText?: string;
  overlayText: string;
  notes?: string | null;
}

export interface ProjectExport {
  id: string;
  projectId: string;
  settings: ExportState;
  createdAt: string;
  updatedAt: string;
}

export interface GenerationJob {
  id: string;
  projectId: string;
  type: JobType;
  status: JobStatus;
  progress: number;
  progressMessage: string | null;
  input: Record<string, unknown>;
  result: unknown | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSnapshot {
  id: string;
  website: string;
  normalizedWebsite: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  brandProfile: BrandProfile | null;
  websiteAnalysis: WebsiteAnalysis | null;
  concepts: ConceptCard[];
  mediaAssets: MediaAsset[];
  exportState: ProjectExport | null;
  jobs: GenerationJob[];
  selectedConceptId: string | null;
  selectedCharacterId: string | null;
  selectedCharacter: CreatorCharacter | null;
  creatorSelection: CreatorSelection | null;
  hookPreferences: HookPreferences | null;
  brandProfileConfirmedAt: string | null;
  defaultBrandDemoAssetId: string | null;
}

export interface ProjectResponse {
  project: ProjectSnapshot;
  cached?: boolean;
  job?: GenerationJob;
  brandProfile?: BrandProfile;
}

export interface ProjectListItem {
  id: string;
  website: string;
  normalizedWebsite: string;
  status: ProjectStatus;
  updatedAt: string;
  brandProfile: { brandName: string } | null;
  _count: { concepts: number; jobs: number };
}
