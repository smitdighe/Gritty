/**
 * Promisified zlib. Git stores objects as raw zlib streams (RFC 1950), which is
 * exactly what `zlib.deflate` / `zlib.inflate` produce and consume. Compression
 * is a storage concern only — it never affects an object's hash.
 */

import zlib from 'node:zlib';
import { promisify } from 'node:util';

/** @type {(buf: Buffer) => Promise<Buffer>} */
export const deflate = promisify(zlib.deflate);

/** @type {(buf: Buffer) => Promise<Buffer>} */
export const inflate = promisify(zlib.inflate);
