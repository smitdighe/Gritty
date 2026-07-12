import { describe, it, expect } from 'vitest';
import { parseHealth } from './health.schema';
import { parseStatus } from './status.schema';
import { parseCommit, parseLog, parseCommitResult } from './commit.schema';
import { parseDiff } from './diff.schema';
import { parseBranchList, parseCheckoutResult } from './branch.schema';
import { parseObject, parseTreeEntry } from './object.schema';
import { parseApiErrorBody, isGrittyApiErrorBody } from './error.schema';

const ident = { name: 'Ada', email: 'ada@x.dev', timestamp: 1609459200, timezone: '+0000' };
const commit = { tree: 'a'.repeat(40), parents: ['b'.repeat(40)], author: ident, committer: ident, message: 'init\n' };

describe('health.schema', () => {
  it('parses a valid body', () => {
    expect(parseHealth({ ok: true })).toEqual({ ok: true });
  });
  it('throws on malformed', () => {
    expect(() => parseHealth({ ok: 'yes' })).toThrow();
    expect(() => parseHealth({})).toThrow();
  });
});

describe('status.schema', () => {
  const valid = {
    branch: 'main',
    headSha: 'c'.repeat(40),
    staged: [{ path: 'a.txt', type: 'new file' }],
    unstaged: [{ path: 'b.txt', type: 'modified' }],
    untracked: ['c.txt'],
  };
  it('parses a valid status (incl. null branch/head)', () => {
    expect(parseStatus(valid).branch).toBe('main');
    expect(parseStatus({ ...valid, branch: null, headSha: null }).headSha).toBeNull();
  });
  it('throws on an invalid change type', () => {
    expect(() => parseStatus({ ...valid, staged: [{ path: 'x', type: 'renamed' }] })).toThrow();
  });
  it('throws when a required field is missing', () => {
    expect(() => parseStatus({ branch: 'main' })).toThrow();
  });
});

describe('commit.schema', () => {
  it('parses a commit, log, and commit result', () => {
    expect(parseCommit(commit).tree).toBe('a'.repeat(40));
    expect(parseLog([{ sha: 'd'.repeat(40), commit }])).toHaveLength(1);
    expect(parseCommitResult({ sha: 'e'.repeat(40), branch: null })).toEqual({
      sha: 'e'.repeat(40),
      branch: null,
    });
  });
  it('throws on a malformed identity', () => {
    expect(() => parseCommit({ ...commit, author: { name: 'x' } })).toThrow();
  });
});

describe('diff.schema', () => {
  it('parses an array of file diffs', () => {
    const out = parseDiff([{ path: 'a.txt', diffText: 'diff --git a/a.txt b/a.txt' }]);
    expect(out[0].path).toBe('a.txt');
  });
  it('throws when diffText is missing', () => {
    expect(() => parseDiff([{ path: 'a.txt' }])).toThrow();
  });
});

describe('branch.schema', () => {
  it('parses a branch list and checkout result', () => {
    expect(
      parseBranchList({ branches: [{ name: 'main', sha: 'f'.repeat(40) }], current: 'main' }).current,
    ).toBe('main');
    expect(parseCheckoutResult({ switchedTo: 'main', detached: false }).detached).toBe(false);
  });
  it('throws on a malformed branch list', () => {
    expect(() => parseBranchList({ branches: [{ name: 'main' }], current: null })).toThrow();
  });
});

describe('object.schema', () => {
  it('parses each object variant', () => {
    expect(parseObject({ type: 'blob', size: 5, content: 'aGVsbG8=' }).type).toBe('blob');
    expect(parseObject({ type: 'tree', size: 1, content: [{ mode: '100644', name: 'a', sha: '0'.repeat(40) }] }).type).toBe('tree');
    expect(parseObject({ type: 'commit', size: 10, content: commit }).type).toBe('commit');
    expect(parseTreeEntry({ mode: '40000', name: 'dir', sha: '1'.repeat(40) }).mode).toBe('40000');
  });
  it('throws when content does not match the discriminant', () => {
    // blob content must be a string, not entries.
    expect(() => parseObject({ type: 'blob', size: 1, content: [] })).toThrow();
    expect(() => parseObject({ type: 'nope', size: 1, content: '' })).toThrow();
  });
});

describe('error.schema', () => {
  it('parses and recognizes a GrittyError body', () => {
    const body = { error: { code: 'NotARepo', message: 'not a gritty repository' } };
    expect(parseApiErrorBody(body).error.code).toBe('NotARepo');
    expect(isGrittyApiErrorBody(body)).toBe(true);
  });
  it('rejects a non-GrittyError body', () => {
    expect(isGrittyApiErrorBody({ message: 'oops' })).toBe(false);
    expect(() => parseApiErrorBody({ error: { code: 1, message: 'x' } })).toThrow();
  });
});
