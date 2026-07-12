/** Pure formatting utilities. No side effects, no I/O. */

/**
 * Abbreviate a full 40-hex SHA to its short form.
 * Clamps `len` into [1, sha.length]; non-hex/shorter input is returned as-is
 * up to `len`. Whitespace is trimmed first.
 */
export function shortenSha(sha: string, len = 7): string {
  const s = String(sha).trim();
  if (s.length === 0) return '';
  const n = Math.max(1, Math.min(Math.floor(len), s.length));
  return s.slice(0, n);
}

/**
 * Format a git-style timestamp: `unixSeconds` is UTC seconds since epoch,
 * `timezoneOffset` is the author's offset in **minutes east of UTC** (e.g.
 * +330 for IST, -480 for PST) — matching what a commit records. Renders in
 * that original zone as `YYYY-MM-DD HH:mm:ss ±HHMM`.
 */
export function formatTimestamp(unixSeconds: number, timezoneOffset = 0): string {
  if (!Number.isFinite(unixSeconds)) return '';
  const offsetMin = Number.isFinite(timezoneOffset) ? Math.trunc(timezoneOffset) : 0;
  // Shift the epoch by the offset, then read UTC fields to get local wall-clock.
  const shifted = new Date((unixSeconds + offsetMin * 60) * 1000);
  const p = (n: number, w = 2) => String(Math.abs(n)).padStart(w, '0');
  const date = `${shifted.getUTCFullYear()}-${p(shifted.getUTCMonth() + 1)}-${p(shifted.getUTCDate())}`;
  const time = `${p(shifted.getUTCHours())}:${p(shifted.getUTCMinutes())}:${p(shifted.getUTCSeconds())}`;
  const sign = offsetMin < 0 ? '-' : '+';
  const tz = `${sign}${p(Math.trunc(Math.abs(offsetMin) / 60))}${p(Math.abs(offsetMin) % 60)}`;
  return `${date} ${time} ${tz}`;
}

/**
 * Convert a git timezone string (`+0000`, `-0530`) to minutes east of UTC
 * (`0`, `-330`), matching what {@link formatTimestamp} expects as its offset.
 */
export function tzOffsetToMinutes(tz: string): number {
  const m = /^([+-])(\d{2})(\d{2})$/.exec(String(tz).trim());
  if (!m) return 0;
  const sign = m[1] === '-' ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3]));
}

/** Format an author/committer ident's timestamp in its own recorded timezone. */
export function formatIdentTime(unixSeconds: number, timezone: string): string {
  return formatTimestamp(unixSeconds, tzOffsetToMinutes(timezone));
}

/**
 * Naive English pluralizer: `pluralize(1, 'commit')` → "1 commit",
 * `pluralize(3, 'commit')` → "3 commits". Pass `plural` for irregular words.
 */
export function pluralize(count: number, word: string, plural?: string): string {
  const n = Number(count);
  const one = Math.abs(n) === 1;
  const form = one ? word : (plural ?? `${word}s`);
  return `${n} ${form}`;
}
