/**
 * Blobs — the simplest object. A blob's content *is* the file's bytes, with no
 * added framing beyond the standard `blob <size>\0` header applied by the store.
 */

import { hashObject } from './hash.js';
import { BadObject } from '../../util/errors.js';

/**
 * Coerce blob input to a Buffer. Strings are treated as UTF-8; Buffers pass
 * through untouched so binary files stay byte-exact.
 * @param {Buffer|string} content
 * @returns {Buffer}
 */
function toBuffer(content) {
  return Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
}

/**
 * The id a blob would have, without writing it.
 * @param {Buffer|string} content
 * @returns {string}
 */
export function blobId(content) {
  return hashObject('blob', toBuffer(content));
}

/**
 * Write a blob to the store and return its id.
 * @param {import('./objectStore.js').ObjectStore} store
 * @param {Buffer|string} content
 * @returns {Promise<string>}
 */
export async function writeBlob(store, content) {
  return store.write('blob', toBuffer(content));
}

/**
 * Read a blob's raw bytes from the store.
 * @param {import('./objectStore.js').ObjectStore} store
 * @param {string} sha
 * @returns {Promise<Buffer>}
 */
export async function readBlob(store, sha) {
  const obj = await store.read(sha);
  if (obj.type !== 'blob') {
    throw new BadObject(`expected blob but ${sha} is a ${obj.type}`);
  }
  return obj.content;
}
