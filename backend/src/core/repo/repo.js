/**
 * Repo — the object graph of a Gritty working tree. It locates the `.gritty`
 * directory, exposes path helpers, and wires together the object store, refs,
 * and HEAD. Higher-level combinators (resolve HEAD to a commit, name the
 * current branch) live here because they're the natural join of refs + HEAD.
 */

import path from 'node:path';
import { ObjectStore } from '../objects/objectStore.js';
import { Refs } from '../refs/refs.js';
import { Head } from '../refs/head.js';
import { isHex40 } from '../objects/hash.js';
import { pathExists } from '../../util/fsx.js';
import { NotARepo, RefNotFound } from '../../util/errors.js';

/** Name of the per-repo metadata directory. */
export const GITTY_DIR = '.gritty';
/** Default (and only initial) branch. */
export const DEFAULT_BRANCH = 'main';

export class Repo {
  /**
   * @param {string} root absolute path to the working-tree root (contains `.gritty`)
   */
  constructor(root) {
    this.root = root;
    this.gitdir = path.join(root, GITTY_DIR);
    this.store = new ObjectStore(path.join(this.gitdir, 'objects'));
    this.refs = new Refs(this.gitdir);
    this.head = new Head(this.gitdir);
  }

  // --- path helpers -------------------------------------------------------

  get objectsDir() {
    return path.join(this.gitdir, 'objects');
  }

  get indexPath() {
    return path.join(this.gitdir, 'index');
  }

  /** Absolute path for a path relative to the working-tree root. */
  worktreePath(...parts) {
    return path.join(this.root, ...parts);
  }

  // --- discovery ----------------------------------------------------------

  /**
   * Walk up from `startDir` until a directory containing `.gritty` is found.
   * @param {string} [startDir]
   * @returns {Promise<Repo>}
   * @throws {NotARepo} if no repository is found up to the filesystem root
   */
  static async find(startDir = process.cwd()) {
    let dir = path.resolve(startDir);
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (await pathExists(path.join(dir, GITTY_DIR))) {
        return new Repo(dir);
      }
      const parent = path.dirname(dir);
      if (parent === dir) throw new NotARepo();
      dir = parent;
    }
  }

  // --- HEAD combinators ---------------------------------------------------

  /**
   * The commit SHA HEAD points at, or `null` on an unborn branch (a fresh repo
   * whose branch ref does not exist yet).
   * @returns {Promise<string|null>}
   */
  async resolveHead() {
    const state = await this.head.read();
    if (state === null) return null;
    if (state.type === 'detached') return state.sha;
    return this.refs.read(state.ref); // null if branch is unborn
  }

  /**
   * The current branch name (e.g. `main`), or `null` when HEAD is detached.
   * @returns {Promise<string|null>}
   */
  async currentBranch() {
    const state = await this.head.read();
    if (state === null || state.type !== 'symbolic') return null;
    const prefix = 'refs/heads/';
    return state.ref.startsWith(prefix) ? state.ref.slice(prefix.length) : null;
  }

  /**
   * Resolve a revision string to an object id. Accepts `HEAD`, a branch name, a
   * full 40-hex id, or a fully-qualified ref path.
   * @param {string} rev
   * @returns {Promise<string>}
   * @throws {RefNotFound}
   */
  async resolveRevision(rev) {
    if (rev === 'HEAD') {
      const sha = await this.resolveHead();
      if (!sha) throw new RefNotFound('HEAD does not point to a commit yet');
      return sha;
    }
    const viaBranch = await this.refs.read(`refs/heads/${rev}`);
    if (viaBranch) return viaBranch;
    if (isHex40(rev) && (await this.store.has(rev))) return rev;
    const viaRef = await this.refs.read(rev);
    if (viaRef) return viaRef;
    throw new RefNotFound(`unknown revision or path: ${rev}`);
  }
}
