import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashObject, wrap, hexToRaw, rawToHex, isHex40 } from '../src/core/objects/hash.js';

test('blob hash matches well-known git ids', () => {
  // `printf 'hello\n' | git hash-object --stdin`
  assert.equal(hashObject('blob', Buffer.from('hello\n')), 'ce013625030ba8dba906f756967f9e9ca394464a');
  // The empty blob — a constant every Git user has seen.
  assert.equal(hashObject('blob', Buffer.from('')), 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391');
});

test('wrap builds "<type> <size>\\0<content>" with a byte-length size', () => {
  const w = wrap('blob', Buffer.from('abc'));
  assert.equal(w.toString('latin1'), 'blob 3\x00abc');

  // Size is the *byte* length, not the character count.
  const utf8 = Buffer.from('é'); // 2 bytes in UTF-8
  const w2 = wrap('blob', utf8);
  assert.equal(w2.subarray(0, w2.indexOf(0)).toString('latin1'), 'blob 2');
});

test('hex <-> raw round-trips', () => {
  const hex = 'ce013625030ba8dba906f756967f9e9ca394464a';
  const raw = hexToRaw(hex);
  assert.equal(raw.length, 20);
  assert.equal(rawToHex(raw), hex);
});

test('hexToRaw rejects malformed ids', () => {
  assert.throws(() => hexToRaw('xyz'), TypeError);
  assert.throws(() => hexToRaw('ABCDEF'), TypeError); // uppercase / wrong length
  assert.throws(() => hexToRaw('ce013625030ba8dba906f756967f9e9ca394464'), TypeError); // 39 chars
});

test('isHex40 discriminates full ids', () => {
  assert.equal(isHex40('ce013625030ba8dba906f756967f9e9ca394464a'), true);
  assert.equal(isHex40('main'), false);
  assert.equal(isHex40('CE013625030BA8DBA906F756967F9E9CA394464A'), false);
});
