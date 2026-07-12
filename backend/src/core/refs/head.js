/**
 * HEAD — the pointer to "where you are". CORRECTNESS RULE #4: HEAD is either
 * symbolic (`ref: refs/heads/main\n`, the normal case) or detached (a raw
 * 40-hex SHA + `\n`, when you check out a specific commit).
 */

import path from 'node:path';
import { readIfExists, atomicWrite } from '../../util/fsx.js';
import { BadObject } from '../../util/errors.js';

const SYMREF_PREFIX = 'ref: ';

export class Head {
  /** @param {string} gitdir absolute path to `.gritty` */
  constructor(gitdir) {
    this.path = path.join(gitdir, 'HEAD');
  }

  /** Raw trimmed HEAD contents, or `null` if the file is missing. */
  async readRaw() {
    const buf = await readIfExists(this.path);
    return buf === null ? null : buf.toString('utf8').trim();
  }

  /**
   * Structured HEAD state.
   * @returns {Promise<{ type: 'symbolic', ref: string } | { type: 'detached', sha: string } | null>}
   */
  async read() {
    const raw = await this.readRaw();
    if (raw === null) return null;
    if (raw.startsWith(SYMREF_PREFIX)) {
      return { type: 'symbolic', ref: raw.slice(SYMREF_PREFIX.length).trim() };
    }
    if (/^[0-9a-f]{40}$/.test(raw)) return { type: 'detached', sha: raw };
    throw new BadObject(`malformed HEAD: ${JSON.stringify(raw)}`);
  }

  /** Point HEAD at a branch (symbolic). @param {string} refname */
  async setSymbolic(refname) {
    await atomicWrite(this.path, `${SYMREF_PREFIX}${refname}\n`);
  }

  /** Detach HEAD onto a specific commit. @param {string} sha */
  async setDetached(sha) {
    await atomicWrite(this.path, `${sha}\n`);
  }
}
