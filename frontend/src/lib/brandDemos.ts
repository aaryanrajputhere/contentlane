import type { MediaAsset, ProjectSnapshot } from '../types/domain';

export function isBrandDemo(asset: MediaAsset) {
  return asset.conceptId === null && asset.type === 'VIDEO' && asset.metadata?.kind === 'brand-demo';
}

export function brandDemos(project: Pick<ProjectSnapshot, 'mediaAssets'>) {
  return project.mediaAssets.filter(isBrandDemo).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export function brandDemoName(asset: MediaAsset) {
  const displayName = asset.metadata?.displayName;
  if (typeof displayName === 'string' && displayName.trim()) return displayName.trim();
  const originalName = asset.metadata?.originalName;
  if (typeof originalName === 'string' && originalName.trim()) return originalName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
  return 'Product demo';
}
