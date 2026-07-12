import { describe, it, expect } from 'vitest';
import { parseFileDiff, parseDiffFiles, diffStats } from './diff';

describe('parseFileDiff — modified file', () => {
  const text = [
    'diff --git a/a.txt b/a.txt',
    '--- a/a.txt',
    '+++ b/a.txt',
    '@@ -1,3 +1,3 @@',
    ' line1',
    '-line2',
    '+line2new',
    ' line3',
  ].join('\n');

  const file = parseFileDiff(text);

  it('reports path, change kind, and non-binary', () => {
    expect(file.path).toBe('a.txt');
    expect(file.changeKind).toBe('modified');
    expect(file.binary).toBe(false);
    expect(file.hunks).toHaveLength(1);
  });

  it('assigns correct old/new line numbers', () => {
    const lines = file.hunks[0].lines;
    expect(lines.map((l) => l.kind)).toEqual(['context', 'del', 'add', 'context']);
    expect(lines[0]).toMatchObject({ oldLineNo: 1, newLineNo: 1 });
    expect(lines[1]).toMatchObject({ kind: 'del', oldLineNo: 2, newLineNo: null });
    expect(lines[2]).toMatchObject({ kind: 'add', oldLineNo: null, newLineNo: 2 });
    expect(lines[3]).toMatchObject({ oldLineNo: 3, newLineNo: 3 });
  });

  it('computes add/del stats', () => {
    expect(diffStats(file)).toEqual({ additions: 1, deletions: 1 });
  });
});

describe('parseFileDiff — added file', () => {
  const text = [
    'diff --git a/new.txt b/new.txt',
    'new file mode 100644',
    '--- /dev/null',
    '+++ b/new.txt',
    '@@ -0,0 +1,2 @@',
    '+hello',
    '+world',
  ].join('\n');
  const file = parseFileDiff(text);

  it('is marked added with the new mode', () => {
    expect(file.changeKind).toBe('added');
    expect(file.newMode).toBe('100644');
  });
  it('has only added lines', () => {
    expect(file.hunks[0].lines.every((l) => l.kind === 'add')).toBe(true);
    expect(diffStats(file)).toEqual({ additions: 2, deletions: 0 });
  });
});

describe('parseFileDiff — deleted file', () => {
  const text = [
    'diff --git a/old.txt b/old.txt',
    'deleted file mode 100644',
    '--- a/old.txt',
    '+++ /dev/null',
    '@@ -1 +0,0 @@',
    '-bye',
  ].join('\n');
  const file = parseFileDiff(text);

  it('is marked deleted with the old mode and default hunk counts', () => {
    expect(file.changeKind).toBe('deleted');
    expect(file.oldMode).toBe('100644');
    expect(file.hunks[0].oldCount).toBe(1);
    expect(file.hunks[0].newCount).toBe(0);
    expect(file.hunks[0].lines[0]).toMatchObject({ kind: 'del', content: 'bye', oldLineNo: 1 });
  });
});

describe('parseFileDiff — no newline at EOF', () => {
  const text = [
    'diff --git a/n.txt b/n.txt',
    '--- a/n.txt',
    '+++ b/n.txt',
    '@@ -1 +1 @@',
    '-old',
    '\\ No newline at end of file',
    '+new',
    '\\ No newline at end of file',
  ].join('\n');
  const file = parseFileDiff(text);

  it('flags the preceding line and does not emit a diff line for the marker', () => {
    const lines = file.hunks[0].lines;
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ kind: 'del', content: 'old', noNewline: true });
    expect(lines[1]).toMatchObject({ kind: 'add', content: 'new', noNewline: true });
  });
});

describe('parseFileDiff — binary file', () => {
  const text = [
    'diff --git a/img.png b/img.png',
    'Binary files a/img.png and b/img.png differ',
  ].join('\n');
  const file = parseFileDiff(text);

  it('is marked binary with no hunks', () => {
    expect(file.binary).toBe(true);
    expect(file.hunks).toHaveLength(0);
    expect(file.path).toBe('img.png');
  });
});

describe('parseFileDiff — multiple hunks', () => {
  const text = [
    'diff --git a/m.txt b/m.txt',
    '--- a/m.txt',
    '+++ b/m.txt',
    '@@ -1,2 +1,2 @@',
    ' a',
    '-b',
    '+B',
    '@@ -10,2 +10,3 @@',
    ' j',
    '+k',
    ' l',
  ].join('\n');
  const file = parseFileDiff(text);

  it('parses each hunk with independent line numbering', () => {
    expect(file.hunks).toHaveLength(2);
    expect(file.hunks[1].oldStart).toBe(10);
    expect(file.hunks[1].newStart).toBe(10);
    const h2 = file.hunks[1].lines;
    expect(h2[0]).toMatchObject({ oldLineNo: 10, newLineNo: 10 });
    expect(h2[1]).toMatchObject({ kind: 'add', newLineNo: 11, oldLineNo: null });
    expect(h2[2]).toMatchObject({ kind: 'context', oldLineNo: 11, newLineNo: 12 });
    expect(diffStats(file)).toEqual({ additions: 2, deletions: 1 });
  });
});

describe('parseDiffFiles', () => {
  it('parses an array of file blocks', () => {
    const files = parseDiffFiles([
      { path: 'a.txt', diffText: 'diff --git a/a.txt b/a.txt\nBinary files a/a.txt and b/a.txt differ' },
    ]);
    expect(files).toHaveLength(1);
    expect(files[0].binary).toBe(true);
  });
});
