import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  Mode,
  compareEntries,
  serializeTree,
  parseTree,
  entryType,
} from '../src/core/objects/tree.js';

test('mode constants have no leading zero for directories', () => {
  assert.equal(Mode.DIR, '40000'); // NOT 040000
  assert.equal(Mode.FILE, '100644');
  assert.equal(Mode.EXEC, '100755');
  assert.equal(Mode.SYMLINK, '120000');
});

test('entryType infers object kind from mode', () => {
  assert.equal(entryType(Mode.DIR), 'tree');
  assert.equal(entryType(Mode.FILE), 'blob');
  assert.equal(entryType(Mode.EXEC), 'blob');
  assert.equal(entryType(Mode.SYMLINK), 'blob');
  assert.equal(entryType(Mode.GITLINK), 'commit');
});

test('a directory sorts as if its name ends in "/"', () => {
  // "foo" (dir) vs "foo.txt" (file): dir compares as "foo/", and '.' (0x2e)
  // sorts before '/' (0x2f), so the file must come first.
  const dir = { mode: Mode.DIR, name: 'foo' };
  const file = { mode: Mode.FILE, name: 'foo.txt' };
  assert.ok(compareEntries(file, dir) < 0);
  assert.ok(compareEntries(dir, file) > 0);
});

test('a file named like a dir prefix sorts before the dir', () => {
  // plain "foo" (file) ends at 0, "foo" (dir) extends to '/', so file < dir.
  const file = { mode: Mode.FILE, name: 'foo' };
  const dir = { mode: Mode.DIR, name: 'foo' };
  assert.ok(compareEntries(file, dir) < 0);
});

test('serializeTree emits "<mode> <name>\\0<20 raw bytes>" sorted', () => {
  const entries = [
    { mode: Mode.FILE, name: 'b.txt', sha: 'aa'.repeat(20) },
    { mode: Mode.FILE, name: 'a.txt', sha: 'bb'.repeat(20) },
  ];
  const buf = serializeTree(entries);
  // "a.txt" must precede "b.txt": first bytes are its header.
  assert.equal(buf.subarray(0, '100644 a.txt'.length).toString('latin1'), '100644 a.txt');
  // Entry: header + NUL + 20 raw SHA bytes, twice.
  assert.equal(buf.length, ('100644 a.txt'.length + 1 + 20) * 2);
});

test('parseTree round-trips serializeTree', () => {
  const entries = [
    { mode: Mode.DIR, name: 'src', sha: '11'.repeat(20) },
    { mode: Mode.FILE, name: 'README.md', sha: '22'.repeat(20) },
    { mode: Mode.EXEC, name: 'build.sh', sha: '33'.repeat(20) },
  ];
  const parsed = parseTree(serializeTree(entries));
  // Parsed order is the canonical sorted order.
  const sorted = [...entries].sort(compareEntries);
  assert.deepEqual(parsed, sorted);
});
