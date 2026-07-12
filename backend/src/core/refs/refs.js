/**
 * Refs — named pointers to commits, stored one-per-file under `.gritty/refs`.
 * A ref file holds either a 40-hex SHA (`<sha>\n`) or a symbolic redirect
 * (`ref: refs/heads/other\n`). We follow symbolic redirects when reading.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { readIfExists, atomicWrite, pathExists } from '../../util/fsx.js';
import { RefNotFound, UsageError } from '../../util/errors.js';

const SYMREF_PREFIX = 'ref: ';

export class Refs {
  /**
   * @param {string} gitdir absolute path to the `.gritty` directory
   */
  constructor(gitdir) {
    this.gitdir = gitdir;
  }

  /** Absolute path for a fully-qualified refname like `refs/heads/main`. */
  refPath(refname) {
    return path.join(this.gitdir, ...refname.split('/'));
  }

  /**
   * Resolve a refname to a SHA, following symbolic redirects. Returns `null`
   * if the ref does not exist (e.g. an unborn branch).
   * @param {string} refname
   * @param {number} [depth] symref recursion guard
   * @returns {Promise<string|null>}
   */
  async read(refname, depth = 0) {
    if (depth > 10) throw new RefNotFound(`too many symbolic redirects at ${refname}`);
    const buf = await readIfExists(this.refPath(refname));
    if (buf === null) return null;
    const value = buf.toString('utf8').trim();
    if (value.startsWith(SYMREF_PREFIX)) {
      return this.read(value.slice(SYMREF_PREFIX.length).trim(), depth + 1);
    }
    return value;
  }

  /**
   * Like {@link read} but throws {@link RefNotFound} when absent.
   * @param {string} refname
   * @returns {Promise<string>}
   */
  async resolve(refname) {
    const sha = await this.read(refname);
    if (sha === null) throw new RefNotFound(`ref not found: ${refname}`);
    return sha;
  }

  /** True if the ref file exists. */
  async exists(refname) {
    return pathExists(this.refPath(refname));
  }

  /**
   * Point a ref directly at a SHA (creating it if needed).
   * @param {string} refname
   * @param {string} sha 40-hex
   */
  async update(refname, sha) {
    await atomicWrite(this.refPath(refname), `${sha}\n`);
  }

  /** Delete a ref. No error if it is already gone. */
  async delete(refname) {
    await fs.rm(this.refPath(refname), { force: true });
  }

  /** Fully-qualified name of a local branch. */
  static branchRef(name) {
    if (!isValidBranchName(name)) throw new UsageError(`invalid branch name: ${name}`);
    return `refs/heads/${name}`;
  }

  /**
   * List local branches as `{ name, sha }`, sorted by name. Supports nested
   * names (e.g. `feature/x`).
   * @returns {Promise<Array<{ name: string, sha: string }>>}
   */
  async listBranches() {
    const headsDir = path.join(this.gitdir, 'refs', 'heads');
    const names = await walkRefNames(headsDir, '');
    const out = [];
    for (const name of names.sort()) {
      out.push({ name, sha: await this.resolve(`refs/heads/${name}`) });
    }
    return out;
  }
}

/**
 * Recursively collect ref names relative to `dir` (using '/' separators).
 * @param {string} dir
 * @param {string} prefix
 * @returns {Promise<string[]>}
 */
async function walkRefNames(dir, prefix) {
  let dirents;
  try {
    dirents = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  const names = [];
  for (const ent of dirents) {
    const rel = prefix ? `${prefix}/${ent.name}` : ent.name;
    if (ent.isDirectory()) {
      names.push(...(await walkRefNames(path.join(dir, ent.name), rel)));
    } else {
      names.push(rel);
    }
  }
  return names;
}

/**
 * A pragmatic subset of git's ref-name rules — enough to keep the on-disk
 * layout sane without reimplementing check-ref-format in full.
 * @param {string} name
 */
export function isValidBranchName(name) {
  if (typeof name !== 'string' || name.length === 0) return false;
  if (name.startsWith('/') || name.endsWith('/') || name.endsWith('.lock')) return false;
  if (name.startsWith('-')) return false;
  if (name.includes('..') || name.includes('//') || name.includes('@{')) return false;
  // Control chars, space, and the special set git forbids.
  if (/[\x00-\x20~^:?*[\\\x7f]/.test(name)) return false;
  return true;
}
