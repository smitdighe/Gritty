/**
 * Trees — Git's directories. A tree is a sequence of binary entries, each:
 *
 *     <mode> <name>\0<20-byte raw SHA>
 *
 * CORRECTNESS RULE #2:
 *  - `<mode>` is ASCII with NO leading zero: 40000 for a directory (not 040000),
 *    100644 regular, 100755 executable, 120000 symlink.
 *  - Entries are sorted by name, but a directory sorts as though its name has a
 *    trailing '/'. That subtlety (`base_name_compare` in git) is the classic
 *    place clones diverge from real git.
 */

import { hashObject, hexToRaw, rawToHex } from './hash.js';
import { BadObject } from '../../util/errors.js';

/** Canonical file modes as ASCII strings (no leading zeros). */
export const Mode = Object.freeze({
  DIR: '40000',
  FILE: '100644',
  EXEC: '100755',
  SYMLINK: '120000',
  GITLINK: '160000',
});

const DIR_BYTE = 0x2f; // '/'

/** Is this mode a subtree (directory)? */
function isDir(mode) {
  return mode === Mode.DIR;
}

/**
 * The object type an entry points at, inferred from its mode.
 * @param {string} mode
 * @returns {'tree'|'commit'|'blob'}
 */
export function entryType(mode) {
  if (mode === Mode.DIR) return 'tree';
  if (mode === Mode.GITLINK) return 'commit';
  return 'blob';
}

/**
 * Compare two entries by git's tree ordering: byte-wise on the name, with a
 * directory treated as if its name ended in '/'.
 *
 * @param {{ mode: string, name: string }} a
 * @param {{ mode: string, name: string }} b
 * @returns {number}
 */
export function compareEntries(a, b) {
  const an = Buffer.from(a.name, 'utf8');
  const bn = Buffer.from(b.name, 'utf8');
  const len = Math.min(an.length, bn.length);
  const cmp = Buffer.compare(an.subarray(0, len), bn.subarray(0, len));
  if (cmp !== 0) return cmp;
  // Common prefix is equal; look at the byte that follows in each name. For the
  // name that has ended, that byte is the terminator (0) — promoted to '/' when
  // the entry is a directory, exactly as git's base_name_compare does.
  const c1 = len < an.length ? an[len] : isDir(a.mode) ? DIR_BYTE : 0;
  const c2 = len < bn.length ? bn[len] : isDir(b.mode) ? DIR_BYTE : 0;
  return c1 < c2 ? -1 : c1 > c2 ? 1 : 0;
}

/**
 * Serialize tree entries to their canonical binary form. Input need not be
 * sorted — this sorts a copy so callers can build entries in any order.
 *
 * @param {Array<{ mode: string, name: string, sha: string }>} entries
 * @returns {Buffer}
 */
export function serializeTree(entries) {
  const sorted = [...entries].sort(compareEntries);
  const parts = [];
  for (const e of sorted) {
    parts.push(Buffer.from(`${e.mode} ${e.name}`, 'utf8'));
    parts.push(Buffer.from([0]));
    parts.push(hexToRaw(e.sha));
  }
  return Buffer.concat(parts);
}

/**
 * Parse a tree object's payload back into entries (in stored order).
 * @param {Buffer} content
 * @returns {Array<{ mode: string, name: string, sha: string }>}
 */
export function parseTree(content) {
  const entries = [];
  let i = 0;
  while (i < content.length) {
    const space = content.indexOf(0x20, i);
    if (space < 0) throw new BadObject('tree entry missing mode separator');
    const mode = content.toString('latin1', i, space);
    const nul = content.indexOf(0, space + 1);
    if (nul < 0) throw new BadObject('tree entry missing name terminator');
    const name = content.toString('utf8', space + 1, nul);
    const shaStart = nul + 1;
    const shaEnd = shaStart + 20;
    if (shaEnd > content.length) throw new BadObject('tree entry truncated SHA');
    const sha = rawToHex(content.subarray(shaStart, shaEnd));
    entries.push({ mode, name, sha });
    i = shaEnd;
  }
  return entries;
}

/** The id a tree would have, without writing it. */
export function treeId(entries) {
  return hashObject('tree', serializeTree(entries));
}

/**
 * Write a tree object and return its id.
 * @param {import('./objectStore.js').ObjectStore} store
 * @param {Array<{ mode: string, name: string, sha: string }>} entries
 */
export async function writeTree(store, entries) {
  return store.write('tree', serializeTree(entries));
}

/**
 * Read and parse a tree object.
 * @param {import('./objectStore.js').ObjectStore} store
 * @param {string} sha
 */
export async function readTree(store, sha) {
  const obj = await store.read(sha);
  if (obj.type !== 'tree') throw new BadObject(`expected tree but ${sha} is a ${obj.type}`);
  return parseTree(obj.content);
}
