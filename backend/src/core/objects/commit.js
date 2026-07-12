/**
 * Commits. CORRECTNESS RULE #5 — the serialization is exactly:
 *
 *     tree <sha>\n
 *     parent <sha>\n            (0 for a root commit, 1 normal, 2+ for a merge)
 *     author <name> <email> <ts> <tz>\n
 *     committer <name> <email> <ts> <tz>\n
 *     \n
 *     <message>
 *
 * Parent order is significant and preserved. `<ts>` is seconds since the Unix
 * epoch; `<tz>` is a signed four-digit offset like `+0000` or `-0530`.
 */

import { hashObject } from './hash.js';
import { BadObject } from '../../util/errors.js';

/**
 * @typedef {object} Ident
 * @property {string} name
 * @property {string} email
 * @property {number} timestamp seconds since the Unix epoch
 * @property {string} timezone  signed 4-digit offset, e.g. "+0000", "-0530"
 */

/**
 * @typedef {object} Commit
 * @property {string} tree
 * @property {string[]} parents
 * @property {Ident} author
 * @property {Ident} committer
 * @property {string} message
 */

function formatIdent(ident) {
  return `${ident.name} <${ident.email}> ${ident.timestamp} ${ident.timezone}`;
}

const IDENT_RE = /^(.*) <([^>]*)> (\d+) ([+-]\d{4})$/;

function parseIdent(line) {
  const m = IDENT_RE.exec(line);
  if (!m) throw new BadObject(`malformed identity line: ${JSON.stringify(line)}`);
  return { name: m[1], email: m[2], timestamp: Number(m[3]), timezone: m[4] };
}

/**
 * Serialize a commit to its canonical bytes. The message is stored verbatim;
 * callers are responsible for any trailing-newline convention.
 * @param {Commit} commit
 * @returns {Buffer}
 */
export function serializeCommit(commit) {
  const lines = [`tree ${commit.tree}`];
  for (const p of commit.parents ?? []) lines.push(`parent ${p}`);
  lines.push(`author ${formatIdent(commit.author)}`);
  lines.push(`committer ${formatIdent(commit.committer)}`);
  const header = lines.join('\n');
  return Buffer.concat([
    Buffer.from(`${header}\n\n`, 'utf8'),
    Buffer.from(commit.message, 'utf8'),
  ]);
}

/**
 * Parse a commit object's payload.
 * @param {Buffer} content
 * @returns {Commit}
 */
export function parseCommit(content) {
  // Header ends at the first blank line (\n\n); everything after is the message.
  const sep = content.indexOf('\n\n');
  if (sep < 0) throw new BadObject('commit has no header/message separator');
  const headerText = content.toString('utf8', 0, sep);
  const message = content.toString('utf8', sep + 2);

  let tree = null;
  const parents = [];
  let author = null;
  let committer = null;

  for (const line of headerText.split('\n')) {
    const space = line.indexOf(' ');
    const key = line.slice(0, space);
    const value = line.slice(space + 1);
    switch (key) {
      case 'tree':
        tree = value;
        break;
      case 'parent':
        parents.push(value);
        break;
      case 'author':
        author = parseIdent(value);
        break;
      case 'committer':
        committer = parseIdent(value);
        break;
      default:
        // Ignore unknown headers (e.g. gpgsig, encoding) so we stay forward-compatible.
        break;
    }
  }

  if (!tree || !author || !committer) {
    throw new BadObject('commit is missing a required header (tree/author/committer)');
  }
  return { tree, parents, author, committer, message };
}

/** The id a commit would have, without writing it. */
export function commitId(commit) {
  return hashObject('commit', serializeCommit(commit));
}

/**
 * Write a commit object and return its id.
 * @param {import('./objectStore.js').ObjectStore} store
 * @param {Commit} commit
 */
export async function writeCommit(store, commit) {
  return store.write('commit', serializeCommit(commit));
}

/**
 * Read and parse a commit object.
 * @param {import('./objectStore.js').ObjectStore} store
 * @param {string} sha
 */
export async function readCommit(store, sha) {
  const obj = await store.read(sha);
  if (obj.type !== 'commit') throw new BadObject(`expected commit but ${sha} is a ${obj.type}`);
  return parseCommit(obj.content);
}
