/**
 * Object hashing — the heart of Git's content-addressable store.
 *
 * CORRECTNESS RULE #1: an object's id is the SHA-1 of its *uncompressed*
 * serialization `<type> <size>\0<content>`, where `<size>` is the byte length
 * of `<content>`. zlib compression happens later, for storage only, and must
 * never touch the hash.
 */

import { createHash } from 'node:crypto';

const HEX40 = /^[0-9a-f]{40}$/;

/**
 * SHA-1 of arbitrary bytes as a 40-char lowercase hex string.
 * @param {Buffer} buffer
 * @returns {string}
 */
export function sha1hex(buffer) {
  return createHash('sha1').update(buffer).digest('hex');
}

/**
 * Build the loose-object serialization that gets hashed and (after deflate)
 * stored: `<type> <size>\0<content>`.
 * @param {string} type e.g. "blob", "tree", "commit"
 * @param {Buffer} content raw object payload
 * @returns {Buffer}
 */
export function wrap(type, content) {
  const header = Buffer.from(`${type} ${content.length}`, 'latin1');
  return Buffer.concat([header, Buffer.from([0]), content]);
}

/**
 * The object id (40-hex SHA-1) for a type + content pair.
 * @param {string} type
 * @param {Buffer} content
 * @returns {string}
 */
export function hashObject(type, content) {
  return sha1hex(wrap(type, content));
}

/**
 * Convert a 40-char hex id to its 20 raw bytes (as used inside tree entries).
 * @param {string} hex
 * @returns {Buffer}
 */
export function hexToRaw(hex) {
  if (typeof hex !== 'string' || !HEX40.test(hex)) {
    throw new TypeError(`invalid object id: ${JSON.stringify(hex)}`);
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Convert 20 raw SHA bytes back to a 40-char hex id.
 * @param {Buffer} buf
 * @returns {string}
 */
export function rawToHex(buf) {
  if (!Buffer.isBuffer(buf) || buf.length !== 20) {
    throw new TypeError('raw SHA must be a 20-byte Buffer');
  }
  return buf.toString('hex');
}

/** True if `s` looks like a full 40-hex object id. */
export function isHex40(s) {
  return typeof s === 'string' && HEX40.test(s);
}
