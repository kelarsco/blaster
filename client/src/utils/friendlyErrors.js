/** Patterns that should never be shown to end users. */
const TECHNICAL =
  /backend|api\s*server|invalid\s+(backend\s+)?response|restart.*server|redeploy|railway|fly\.dev|vite|proxy|npm run dev|econnrefused|econnreset|failed to fetch|network\s*error|load failed|service unavailable|unexpected token|syntaxerror|google_callback|session_secret|vite_api_url|cannot reach the api|connection terminated|postgres|neon|database url|aggregateerror/i;

const STATUS_ONLY = /\bfailed\s*\(\d{3}\)$/i;

export const FRIENDLY_ERRORS = {
  default: 'Something went wrong. Please try again in a moment.',
  network: "We couldn't connect right now. Check your internet and try again.",
  signIn: "We couldn't sign you in right now. Please try again.",
  signUp: "We couldn't create your account right now. Please try again.",
  scan: "We couldn't start your scan right now. Please try again.",
  send: "We couldn't complete that action right now. Please try again.",
  google: "Google sign-in isn't available right now. Try email sign-in or try again later.",
  referral: "We couldn't load your referral info right now. Please try again.",
  unavailable: "This feature isn't available right now. Please try again.",
};

export function isTechnicalErrorMessage(message) {
  const msg = String(message || '').trim();
  if (!msg) return false;
  return TECHNICAL.test(msg) || STATUS_ONLY.test(msg);
}

export function toFriendlyErrorMessage(error, fallback = FRIENDLY_ERRORS.default) {
  const msg = typeof error === 'string' ? error : error?.message || '';
  if (!msg.trim() || isTechnicalErrorMessage(msg)) return fallback;
  return msg;
}

/** Prefer a safe server message; hide infra failures behind a friendly fallback. */
export function friendlyHttpError(status, serverMessage, fallback = FRIENDLY_ERRORS.default) {
  const msg = String(serverMessage || '').trim();
  if (status === 429) return 'Too many attempts. Please wait a moment and try again.';
  if (msg && !isTechnicalErrorMessage(msg) && status < 500) return msg;
  if (status >= 500 || status === 502 || status === 503) return fallback;
  if (msg && !isTechnicalErrorMessage(msg)) return msg;
  return fallback;
}
