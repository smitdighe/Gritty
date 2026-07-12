/**
 * Filesystem helpers. All of Gritty's disk I/O funnels through here so the rest
 * of the core can stay easy to reason about (and easy to fake in tests).
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

/** Recursively create `dir` (no error if it already exists). */
export async function mkdirp(dir) {
  await fs.mkdir(dir, { recursive: true });
}

/**
 * Read a file, returning its bytes, or `null` if it does not exist. Any other
 * error (permissions, is-a-directory, ...) propagates.
 * @param {string} filePath
 * @returns {Promise<Buffer|null>}
 */
export async function readIfExists(filePath) {
  try {
    return await fs.readFile(filePath);
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

/**
 * `lstat` a path and return exactly the fields the index cares about, with
 * nanosecond times and 32-bit-truncated dev/ino (matching git's on-disk index).
 * Returns `null` if the path does not exist.
 * @param {string} p
 */
export async function lstatIndexFields(p) {
  let st;
  try {
    st = await fs.lstat(p, { bigint: true });
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
  const split = (ns) => ({ sec: Number(ns / 1000000000n), nano: Number(ns % 1000000000n) });
  const c = split(st.ctimeNs);
  const m = split(st.mtimeNs);
  return {
    ctimeSec: c.sec,
    ctimeNano: c.nano,
    mtimeSec: m.sec,
    mtimeNano: m.nano,
    dev: Number(st.dev & 0xffffffffn),
    ino: Number(st.ino & 0xffffffffn),
    uid: Number(st.uid & 0xffffffffn),
    gid: Number(st.gid & 0xffffffffn),
    size: Number(st.size & 0xffffffffn),
    rawMode: Number(st.mode),
    isSymbolicLink: st.isSymbolicLink(),
    isFile: st.isFile(),
    isDirectory: st.isDirectory(),
  };
}

/** True if a path exists (file, dir, or otherwise). */
export async function pathExists(p) {
  try {
    await fs.stat(p);
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') return false;
    throw err;
  }
}

/**
 * Recursively list absolute paths of files (and symlinks) under `root`.
 * Directories for which `skipDir(absPath, name)` returns true are pruned.
 * @param {string} root
 * @param {(absPath: string, name: string) => boolean} [skipDir]
 * @returns {Promise<string[]>}
 */
export async function walkFiles(root, skipDir = () => false) {
  const out = [];
  async function recurse(dir) {
    let dirents;
    try {
      dirents = await fs.readdir(dir, { withFileTypes: true });
    } catch (err) {
      if (err.code === 'ENOENT') return;
      throw err;
    }
    for (const ent of dirents) {
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (!skipDir(abs, ent.name)) await recurse(abs);
      } else if (ent.isFile() || ent.isSymbolicLink()) {
        out.push(abs);
      }
    }
  }
  await recurse(root);
  return out;
}

/** Read a symlink's target. @param {string} p @returns {Promise<string>} */
export async function readLink(p) {
  return fs.readlink(p);
}

/**
 * Write `data` to `filePath` atomically: write to a uniquely-named temp file in
 * the same directory, then rename over the target. Readers therefore never see
 * a half-written file. The parent directory is created if needed.
 *
 * `rename` is atomic within a filesystem and replaces an existing target on both
 * POSIX and Windows (libuv uses MoveFileEx with REPLACE_EXISTING).
 *
 * @param {string} filePath
 * @param {Buffer|string} data
 */
export async function atomicWrite(filePath, data) {
  const dir = path.dirname(filePath);
  await mkdirp(dir);
  const tmp = path.join(dir, `.tmp-${process.pid}-${randomBytes(6).toString('hex')}`);
  let handle;
  try {
    handle = await fs.open(tmp, 'wx');
    await handle.writeFile(data);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await fs.rename(tmp, filePath);
  } catch (err) {
    if (handle) await handle.close().catch(() => {});
    await fs.rm(tmp, { force: true }).catch(() => {});
    throw err;
  }
}
