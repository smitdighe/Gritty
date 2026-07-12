/**
 * `init` — scaffold a `.gritty` directory. Layout:
 *
 *     .gritty/
 *       HEAD                -> "ref: refs/heads/main\n"
 *       objects/            (loose object database)
 *       refs/heads/         (branches)
 *       refs/tags/          (tags)
 *
 * Re-running on an existing repo is safe: it leaves HEAD and existing refs
 * alone and just ensures the directories are present.
 */

import path from 'node:path';
import { mkdirp, atomicWrite, pathExists } from '../../util/fsx.js';
import { Repo, GITTY_DIR, DEFAULT_BRANCH } from './repo.js';

/**
 * Initialize a repository rooted at `root`.
 * @param {string} [root] working-tree root (defaults to cwd)
 * @returns {Promise<{ repo: Repo, gitdir: string, reinitialized: boolean }>}
 */
export async function init(root = process.cwd()) {
  const absRoot = path.resolve(root);
  const gitdir = path.join(absRoot, GITTY_DIR);
  const reinitialized = await pathExists(gitdir);

  await mkdirp(path.join(gitdir, 'objects'));
  await mkdirp(path.join(gitdir, 'refs', 'heads'));
  await mkdirp(path.join(gitdir, 'refs', 'tags'));

  // Only write HEAD if it isn't already there, so re-init never moves you.
  const headPath = path.join(gitdir, 'HEAD');
  if (!(await pathExists(headPath))) {
    await atomicWrite(headPath, `ref: refs/heads/${DEFAULT_BRANCH}\n`);
  }

  return { repo: new Repo(absRoot), gitdir, reinitialized };
}
