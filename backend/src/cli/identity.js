/**
 * Where an author/committer identity comes from on the command line. We honor
 * the same environment variables git does (so `GIT_AUTHOR_NAME` etc. Just Work),
 * with a `GRITTY_`-prefixed override and an OS-username fallback.
 */

import os from 'node:os';

/** Format a minutes-west-of-UTC offset as a git timezone like "+0530". */
export function formatTimezone(offsetMinutes) {
  // JS getTimezoneOffset() is minutes *behind* UTC (positive when behind), so a
  // +05:30 zone reports -330. Flip the sign for git's convention.
  const sign = offsetMinutes <= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${sign}${hh}${mm}`;
}

function pick(...vals) {
  for (const v of vals) if (v) return v;
  return undefined;
}

/**
 * Resolve the author (and committer) identity for a new commit.
 * @param {{ now?: Date, env?: NodeJS.ProcessEnv }} [opts]
 * @returns {{ author: import('../core/objects/commit.js').Ident, committer: import('../core/objects/commit.js').Ident }}
 */
export function resolveIdentity({ now = new Date(), env = process.env } = {}) {
  const timestamp = Math.floor(now.getTime() / 1000);
  const timezone = formatTimezone(now.getTimezoneOffset());

  const username = safeUsername();
  const authorName = pick(env.GRITTY_AUTHOR_NAME, env.GIT_AUTHOR_NAME, username, 'Gritty User');
  const authorEmail = pick(
    env.GRITTY_AUTHOR_EMAIL,
    env.GIT_AUTHOR_EMAIL,
    username && `${username}@localhost`,
    'you@example.com',
  );
  const committerName = pick(env.GRITTY_COMMITTER_NAME, env.GIT_COMMITTER_NAME, authorName);
  const committerEmail = pick(env.GRITTY_COMMITTER_EMAIL, env.GIT_COMMITTER_EMAIL, authorEmail);

  const author = { name: authorName, email: authorEmail, timestamp, timezone };
  const committer = { name: committerName, email: committerEmail, timestamp, timezone };
  return { author, committer };
}

function safeUsername() {
  try {
    return os.userInfo().username;
  } catch {
    return undefined;
  }
}
