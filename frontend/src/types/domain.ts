export interface AuthUser { id: string; email: string; name: string | null; role: 'USER' | 'ADMIN' }
export interface HookOption { text: string; score: number }
export type HookGroups = Record<string, HookOption[]>;
export interface ScriptHookSceneBrief { purpose: string; context: string; requiredVisualChange: string; overlayTextDirection: string }
export interface ScriptHookSpec { text: string; templateType?: string; sceneDurationSeconds: number; scenes: ScriptHookSceneBrief[] }
export type ScriptHookInput = string | ScriptHookSpec;
export interface HookTemplate { id: string; title: string; text: string; templateType: string; sceneDurationSeconds: number; scenes: ScriptHookSceneBrief[]; sortOrder: number; isActive: boolean; createdAt: string; updatedAt: string }
export interface BrandContext { campaignId: string; brandName: string; productCategory: string; productSummary: string; targetAudience: string[]; benefits: string[]; customerDesires: string[]; emotionalTriggers: string[]; hooks?: HookGroups | null }
export interface Product { id: string; campaignId: string; name: string; description: string; imageUrls: string[]; url: string | null }
export interface Creator { id: string; name: string; description: string | null; imageUrl: string | null }
export interface Scene { onScreenText: string; imagePrompt: string; featuresCharacter: boolean; featuresProduct: boolean; durationSeconds: number; generatedImageUrl?: string; generatedVideoUrl?: string; error?: string }
export interface Script { id: string; campaignId: string; productId: string; hook: string; scenes: Scene[]; templateType: string; cta: string; durationSeconds: number }
export interface CampaignResponse { campaignId: string; website: string; status: string; brandContext: BrandContext | null; products: Product[] }
export interface GenerationJob { id: string; type: string; status: 'QUEUED' | 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'CANCELLED'; progress: number; progressMessage: string | null; result: unknown; errorMessage: string | null; campaignId: string | null; scriptId: string | null }
export interface QuotaItem { limit: number; used: number; remaining: number }
