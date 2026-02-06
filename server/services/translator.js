/**
 * Translate non-English page text to English before email extraction.
 * Uses LibreTranslate (self-hosted or public API). French/Spanish → English.
 */

const BASE_URL = (process.env.LIBRE_TRANSLATE_URL || 'https://libretranslate.com').replace(/\/$/, '');
const API_KEY = process.env.LIBRE_TRANSLATE_API_KEY || '';
const MAX_TEXT_LENGTH = 4500;
const CHUNK_SIZE = 4000;
const REQUEST_TIMEOUT_MS = 15000;

/**
 * Strip HTML to plain text for translation (keeps email-like strings in flow).
 */
export function htmlToText(html) {
  if (!html || typeof html !== 'string') return '';
  let text = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return text;
}

/** Sample length for language detection (enough to detect, not too big). */
const DETECT_SAMPLE_LENGTH = 500;

/**
 * Detect language of text. Returns language code (e.g. 'en', 'fr') or null on failure.
 */
async function detectLanguage(text) {
  if (!text || text.length < 30) return null;
  const sample = text.length > DETECT_SAMPLE_LENGTH ? text.slice(0, DETECT_SAMPLE_LENGTH) : text;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const body = { q: sample };
    if (API_KEY) body.api_key = API_KEY;
    const res = await fetch(`${BASE_URL}/detect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    const first = Array.isArray(data) && data[0];
    const code = first?.language;
    return typeof code === 'string' ? code.toLowerCase() : null;
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

/**
 * Call LibreTranslate API for one chunk of text.
 */
async function translateChunk(toSend) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const body = {
      q: toSend,
      source: 'auto',
      target: 'en',
      format: 'text',
    };
    if (API_KEY) body.api_key = API_KEY;
    const res = await fetch(`${BASE_URL}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    const translated = data?.translatedText;
    return typeof translated === 'string' ? translated : null;
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

/**
 * Split text into chunks at natural boundaries (space/newline) to avoid cutting mid-word.
 */
function chunkText(text, maxLen) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + maxLen, text.length);
    if (end < text.length) {
      const lastSpace = text.lastIndexOf(' ', end);
      const lastNewline = text.lastIndexOf('\n', end);
      const lastBreak = Math.max(lastSpace, lastNewline);
      if (lastBreak > start) end = lastBreak + 1;
    }
    chunks.push(text.slice(start, end).trim());
    start = end;
  }
  return chunks.filter(Boolean);
}

/**
 * Translate text to English only if the text is not already English.
 * Uses language detection first; if English is detected, returns null (no translation).
 * Otherwise translates (e.g. French, Spanish) in chunks and returns concatenated result.
 * Returns translated string or null on failure/skip/already-English.
 */
export async function translateToEnglish(text) {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (trimmed.length < 50) return null;

  const detected = await detectLanguage(trimmed);
  if (detected === 'en') return null;

  const chunks = chunkText(trimmed, CHUNK_SIZE);
  const results = [];
  for (const chunk of chunks) {
    if (chunk.length < 20) continue;
    const translated = await translateChunk(chunk);
    if (translated) results.push(translated);
    else results.push(chunk);
  }
  if (results.length === 0) return null;
  return results.join(' ');
}
