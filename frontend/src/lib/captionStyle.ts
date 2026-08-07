export type CaptionStyle = 'SNAPCHAT' | 'STANDARD';

export function getCaptionStyle(sortOrder: number): CaptionStyle {
  return sortOrder % 2 === 0 ? 'SNAPCHAT' : 'STANDARD';
}
