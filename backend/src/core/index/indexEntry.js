/**
 * A single index (staging area) entry, and the binary (de)serialization of one
 * entry in git's `DIRC` version-2 index format.
 *
 * On-disk layout of one entry (all integers big-endian):
 *   ctime sec/nsec (4+4), mtime sec/nsec (4+4), dev (4), ino (4), mode (4),
 *   uid (4), gid (4), size (4), sha (20 raw), flags (2), name (var), then
 *   1–8 NUL bytes padding so the whole entry is a multiple of 8 bytes.
 * The 62-byte fixed prefix is followed by the NUL-terminated name.
 */

import { hexToRaw, rawToHex } from '../objects/hash.js';
import { Mode } from '../objects/tree.js';
import { BadObject } from '../../util/errors.js';

/** Bytes before the name in a v2 entry. */
const NAME_OFFSET = 62;

/** git object modes as integers. */
export const GitMode = Object.freeze({
  REGULAR: 0o100644,
  EXEC: 0o100755,
  SYMLINK: 0o120000,
});

/**
 * Derive the canonical git mode from an lstat result.
 * @param {{ isSymbolicLink: boolean, rawMode: number }} st
 * @returns {number}
 */
export function gitModeFromStat(st) {
  if (st.isSymbolicLink) return GitMode.SYMLINK;
  // Honor the owner-execute bit where the OS reports it (POSIX); on Windows this
  // bit isn't meaningful and files come through as regular, matching git there.
  return st.rawMode & 0o100 ? GitMode.EXEC : GitMode.REGULAR;
}

/** Convert a numeric git mode to the ASCII string used in tree entries. */
export function modeToTreeString(mode) {
  switch (mode) {
    case GitMode.REGULAR:
      return Mode.FILE;
    case GitMode.EXEC:
      return Mode.EXEC;
    case GitMode.SYMLINK:
      return Mode.SYMLINK;
    default:
      return mode.toString(8);
  }
}

/**
 * Build an index entry from lstat fields + a blob sha + a repo-relative path.
 * @param {import('../../util/fsx.js').lstatIndexFields extends (p:any)=>Promise<infer R> ? NonNullable<R> : any} st
 * @param {string} sha
 * @param {string} relPath forward-slash separated, relative to the repo root
 * @returns {IndexEntry}
 */
export function entryFromStat(st, sha, relPath) {
  return {
    ctimeSec: st.ctimeSec,
    ctimeNano: st.ctimeNano,
    mtimeSec: st.mtimeSec,
    mtimeNano: st.mtimeNano,
    dev: st.dev,
    ino: st.ino,
    mode: gitModeFromStat(st),
    uid: st.uid,
    gid: st.gid,
    size: st.size,
    sha,
    stage: 0,
    path: relPath,
  };
}

/**
 * @typedef {object} IndexEntry
 * @property {number} ctimeSec
 * @property {number} ctimeNano
 * @property {number} mtimeSec
 * @property {number} mtimeNano
 * @property {number} dev
 * @property {number} ino
 * @property {number} mode git mode integer (e.g. 0o100644)
 * @property {number} uid
 * @property {number} gid
 * @property {number} size
 * @property {string} sha 40-hex
 * @property {number} stage merge stage 0-3 (always 0 in v1)
 * @property {string} path repo-relative, '/'-separated
 */

/**
 * Serialize one entry, including its trailing NUL padding.
 * @param {IndexEntry} e
 * @returns {Buffer}
 */
export function serializeEntry(e) {
  const nameBuf = Buffer.from(e.path, 'utf8');
  const totalLen = (NAME_OFFSET + nameBuf.length + 8) & ~7; // >= name + 1 NUL, multiple of 8
  const buf = Buffer.alloc(totalLen); // zero-filled → NUL terminator + padding for free

  let o = 0;
  const u32 = (v) => {
    buf.writeUInt32BE(v >>> 0, o);
    o += 4;
  };
  u32(e.ctimeSec);
  u32(e.ctimeNano);
  u32(e.mtimeSec);
  u32(e.mtimeNano);
  u32(e.dev);
  u32(e.ino);
  u32(e.mode);
  u32(e.uid);
  u32(e.gid);
  u32(e.size);
  hexToRaw(e.sha).copy(buf, o);
  o += 20;
  const nameLen = Math.min(nameBuf.length, 0xfff);
  const flags = ((e.stage & 0x3) << 12) | nameLen;
  buf.writeUInt16BE(flags, o);
  o += 2;
  nameBuf.copy(buf, o);
  return buf;
}

/**
 * Parse one entry starting at `offset`.
 * @param {Buffer} buf whole index buffer
 * @param {number} offset
 * @returns {{ entry: IndexEntry, next: number }}
 */
export function parseEntry(buf, offset) {
  let o = offset;
  const u32 = () => {
    const v = buf.readUInt32BE(o);
    o += 4;
    return v;
  };
  const ctimeSec = u32();
  const ctimeNano = u32();
  const mtimeSec = u32();
  const mtimeNano = u32();
  const dev = u32();
  const ino = u32();
  const mode = u32();
  const uid = u32();
  const gid = u32();
  const size = u32();
  const sha = rawToHex(buf.subarray(o, o + 20));
  o += 20;
  const flags = buf.readUInt16BE(o);
  o += 2;
  const stage = (flags >> 12) & 0x3;
  const nameLen = flags & 0xfff;

  let nameEnd;
  if (nameLen < 0xfff) {
    nameEnd = o + nameLen;
  } else {
    // Name too long to encode its length in flags: read up to the NUL.
    nameEnd = buf.indexOf(0, o);
    if (nameEnd < 0) throw new BadObject('index entry name is unterminated');
  }
  const path = buf.toString('utf8', o, nameEnd);

  // Skip name + at least one NUL, padded so the entry length is a multiple of 8.
  const entryLen = (NAME_OFFSET + (nameEnd - o) + 8) & ~7;
  const next = offset + entryLen;

  return {
    entry: { ctimeSec, ctimeNano, mtimeSec, mtimeNano, dev, ino, mode, uid, gid, size, sha, stage, path },
    next,
  };
}
