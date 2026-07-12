/** Presentation helpers for the CLI (date rendering that mirrors `git log`). */

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad2 = (n) => String(n).padStart(2, '0');

/**
 * Render a commit timestamp the way `git log` does, in the commit's own zone:
 *   "Thu Apr  7 22:13:13 2005 +0200"  (day is space-padded to width 2).
 * @param {number} timestamp seconds since the Unix epoch
 * @param {string} timezone signed 4-digit offset, e.g. "+0200"
 * @returns {string}
 */
export function formatGitDate(timestamp, timezone) {
  const sign = timezone[0] === '-' ? -1 : 1;
  const oh = Number(timezone.slice(1, 3));
  const om = Number(timezone.slice(3, 5));
  const offsetSec = sign * (oh * 3600 + om * 60);
  // Shift into the target zone, then read UTC fields to avoid the host's zone.
  const d = new Date((timestamp + offsetSec) * 1000);
  const day = String(d.getUTCDate()).padStart(2, ' ');
  return (
    `${DAYS[d.getUTCDay()]} ${MONTHS[d.getUTCMonth()]} ${day} ` +
    `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())} ` +
    `${d.getUTCFullYear()} ${timezone}`
  );
}
