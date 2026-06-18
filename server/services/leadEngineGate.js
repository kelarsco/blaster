/** Lead engine worker is opt-in — avoids Neon quota burn on server start. */
let enabled = process.env.ENABLE_LEAD_ENGINE === '1';

export function isLeadEngineEnabled() {
  return enabled;
}

export function enableLeadEngine() {
  enabled = true;
}

export function disableLeadEngine() {
  enabled = false;
}
