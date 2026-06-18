import { detectStoreCountry } from './storeCountryDetector.js';
import { updateLeadStoreCountry } from './leadStoreRepository.js';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function fetchText(url, timeout = 12000) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const res = await fetch(url, {
      headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html,application/json' },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timer);
    return await res.text();
  } catch {
    return '';
  }
}

/**
 * Re-run country detector for one qualified store (no full pipeline / no re-reject).
 */
export async function reclassifyCountryForLeadStore(store) {
  const origin = store.storeUrl;
  let hostname = '';
  try {
    hostname = new URL(origin).hostname.replace(/^www\./, '');
  } catch {
    throw new Error('Invalid store URL');
  }

  const html = await fetchText(`${origin}/`);
  const countryResult = await detectStoreCountry({
    origin,
    hostname,
    html,
    currency: store.currency,
  });

  const phaseData = {
    ...(store.phaseData || {}),
    phase3: countryResult,
    countryClassifiedAt: new Date().toISOString(),
  };

  await updateLeadStoreCountry(store.id, {
    countryCode: countryResult.countryCode,
    phaseData,
  });

  return countryResult;
}
