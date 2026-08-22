export const PENDING_WEBSITE_KEY: string;
export function normalizePendingWebsite(value: string): string | null;
export function savePendingWebsite(value: string): string | null;
export function isFreeConversionRequired(input: {
  isFreeFlow: boolean;
  ended: boolean;
  selected: number;
  generated: number;
  reviewed: number;
  limit?: number;
}): boolean;
