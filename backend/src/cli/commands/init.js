/** `gritty init [dir]` — create (or re-create) a repository. */

import path from 'node:path';
import { init } from '../../core/repo/init.js';

/**
 * @param {{ cwd?: string, dir?: string }} [opts]
 * @returns {Promise<string>} human-readable status line
 */
export async function initCommand({ cwd = process.cwd(), dir } = {}) {
  const target = dir ? path.resolve(cwd, dir) : cwd;
  const { gitdir, reinitialized } = await init(target);
  const verb = reinitialized ? 'Reinitialized existing' : 'Initialized empty';
  return `${verb} Gritty repository in ${gitdir}`;
}
