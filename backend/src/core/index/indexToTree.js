/**
 * Snapshot the (flat) index into a hierarchy of tree objects, returning the
 * root tree's id. The index stores full paths like `src/main.js`; a commit
 * needs one tree object per directory, so we rebuild the nesting here and write
 * subtrees bottom-up.
 */

import { writeTree, Mode } from '../objects/tree.js';
import { modeToTreeString } from './indexEntry.js';

/**
 * @param {import('../objects/objectStore.js').ObjectStore} store
 * @param {import('./index.js').Index} index
 * @returns {Promise<string>} root tree id
 */
export async function writeTreeFromIndex(store, index) {
  const root = newDir();
  for (const e of index.list()) {
    const parts = e.path.split('/');
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const name = parts[i];
      let child = node.dirs.get(name);
      if (!child) {
        child = newDir();
        node.dirs.set(name, child);
      }
      node = child;
    }
    node.files.set(parts[parts.length - 1], { mode: modeToTreeString(e.mode), sha: e.sha });
  }
  return writeNode(store, root);
}

function newDir() {
  return { dirs: new Map(), files: new Map() };
}

async function writeNode(store, node) {
  const entries = [];
  for (const [name, file] of node.files) {
    entries.push({ mode: file.mode, name, sha: file.sha });
  }
  for (const [name, dir] of node.dirs) {
    entries.push({ mode: Mode.DIR, name, sha: await writeNode(store, dir) });
  }
  return writeTree(store, entries); // writeTree sorts canonically
}
