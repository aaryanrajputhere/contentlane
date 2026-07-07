export type UserRole = 'USER' | 'ADMIN';
export type ProjectStatus = 'DRAFT' | 'ANALYZING' | 'READY' | 'HOOKS_READY' | 'SCRIPTS_READY' | 'MEDIA_READY' | 'EXPORT_READY' | 'FAILED';
export type JobStatus = 'QUEUED' | 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type JobType = 'ANALYZE_WEBSITE' | 'GENERATE_CONCEPTS' | 'GENERATE_MEDIA' | 'SAVE_EXPORT' | 'GENERATE_HOOKS' | 'GENERATE_SCRIPTS';
export type MediaType = 'IMAGE' | 'VIDEO';
export type CharacterSource = 'preset' | 'custom';

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
  tagline: string;
  audience: string;
  painPoints: string[];
  benefits: string[];
  voice: string;
  offer: string;
  cta: string;
  angles: string[];
  summary: string;
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
  createdAt: string;
  updatedAt: string;
}

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
  concepts: ConceptCard[];
  mediaAssets: MediaAsset[];
  exportState: ProjectExport | null;
  jobs: GenerationJob[];
  selectedConceptId: string | null;
  selectedCharacterId: string | null;
  selectedCharacter: CreatorCharacter | null;
}

export interface ProjectResponse {
  project: ProjectSnapshot;
  cached?: boolean;
  job?: GenerationJob;
  brandProfile?: BrandProfile;
}
