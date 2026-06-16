/** Extract YouTube video ID from common URL formats. */
export function getYoutubeVideoId(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  try {
    const u = new URL(trimmed);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = u.pathname.replace(/^\//, '').split('/')[0];
      return id || null;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (u.pathname === '/watch') return u.searchParams.get('v') || null;
      const m = u.pathname.match(/^\/(embed|shorts|v)\/([^/?]+)/);
      if (m) return m[2];
    }
  } catch (_) {
    /* not a URL */
  }
  return null;
}
