/**
 * The loose-object database: read/write/exists for any object type.
 *
 * On-disk layout (CORRECTNESS RULE #3): an object with id `abcd…` lives at
 * `<objects>/ab/cd…` — first 2 hex chars name the directory, remaining 38 the
 * file. Contents are the zlib-deflated `<type> <size>\0<content>` serialization.
 * Objects are immutable and content-addressed, so writes are atomic and a write
 * of an already-present object is a no-op.
 */

import path from 'node:path';
import { hashObject, wrap } from './hash.js';
import { deflate, inflate } from '../../util/zlibx.js';
import { atomicWrite, pathExists, readIfExists } from '../../util/fsx.js';
import { BadObject } from '../../util/errors.js';

export class ObjectStore {
  /**
   * @param {string} objectsDir absolute path to `.gritty/objects`
   */
  constructor(objectsDir) {
    this.objectsDir = objectsDir;
  }

  /** Absolute path where object `sha` is (or would be) stored. */
  objectPath(sha) {
    return path.join(this.objectsDir, sha.slice(0, 2), sha.slice(2));
  }

  /** @param {string} sha @returns {Promise<boolean>} */
  async has(sha) {
    return pathExists(this.objectPath(sha));
  }

  /**
   * Store a `type`/`content` object, returning its id. No-op if the object is
   * already present.
   * @param {string} type
   * @param {Buffer} content
   * @returns {Promise<string>} 40-hex object id
   */
  async write(type, content) {
    if (!Buffer.isBuffer(content)) {
      throw new TypeError('object content must be a Buffer');
    }
    const sha = hashObject(type, content);
    if (await this.has(sha)) return sha;
    const compressed = await deflate(wrap(type, content));
    await atomicWrite(this.objectPath(sha), compressed);
    return sha;
  }

  /**
   * Read and parse an object by id.
   * @param {string} sha
   * @returns {Promise<{ type: string, size: number, content: Buffer }>}
   */
  async read(sha) {
    const compressed = await readIfExists(this.objectPath(sha));
    if (compressed === null) {
      throw new BadObject(`object not found: ${sha}`);
    }
    let raw;
    try {
      raw = await inflate(compressed);
    } catch (err) {
      throw new BadObject(`object ${sha} is not a valid zlib stream: ${err.message}`);
    }
    return parseRaw(sha, raw);
  }

  /**
   * Read an object, asserting it is of `expectedType`.
   * @param {string} sha
   * @param {string} expectedType
   */
  async readTyped(sha, expectedType) {
    const obj = await this.read(sha);
    if (obj.type !== expectedType) {
      throw new BadObject(`expected ${expectedType} but ${sha} is a ${obj.type}`);
    }
    return obj;
  }
}

/**
 * Split a decompressed loose object into header + payload and validate it.
 * @param {string} sha id used only for error messages
 * @param {Buffer} raw the `<type> <size>\0<content>` bytes
 */
function parseRaw(sha, raw) {
  const nul = raw.indexOf(0);
  if (nul < 0) {
    throw new BadObject(`object ${sha} has no header terminator`);
  }
  const header = raw.toString('latin1', 0, nul);
  const space = header.indexOf(' ');
  if (space < 0) {
    throw new BadObject(`object ${sha} has a malformed header: ${JSON.stringify(header)}`);
  }
  const type = header.slice(0, space);
  const size = Number(header.slice(space + 1));
  const content = raw.subarray(nul + 1);
  if (!Number.isInteger(size) || size < 0 || content.length !== size) {
    throw new BadObject(
      `object ${sha} size mismatch: header says ${header.slice(space + 1)}, payload is ${content.length} bytes`,
    );
  }
  return { type, size, content };
}
