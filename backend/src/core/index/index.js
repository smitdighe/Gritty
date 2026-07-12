/**
 * The index (a.k.a. staging area / cache) — the ordered set of entries that the
 * next commit will snapshot. Persisted in git's `DIRC` version-2 format:
 *
 *     "DIRC" | u32 version(2) | u32 entryCount | entries... | trailing SHA-1
 *
 * Entries are stored sorted by (name, stage). We keep only stage 0 (no merge
 * conflicts) in v1.
 */

import { createHash } from 'node:crypto';
import { readIfExists, atomicWrite } from '../../util/fsx.js';
import { BadObject } from '../../util/errors.js';
import { serializeEntry, parseEntry } from './indexEntry.js';

const SIGNATURE = Buffer.from('DIRC', 'latin1');
const VERSION = 2;

export class Index {
  /** @param {string} indexPath absolute path to `.gritty/index` */
  constructor(indexPath) {
    this.path = indexPath;
    /** @type {Map<string, import('./indexEntry.js').IndexEntry>} keyed by path */
    this.entries = new Map();
  }

  /**
   * Load an index from disk. A missing file yields an empty index.
   * @param {string} indexPath
   * @returns {Promise<Index>}
   */
  static async read(indexPath) {
    const index = new Index(indexPath);
    const buf = await readIfExists(indexPath);
    if (buf === null) return index;
    index._parse(buf);
    return index;
  }

  _parse(buf) {
    if (buf.length < 12 + 20 || !buf.subarray(0, 4).equals(SIGNATURE)) {
      throw new BadObject('index: bad signature');
    }
    const version = buf.readUInt32BE(4);
    if (version !== 2) {
      throw new BadObject(`index: unsupported version ${version}`);
    }
    // Verify the trailing checksum over everything preceding it.
    const body = buf.subarray(0, buf.length - 20);
    const stored = buf.subarray(buf.length - 20);
    const actual = createHash('sha1').update(body).digest();
    if (!stored.equals(actual)) {
      throw new BadObject('index: checksum mismatch');
    }

    const count = buf.readUInt32BE(8);
    let offset = 12;
    for (let i = 0; i < count; i++) {
      const { entry, next } = parseEntry(buf, offset);
      this.entries.set(entry.path, entry);
      offset = next;
    }
    // Any bytes between here and the checksum are extensions we don't emit; ignore.
  }

  /** Persist the index atomically. */
  async write() {
    const sorted = this.list();
    const parts = [];
    const header = Buffer.alloc(12);
    SIGNATURE.copy(header, 0);
    header.writeUInt32BE(VERSION, 4);
    header.writeUInt32BE(sorted.length, 8);
    parts.push(header);
    for (const e of sorted) parts.push(serializeEntry(e));

    const body = Buffer.concat(parts);
    const checksum = createHash('sha1').update(body).digest();
    await atomicWrite(this.path, Buffer.concat([body, checksum]));
  }

  /**
   * Stage/replace an entry (keyed by its path). Removes any directory/file
   * conflict, as git does: staging `x/y` drops a tracked file `x`, and staging
   * a file `x` drops everything under `x/`. Without this, a file→directory
   * change leaves a stale entry and the resulting tree has duplicate names.
   * @param {import('./indexEntry.js').IndexEntry} entry
   */
  add(entry) {
    const p = entry.path;
    for (const existing of this.entries.keys()) {
      if (existing === p) continue;
      if (existing.startsWith(`${p}/`) || p.startsWith(`${existing}/`)) {
        this.entries.delete(existing);
      }
    }
    this.entries.set(p, entry);
  }

  /** Unstage a path. Returns true if something was removed. @param {string} path */
  remove(path) {
    return this.entries.delete(path);
  }

  /** @param {string} path @returns {import('./indexEntry.js').IndexEntry | undefined} */
  get(path) {
    return this.entries.get(path);
  }

  /** @param {string} path */
  has(path) {
    return this.entries.has(path);
  }

  /**
   * All entries, sorted by git's rule: bytewise on the name, then stage.
   * @returns {import('./indexEntry.js').IndexEntry[]}
   */
  list() {
    return [...this.entries.values()].sort((a, b) => {
      const cmp = Buffer.compare(Buffer.from(a.path, 'utf8'), Buffer.from(b.path, 'utf8'));
      return cmp !== 0 ? cmp : a.stage - b.stage;
    });
  }

  /** Number of staged entries. */
  get size() {
    return this.entries.size;
  }
}
