export function storeDisplayName(storeUrl) {
  if (!storeUrl) return 'Store';
  try {
    const host = new URL(storeUrl).hostname.replace(/^www\./, '');
    return host || storeUrl;
  } catch {
    return storeUrl;
  }
}

export function storeFaviconUrl(storeUrl) {
  const name = storeDisplayName(storeUrl);
  if (!name || name === 'Store') return null;
  return `https://icons.duckduckgo.com/ip3/${encodeURIComponent(name)}.ico`;
}
