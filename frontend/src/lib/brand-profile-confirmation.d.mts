import type { BrandProfile, ProjectSnapshot } from '../types/domain';

type EditableBrandProfile = Pick<BrandProfile, 'brandName' | 'productSummary' | 'targetAudience' | 'customerProblems' | 'keyBenefits' | 'proofPoints' | 'claimConstraints'>;

export function brandProfileValidationError(profile: EditableBrandProfile): string | null;
export function requiresBrandProfileConfirmation(project: ProjectSnapshot): boolean;
