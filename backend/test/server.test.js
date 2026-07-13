import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import { createApp } from '../src/server.js';
import { init } from '../src/core/repo/init.js';
import { addCommand } from '../src/cli/commands/add.js';
import { makeTempDir, rmDir } from './helpers/git.js';

let server;
let baseUrl;
let dataDir;

before(async () => {
  dataDir = makeTempDir('gritty-server-');
  await init(dataDir);
  const app = createApp(dataDir);
  await new Promise((resolve) => {
    server = app.listen(0, resolve); // ephemeral port
  });
  baseUrl = `http://localhost:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  rmDir(dataDir);
});

const get = (p) => fetch(`${baseUrl}${p}`);
const post = (p, body) =>
  fetch(`${baseUrl}${p}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

test('GET /health returns 200 { ok: true }', async () => {
  const res = await get('/health');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
});

test('GET /status on a fresh repo: unborn branch, no head', async () => {
  const res = await get('/status');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.branch, 'main');
  assert.equal(body.headSha, null);
});

test('POST /checkout with an invalid target returns 404 RefNotFound', async () => {
  const res = await post('/checkout', { target: 'does-not-exist' });
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.equal(body.error.code, 'RefNotFound');
  assert.match(body.error.message, /unknown revision/);
});

test('POST /commits with empty message returns 400 UsageError', async () => {
  const res = await post('/commits', { message: '' });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.code, 'UsageError');
});

test('a staged commit round-trips through /commits then /status and /log', async () => {
  // Stage a file directly through the core (same path the CLI uses).
  await fs.writeFile(path.join(dataDir, 'hello.txt'), 'hi\n');
  await addCommand({ cwd: dataDir, paths: ['.'] });

  const commitRes = await post('/commits', { message: 'first via API' });
  assert.equal(commitRes.status, 201);
  const commitBody = await commitRes.json();
  assert.match(commitBody.sha, /^[0-9a-f]{40}$/);
  assert.equal(commitBody.branch, 'main');

  // /status now reports the new HEAD and a clean tree.
  const status = await (await get('/status')).json();
  assert.equal(status.headSha, commitBody.sha);
  assert.deepEqual(status.unstaged, []);
  assert.deepEqual(status.untracked, []);

  // /log is an array of { sha, commit }.
  const log = await (await get('/log')).json();
  assert.equal(log.length, 1);
  assert.equal(log[0].sha, commitBody.sha);
  assert.equal(log[0].commit.message.trim(), 'first via API');

  // /objects/HEAD returns the commit object, parsed.
  const obj = await (await get(`/objects/${commitBody.sha}`)).json();
  assert.equal(obj.type, 'commit');
  assert.match(obj.content.tree, /^[0-9a-f]{40}$/);
});

test('POST /branches creates a branch shown by /branches', async () => {
  const res = await post('/branches', { name: 'feature' });
  assert.equal(res.status, 201);
  const created = await res.json();
  assert.equal(created.name, 'feature');
  assert.match(created.sha, /^[0-9a-f]{40}$/);
  const list = await (await get('/branches')).json();
  const names = list.branches.map((b) => b.name).sort();
  assert.deepEqual(names, ['feature', 'main']);
  assert.equal(list.current, 'main');
});

test('GET /diff returns an array of { path, diffText } per file', async () => {
  // Modify the committed file in the worktree (unstaged change).
  await fs.writeFile(path.join(dataDir, 'hello.txt'), 'changed\n');
  const diff = await (await get('/diff')).json();
  assert.ok(Array.isArray(diff));
  const entry = diff.find((d) => d.path === 'hello.txt');
  assert.ok(entry, 'hello.txt present in diff');
  assert.match(entry.diffText, /^diff --git a\/hello\.txt b\/hello\.txt/);
});
