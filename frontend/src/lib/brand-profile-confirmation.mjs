export function brandProfileValidationError(profile) {
  if (!profile.brandName.trim() || !profile.productSummary.trim() || !profile.targetAudience.trim()) {
    return 'Add a brand name, product summary, and target audience.';
  }
  if (profile.customerProblems.length === 0 || profile.keyBenefits.length === 0) {
    return 'Add at least one customer problem and one key benefit.';
  }
  if (profile.customerProblems.length > 5 || profile.keyBenefits.length > 5 || profile.proofPoints.length > 5 || profile.claimConstraints.length > 4) {
    return 'Use up to 5 problems, benefits, and proof points, and up to 4 claim constraints.';
  }
  return null;
}

export function requiresBrandProfileConfirmation(project) {
  return Boolean(project.brandProfile && !project.brandProfileConfirmedAt && project.concepts.length === 0);
}
