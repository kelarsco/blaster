/**
 * Format a date from the DB (ISO/timestamp, stored in UTC) as a calendar date string
 * using UTC so the displayed date matches the stored date (no timezone shift).
 * e.g. "2026-03-11T00:00:00.000Z" -> "11 Mar 2026"
 */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatUTCDateOnly(isoOrDate) {
  if (!isoOrDate) return null;
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return null;
  const day = d.getUTCDate();
  const month = MONTHS[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  return `${day} ${month} ${year}`;
}
