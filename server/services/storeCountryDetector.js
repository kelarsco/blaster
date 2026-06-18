import { COUNTRY_BY_CODE } from '../data/countries.js';

const UA_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9,es;q=0.8',
};

/** Suffix patterns — longest match first */
const TLD_RULES = [
  { re: /\.com\.mx$|\.mx$/i, code: 'MX', id: 'tld_mx' },
  { re: /\.com\.br$|\.br$/i, code: 'BR', id: 'tld_br' },
  { re: /\.com\.ar$|\.ar$/i, code: 'AR', id: 'tld_ar' },
  { re: /\.com\.au$|\.au$/i, code: 'AU', id: 'tld_au' },
  { re: /\.co\.uk$|\.uk$/i, code: 'GB', id: 'tld_gb' },
  { re: /\.com\.co$|\.co$/i, code: 'CO', id: 'tld_co' },
  { re: /\.com\.pe$|\.pe$/i, code: 'PE', id: 'tld_pe' },
  { re: /\.com\.ph$|\.ph$/i, code: 'PH', id: 'tld_ph' },
  { re: /\.co\.za$|\.za$/i, code: 'ZA', id: 'tld_za' },
  { re: /\.com\.ng$|\.ng$/i, code: 'NG', id: 'tld_ng' },
  { re: /\.es$/i, code: 'ES', id: 'tld_es' },
  { re: /\.ca$/i, code: 'CA', id: 'tld_ca' },
  { re: /\.de$/i, code: 'DE', id: 'tld_de' },
  { re: /\.fr$/i, code: 'FR', id: 'tld_fr' },
  { re: /\.cl$/i, code: 'CL', id: 'tld_cl' },
  { re: /\.pl$/i, code: 'PL', id: 'tld_pl' },
  { re: /\.gt$/i, code: 'GT', id: 'tld_gt' },
  { re: /\.in$/i, code: 'IN', id: 'tld_in' },
  { re: /\.my$/i, code: 'MY', id: 'tld_my' },
  { re: /\.ae$/i, code: 'AE', id: 'tld_ae' },
  { re: /\.sa$/i, code: 'SA', id: 'tld_sa' },
  { re: /\.nz$/i, code: 'NZ', id: 'tld_nz' },
  { re: /\.ie$/i, code: 'IE', id: 'tld_ie' },
  { re: /\.it$/i, code: 'IT', id: 'tld_it' },
  { re: /\.nl$/i, code: 'NL', id: 'tld_nl' },
  { re: /\.se$/i, code: 'SE', id: 'tld_se' },
  { re: /\.no$/i, code: 'NO', id: 'tld_no' },
  { re: /\.dk$/i, code: 'DK', id: 'tld_dk' },
  { re: /\.pt$/i, code: 'PT', id: 'tld_pt' },
  { re: /\.jp$/i, code: 'JP', id: 'tld_jp' },
  { re: /\.kr$/i, code: 'KR', id: 'tld_kr' },
  { re: /\.us$/i, code: 'US', id: 'tld_us' },
  { re: /\.ec$/i, code: 'EC', id: 'tld_ec' },
  { re: /\.pr$/i, code: 'PR', id: 'tld_pr' },
];

/** Near-unique currencies → country */
const UNIQUE_CURRENCY = {
  MXN: { code: 'MX', id: 'currency_MXN' },
  BRL: { code: 'BR', id: 'currency_BRL' },
  ARS: { code: 'AR', id: 'currency_ARS' },
  CLP: { code: 'CL', id: 'currency_CLP' },
  COP: { code: 'CO', id: 'currency_COP' },
  PEN: { code: 'PE', id: 'currency_PEN' },
  NGN: { code: 'NG', id: 'currency_NGN' },
  ZAR: { code: 'ZA', id: 'currency_ZAR' },
  INR: { code: 'IN', id: 'currency_INR' },
  JPY: { code: 'JP', id: 'currency_JPY' },
  KRW: { code: 'KR', id: 'currency_KRW' },
  AED: { code: 'AE', id: 'currency_AED' },
  SAR: { code: 'SA', id: 'currency_SAR' },
  SEK: { code: 'SE', id: 'currency_SEK' },
  NOK: { code: 'NO', id: 'currency_NOK' },
  DKK: { code: 'DK', id: 'currency_DKK' },
  PLN: { code: 'PL', id: 'currency_PLN' },
  MYR: { code: 'MY', id: 'currency_MYR' },
  PHP: { code: 'PH', id: 'currency_PHP' },
  GTQ: { code: 'GT', id: 'currency_GTQ' },
  THB: { code: 'TH', id: 'currency_THB' },
  VND: { code: 'VN', id: 'currency_VND' },
  TRY: { code: 'TR', id: 'currency_TRY' },
  HUF: { code: 'HU', id: 'currency_HUF' },
  CZK: { code: 'CZ', id: 'currency_CZK' },
  ILS: { code: 'IL', id: 'currency_ILS' },
  TWD: { code: 'TW', id: 'currency_TWD' },
  EGP: { code: 'EG', id: 'currency_EGP' },
  PKR: { code: 'PK', id: 'currency_PKR' },
  UAH: { code: 'UA', id: 'currency_UAH' },
  RON: { code: 'RO', id: 'currency_RON' },
  BGN: { code: 'BG', id: 'currency_BGN' },
  HRK: { code: 'HR', id: 'currency_HRK' },
  RSD: { code: 'RS', id: 'currency_RSD' },
  ISK: { code: 'IS', id: 'currency_ISK' },
  CAD: { code: 'CA', id: 'currency_CAD', weight: 25 },
  GBP: { code: 'GB', id: 'currency_GBP', weight: 25 },
  AUD: { code: 'AU', id: 'currency_AUD', weight: 25 },
  NZD: { code: 'NZ', id: 'currency_NZD', weight: 25 },
  CHF: { code: 'CH', id: 'currency_CHF', weight: 25 },
  EUR: { code: 'EU', id: 'currency_EUR', weight: 8 },
  USD: { code: 'US', id: 'currency_USD', weight: 5 },
};

const PHONE_PREFIX = [
  { re: /\+52[\s\-.]?\d/, code: 'MX', id: 'phone_52' },
  { re: /\+34[\s\-.]?\d/, code: 'ES', id: 'phone_34' },
  { re: /\+54[\s\-.]?\d/, code: 'AR', id: 'phone_54' },
  { re: /\+55[\s\-.]?\d/, code: 'BR', id: 'phone_55' },
  { re: /\+56[\s\-.]?\d/, code: 'CL', id: 'phone_56' },
  { re: /\+57[\s\-.]?\d/, code: 'CO', id: 'phone_57' },
  { re: /\+51[\s\-.]?\d/, code: 'PE', id: 'phone_51' },
  { re: /\+234[\s\-.]?\d/, code: 'NG', id: 'phone_234' },
  { re: /\+27[\s\-.]?\d/, code: 'ZA', id: 'phone_27' },
  { re: /\+91[\s\-.]?\d/, code: 'IN', id: 'phone_91' },
  { re: /\+63[\s\-.]?\d/, code: 'PH', id: 'phone_63' },
  { re: /\+60[\s\-.]?\d/, code: 'MY', id: 'phone_60' },
  { re: /\+971[\s\-.]?\d/, code: 'AE', id: 'phone_971' },
  { re: /\+966[\s\-.]?\d/, code: 'SA', id: 'phone_966' },
  { re: /\+44[\s\-.]?\d/, code: 'GB', id: 'phone_44' },
  { re: /\+61[\s\-.]?\d/, code: 'AU', id: 'phone_61' },
  { re: /\+64[\s\-.]?\d/, code: 'NZ', id: 'phone_64' },
  { re: /\+49[\s\-.]?\d/, code: 'DE', id: 'phone_49' },
  { re: /\+33[\s\-.]?\d/, code: 'FR', id: 'phone_33' },
  { re: /\+39[\s\-.]?\d/, code: 'IT', id: 'phone_39' },
  { re: /\+31[\s\-.]?\d/, code: 'NL', id: 'phone_31' },
  { re: /\+48[\s\-.]?\d/, code: 'PL', id: 'phone_48' },
  { re: /\+46[\s\-.]?\d/, code: 'SE', id: 'phone_46' },
];

const REGION_COUNTRY = [
  { re: /\bjalisco\b|\bcdmx\b|\bmonterrey\b|\bguadalajara\b|\bméxico\b|\bmexico\b/i, code: 'MX', id: 'region_mx' },
  { re: /\bmadrid\b|\bbarcelona\b|\bvalencia\b|\bsevilla\b|\bespaña\b|\bspain\b/i, code: 'ES', id: 'region_es' },
  { re: /\bsão paulo\b|\bsao paulo\b|\brio de janeiro\b|\bminas gerais\b|\bbrasil\b/i, code: 'BR', id: 'region_br' },
  { re: /\blagos\b|\babuja\b|\bport harcourt\b|\bnigeria\b/i, code: 'NG', id: 'region_ng' },
  { re: /\bgauteng\b|\bcape town\b|\bjohannesburg\b|\bsouth africa\b/i, code: 'ZA', id: 'region_za' },
  { re: /\bontario\b|\bbritish columbia\b|\bquebec\b|\balberta\b|\bcanada\b/i, code: 'CA', id: 'region_ca' },
  { re: /\bnew south wales\b|\bvictoria\b|\bqueensland\b|\baustralia\b/i, code: 'AU', id: 'region_au' },
  { re: /\bguatemala\b|envíos gratis a todo guatemala/i, code: 'GT', id: 'region_gt' },
  { re: /\bunited states\b|\b(u\.s\.a?|usa)\b/i, code: 'US', id: 'region_us_text' },
  { re: /\bcolombia\b/i, code: 'CO', id: 'region_co' },
  { re: /\bargentina\b/i, code: 'AR', id: 'region_ar' },
  { re: /\bchile\b/i, code: 'CL', id: 'region_cl' },
  { re: /\bperu\b|\bperú\b/i, code: 'PE', id: 'region_pe' },
  { re: /\bindia\b|\bmumbai\b|\bdelhi\b|\bbangalore\b/i, code: 'IN', id: 'region_in' },
  { re: /\bphilippines\b|\bmanila\b/i, code: 'PH', id: 'region_ph' },
  { re: /\bmalaysia\b|\bsingapore\b/i, code: 'MY', id: 'region_my' },
  { re: /\bfrance\b|\bparis\b/i, code: 'FR', id: 'region_fr' },
  { re: /\bgermany\b|\bberlin\b|\bdeutschland\b/i, code: 'DE', id: 'region_de' },
  { re: /\bunited kingdom\b|\blondon\b|\bengland\b|\bscotland\b/i, code: 'GB', id: 'region_gb' },
];

const US_STATES =
  /\b(california|texas|florida|new york|illinois|pennsylvania|ohio|georgia|north carolina|michigan|arizona|washington|colorado|massachusetts|tennessee|indiana|missouri|maryland|wisconsin|minnesota|south carolina|alabama|louisiana|kentucky|oregon|oklahoma|connecticut|utah|iowa|nevada|arkansas|mississippi|kansas|new mexico|nebraska|idaho|west virginia|hawaii|new hampshire|maine|montana|rhode island|delaware|south dakota|north dakota|alaska|vermont|wyoming)\b/i;

const SHIPPING_PHRASES = [
  { re: /ships from (?:our )?(?:warehouse in )?mexico|envíos desde méxico|envios desde mexico|envío desde/i, code: 'MX', id: 'shipping_mx' },
  { re: /ships from (?:our )?(?:warehouse in )?spain|envíos desde españa|entrega en toda españa/i, code: 'ES', id: 'shipping_es' },
  { re: /frete grátis no brasil|envio para todo o brasil|ships from brazil/i, code: 'BR', id: 'shipping_br' },
  { re: /dispatched from our warehouse in lagos|ships from lagos|ships from nigeria/i, code: 'NG', id: 'shipping_ng' },
  { re: /ships from (?:the )?united states|ships from (?:our )?(?:warehouse in )?(?:usa|u\.s\.a)/i, code: 'US', id: 'shipping_us' },
  { re: /free shipping to the usa|ships within the us\b/i, code: 'US', id: 'shipping_us_domestic' },
  { re: /ships from canada|shipping within canada/i, code: 'CA', id: 'shipping_ca' },
  { re: /ships from (?:the )?uk|ships from united kingdom/i, code: 'GB', id: 'shipping_gb' },
  { re: /ships from australia/i, code: 'AU', id: 'shipping_au' },
];

const LANG_NON_US = new Set(['es', 'pt', 'de', 'ar', 'hi', 'bn', 'tl', 'fil', 'ms', 'id', 'vi', 'th', 'ja', 'ko', 'ru', 'uk', 'pl', 'sv', 'no', 'da', 'fi', 'cs', 'ro', 'hu', 'el', 'he', 'tr']);

const LANG_COUNTRY_HINTS = {
  es: ['MX', 'ES', 'CO', 'AR', 'CL', 'PE'],
  pt: ['BR', 'PT'],
  fr: ['FR', 'CA', 'BE', 'SN'],
  de: ['DE', 'AT', 'CH'],
  ar: ['AE', 'SA', 'EG'],
  hi: ['IN'],
  bn: ['IN'],
  tl: ['PH'],
  fil: ['PH'],
  ms: ['MY'],
  id: ['ID'],
  af: ['ZA'],
};

const SPANISH_TEXT_RE =
  /\b(el|la|los|las|de|que|para|con|envío|envios|tienda|productos|comprar|gratis|pedido|entrega)\b/gi;
const PORTUGUESE_TEXT_RE =
  /\b(de|que|para|com|envio|frete|loja|produtos|comprar|grátis|pedido|entrega)\b/gi;

const CONTACT_PATHS = ['/pages/contact', '/pages/about-us', '/pages/about', '/policies/shipping-policy'];

async function fetchJson(url, timeout = 5000) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const res = await fetch(url, { headers: UA_HEADERS, signal: controller.signal, redirect: 'follow' });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchPageText(url, timeout = 5000) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const res = await fetch(url, { headers: UA_HEADERS, signal: controller.signal, redirect: 'follow' });
    clearTimeout(timer);
    return await res.text();
  } catch {
    return '';
  }
}

function normalizeCode(code) {
  if (!code) return null;
  const c = String(code).toUpperCase().slice(0, 2);
  if (c === 'UK') return 'GB';
  return COUNTRY_BY_CODE[c] ? c : null;
}

function detectFromTld(hostname) {
  const h = (hostname || '').toLowerCase();
  if (h.includes('catracho') || h.includes('guate')) return { code: 'GT', id: 'tld_heuristic_gt' };
  for (const rule of TLD_RULES) {
    if (rule.re.test(h)) return { code: rule.code, id: rule.id };
  }
  return null;
}

function extractHtmlLang(html) {
  const htmlTag = html.match(/<html[^>]*>/i)?.[0] || '';
  const langAttr = htmlTag.match(/\blang=["']([^"']+)["']/i);
  if (langAttr) return langAttr[1].toLowerCase();

  const metaLang =
    html.match(/<meta[^>]+http-equiv=["']content-language["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+http-equiv=["']content-language["']/i);
  if (metaLang) return metaLang[1].toLowerCase();

  const ogLocale = html.match(/<meta[^>]+property=["']og:locale["'][^>]+content=["']([^"']+)["']/i);
  if (ogLocale) return ogLocale[1].toLowerCase();

  const shopifyLocale = html.match(/Shopify\.locale\s*=\s*["']([^"']+)["']/i);
  if (shopifyLocale) return shopifyLocale[1].toLowerCase();

  return null;
}

function detectDominantTextLang(html) {
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
  const spanishHits = (text.match(SPANISH_TEXT_RE) || []).length;
  const portugueseHits = (text.match(PORTUGUESE_TEXT_RE) || []).length;
  if (spanishHits >= 8) return 'es';
  if (portugueseHits >= 8) return 'pt';
  return null;
}

function parseCountryFromJsonLd(html) {
  const blocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const block of blocks) {
    const jsonText = block.replace(/<script[^>]*>|<\/script>/gi, '').trim();
    try {
      const data = JSON.parse(jsonText);
      const walk = (obj) => {
        if (!obj || typeof obj !== 'object') return null;
        if (obj.addressCountry) return normalizeCode(obj.addressCountry);
        for (const v of Object.values(obj)) {
          const found = walk(v);
          if (found) return found;
        }
        return null;
      };
      const c = walk(data);
      if (c) return c;
    } catch (_) {}
  }
  return null;
}

function detectCurrenciesInHtml(html, knownCurrency) {
  const found = new Set();
  if (knownCurrency) found.add(String(knownCurrency).toUpperCase());

  const priceCurrency = html.match(/priceCurrency["']\s*:\s*["']([A-Z]{3})["']/gi) || [];
  for (const m of priceCurrency) {
    const c = m.match(/["']([A-Z]{3})["']/i)?.[1];
    if (c) found.add(c.toUpperCase());
  }
  if (html.includes('R$') || html.includes('BRL')) found.add('BRL');
  if (html.includes('₦') || html.includes('NGN')) found.add('NGN');
  if (html.includes('₹') || html.includes('INR')) found.add('INR');
  if (html.includes('₱') || html.includes('PHP')) found.add('PHP');
  if (html.includes('MXN') || html.includes('$MXN')) found.add('MXN');
  if (html.match(/\bS\/\.\s*\d/)) found.add('PEN');
  return [...found];
}

function detectPhoneAndPostal(html) {
  const signals = [];
  for (const { re, code, id } of PHONE_PREFIX) {
    if (re.test(html)) signals.push({ code, id, weight: 35 });
  }

  const plusOne = html.match(/\+1[\s\-.]?\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4}/);
  if (plusOne) {
    const window = html.slice(
      Math.max(0, html.indexOf(plusOne[0]) - 120),
      html.indexOf(plusOne[0]) + plusOne[0].length + 120
    );
    if (US_STATES.test(window)) {
      signals.push({ code: 'US', id: 'phone_1_us_state', weight: 30 });
    } else if (/\b(ontario|quebec|british columbia|alberta|manitoba|saskatchewan)\b/i.test(window)) {
      signals.push({ code: 'CA', id: 'phone_1_ca_province', weight: 30 });
    } else {
      signals.push({ code: 'US', id: 'phone_1_ambiguous', weight: 8 });
      signals.push({ code: 'CA', id: 'phone_1_ambiguous', weight: 8 });
    }
  }

  if (/\b\d{5}-\d{4}\b/.test(html)) {
    signals.push({ code: 'US', id: 'postal_us_zip_plus4', weight: 28 });
  }
  if (/\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b/i.test(html)) {
    signals.push({ code: 'CA', id: 'postal_ca', weight: 28 });
  }
  if (/\bSW\d[A-Z]?\s?\d[A-Z]{2}\b/i.test(html)) {
    signals.push({ code: 'GB', id: 'postal_gb', weight: 28 });
  }
  if (/\b\d{5}-\d{3}\b/.test(html) || /\bcep\b/i.test(html)) {
    signals.push({ code: 'BR', id: 'postal_br_cep', weight: 25 });
  }

  return signals;
}

function detectRegionAndShipping(html) {
  const signals = [];
  for (const rule of REGION_COUNTRY) {
    if (rule.re.test(html)) signals.push({ code: rule.code, id: rule.id, weight: 28 });
  }
  for (const rule of SHIPPING_PHRASES) {
    if (rule.re.test(html)) signals.push({ code: rule.code, id: rule.id, weight: 30 });
  }
  return signals;
}

function detectShopifyLocalePath(html) {
  const m = html.match(/\/(en|es|pt|fr|de)-([a-z]{2})\//i);
  if (m) {
    const country = normalizeCode(m[2]);
    if (country) return { code: country, id: `shopify_path_${m[1]}_${m[2]}` };
  }
  return null;
}

function createScoreboard() {
  const scores = new Map();
  const signalsUsed = [];
  const conflicting = [];

  const add = (code, weight, signalId) => {
    const normalized = normalizeCode(code);
    if (!normalized || normalized === 'EU') return;
    const entry = scores.get(normalized) || { score: 0, signals: [] };
    entry.score += weight;
    entry.signals.push(signalId);
    scores.set(normalized, entry);
    signalsUsed.push(signalId);
  };

  return { scores, signalsUsed, conflicting, add };
}

function countUsConfirmationSignals(signalsUsed, scores) {
  const usConfirmIds = new Set([
    'tld_us',
    'json_ld_US',
    'phone_1_us_state',
    'postal_us_zip_plus4',
    'shipping_us',
    'shipping_us_domestic',
    'region_us_text',
    'shopify_locale_US',
    'shopify_country_US',
  ]);
  let count = 0;
  for (const id of signalsUsed) {
    if (usConfirmIds.has(id)) count += 1;
  }
  const usEntry = scores.get('US');
  if (usEntry?.signals.includes('currency_USD') && usEntry.signals.length > 1) count += 1;
  return count;
}

function pickBest(scores, exclude = new Set()) {
  let best = null;
  let bestScore = 0;
  let bestSignals = [];
  for (const [code, { score, signals }] of scores) {
    if (exclude.has(code)) continue;
    if (score > bestScore) {
      best = code;
      bestScore = score;
      bestSignals = signals;
    }
  }
  return { code: best, score: bestScore, signals: bestSignals };
}

function buildMethod(signals) {
  if (!signals.length) return 'none';
  const groups = [];
  if (signals.some((s) => s.startsWith('tld'))) groups.push('ccTLD');
  if (signals.some((s) => s.startsWith('html_lang') || s.startsWith('text_lang'))) groups.push('language');
  if (signals.some((s) => s.startsWith('json_ld'))) groups.push('JSON-LD');
  if (signals.some((s) => s.startsWith('currency'))) groups.push('currency');
  if (signals.some((s) => s.startsWith('phone') || s.startsWith('postal'))) groups.push('phone/postal');
  if (signals.some((s) => s.startsWith('region') || s.startsWith('shipping'))) groups.push('address/shipping');
  if (signals.some((s) => s.startsWith('shopify'))) groups.push('Shopify locale');
  return groups.join(' + ') || 'heuristic';
}

/**
 * Priority-based country detection with anti-US-default rules.
 * Never assigns US without at least two confirming US-specific signals.
 */
export async function detectStoreCountry({ origin, hostname, html, currency = null }) {
  const board = createScoreboard();
  const primaryHtml = html || '';
  let combinedHtml = primaryHtml;

  const extraPages = await Promise.all(
    CONTACT_PATHS.slice(0, 2).map((path) => fetchPageText(`${origin}${path}`))
  );
  for (const page of extraPages) {
    if (page && page.length > 200) combinedHtml += '\n' + page;
  }

  const localization = await fetchJson(`${origin}/localization.json`);
  if (localization?.country?.iso_code) {
    const code = normalizeCode(localization.country.iso_code);
    if (code) board.add(code, 30, `shopify_locale_${code}`);
  }

  const tldHit = detectFromTld(hostname);
  if (tldHit) board.add(tldHit.code, 50, tldHit.id);

  const langRaw = extractHtmlLang(primaryHtml) || extractHtmlLang(combinedHtml);
  const langBase = langRaw ? langRaw.split(/[-_]/)[0] : null;
  const textLang = detectDominantTextLang(combinedHtml);
  const effectiveLang = langBase || textLang;

  if (effectiveLang) {
    board.add(effectiveLang, 0, `html_lang_${effectiveLang}`);
    const hints = LANG_COUNTRY_HINTS[effectiveLang];
    if (hints) {
      for (const code of hints) board.add(code, 22, `lang_hint_${effectiveLang}_${code}`);
    } else if (effectiveLang === 'en') {
      board.add('US', 10, 'lang_en_weak');
      board.add('GB', 8, 'lang_en_weak');
      board.add('CA', 8, 'lang_en_weak');
      board.add('AU', 8, 'lang_en_weak');
    }
  }

  const jsonLdCountry = parseCountryFromJsonLd(combinedHtml);
  if (jsonLdCountry) board.add(jsonLdCountry, 45, `json_ld_${jsonLdCountry}`);

  const currencies = detectCurrenciesInHtml(combinedHtml, currency);
  for (const cur of currencies) {
    const mapping = UNIQUE_CURRENCY[cur];
    if (mapping) {
      board.add(mapping.code, mapping.weight ?? 38, mapping.id);
    }
  }

  for (const sig of detectPhoneAndPostal(combinedHtml)) {
    board.add(sig.code, sig.weight, sig.id);
  }

  for (const sig of detectRegionAndShipping(combinedHtml)) {
    board.add(sig.code, sig.weight, sig.id);
  }

  const pathLocale = detectShopifyLocalePath(primaryHtml);
  if (pathLocale) board.add(pathLocale.code, 28, pathLocale.id);

  if (LANG_NON_US.has(effectiveLang)) {
    board.conflicting.push('blocked_us_due_to_language');
    board.scores.delete('US');
  }

  let { code, score, signals } = pickBest(board.scores);

  if (code === 'US') {
    const usConfirmCount = countUsConfirmationSignals(board.signalsUsed, board.scores);
    if (usConfirmCount < 2) {
      board.conflicting.push('us_insufficient_confirmation — ignored (requires 2+ US signals)');
      board.scores.delete('US');
      ({ code, score, signals } = pickBest(board.scores));
    }
  }

  if (effectiveLang === 'es' && code === 'US') {
    board.conflicting.push('spanish_language_blocks_us');
    board.scores.delete('US');
    ({ code, score, signals } = pickBest(board.scores));
  }

  const tldDefinitive = board.signalsUsed.some((s) => s.startsWith('tld_') && !s.includes('heuristic'));
  let confidence = 0;
  if (tldDefinitive && code) confidence = 97;
  else if (signals.some((s) => s.startsWith('json_ld')) && code) confidence = 93;
  else if (score >= 70) confidence = 88;
  else if (score >= 55) confidence = 85;
  else if (score >= 45) confidence = 80;
  else if (score >= 30) confidence = 65;
  else if (score >= 15) confidence = 50;
  else confidence = 0;

  const flaggedForReview = !code || confidence < 65;
  let finalCode = flaggedForReview ? null : code;
  let method = buildMethod(signals);

  if (!finalCode && confidence === 0) {
    finalCode = 'US';
    confidence = 40;
    method = 'default_us_fallback';
    board.conflicting.push('no_signals — defaulted to US');
    signals.push('default_us_fallback');
  }

  return {
    code: finalCode,
    name: finalCode ? COUNTRY_BY_CODE[finalCode] || finalCode : 'Unknown',
    confidence,
    method,
    signals_used: [...new Set(signals)],
    conflicting_signals: board.conflicting,
    flagged_for_review: !finalCode,
    countryCode: finalCode || 'XX',
    detectedLang: effectiveLang,
    rawTopCandidate: code,
    rawScore: score,
  };
}
