export function getTrialRemainingMs(trialEndsAt) {
  if (!trialEndsAt) return 0;
  return Math.max(0, new Date(trialEndsAt).getTime() - Date.now());
}

export function getTrialCountdownParts(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return { h, m, s };
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** @deprecated Use TrialCountdown component for display */
export function formatTrialCountdown(ms) {
  const { h, m, s } = getTrialCountdownParts(ms);
  return `${h}hrs - ${m} min - ${s} sec`;
}

export function formatTrialCountdownLabel(ms) {
  const { h, m, s } = getTrialCountdownParts(ms);
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

export function trialCountdownAriaLabel(ms) {
  const { h, m, s } = getTrialCountdownParts(ms);
  return `${h} hours, ${m} minutes, and ${s} seconds`;
}
