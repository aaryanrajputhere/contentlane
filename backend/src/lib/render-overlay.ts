function clean(value: string | null | undefined) { return value?.trim() || null; }
export function extractDomain(value: string | null | undefined) {
  const source = clean(value);
  if (!source) return null;
  try { return new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(source) ? source : `https://${source}`).hostname.replace(/^www\./i, ''); }
  catch { return source.replace(/^[a-z][a-z\d+.-]*:\/\//i, '').split(/[/?#]/, 1)[0].replace(/^www\./i, ''); }
}
export function composeDemoOverlayText(original: string, index: number, brandName: string | null | undefined, rootDomain: string | null | undefined, website: string) {
  const text = original.trim();
  const name = index % 2 === 0 ? clean(brandName) : extractDomain(rootDomain) ?? extractDomain(website);
  if (!name || text.toLocaleLowerCase().includes(name.toLocaleLowerCase())) return text;
  return text ? `${name} — ${text}` : name;
}
