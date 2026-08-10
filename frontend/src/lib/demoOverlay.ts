function cleanValue(value: string | null | undefined) {
  const cleaned = value?.trim();
  return cleaned || null;
}

export function extractDomain(value: string | null | undefined) {
  const cleaned = cleanValue(value);
  if (!cleaned) return null;

  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`);
    return url.hostname.replace(/^www\./i, '') || null;
  } catch {
    return cleaned
      .replace(/^[a-z][a-z\d+.-]*:\/\//i, '')
      .split(/[/?#]/, 1)[0]
      .replace(/^www\./i, '')
      .trim() || null;
  }
}

function containsText(text: string, value: string) {
  return text.toLocaleLowerCase().includes(value.toLocaleLowerCase());
}

export function composeDemoOverlayText(
  originalOverlay: string,
  conceptIndex: number,
  brandName: string | null | undefined,
  rootDomain: string | null | undefined,
  website: string | null | undefined,
) {
  const original = originalOverlay.trim();
  const brand = cleanValue(brandName);
  const domain = extractDomain(rootDomain) ?? extractDomain(website);
  const selectedName = conceptIndex % 2 === 0 ? brand : domain;

  if (!selectedName || containsText(original, selectedName)) return original;
  return original ? `${selectedName} — ${original}` : selectedName;
}
