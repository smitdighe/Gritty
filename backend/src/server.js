/**
 * Thin HTTP API over Gritty's core. Every route calls straight into the same
 * core/cli functions the CLI uses — no business logic is reimplemented here.
 *
 * Config (all optional):
 *   PORT            listen port (default 8000)
 *   GRITTY_DATA_DIR repo root (default ./data)
 *   CORS_ORIGIN     allowed origin; defaults to "*" only outside production
 *   NODE_ENV        "production" tightens the CORS default
 */

import express from 'express';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { init } from './core/repo/init.js';
import { Repo } from './core/repo/repo.js';
import { computeStatus } from './core/workdir/workdir.js';
import { walkHistory } from './core/dag/walk.js';
import { parseTree } from './core/objects/tree.js';
import { parseCommit } from './core/objects/commit.js';
import { commitCommand } from './cli/commands/commit.js';
import { branchCommand } from './cli/commands/branch.js';
import { checkoutCommand } from './cli/commands/checkout.js';
import { diffCommand } from './cli/commands/diff.js';
import { GrittyError } from './util/errors.js';

/** Map a GrittyError code to an HTTP status. */
const HTTP_STATUS = {
  NotARepo: 404,
  RefNotFound: 404,
  BadObject: 400,
  UsageError: 400,
};

/** Wrap an async route so thrown/rejected errors reach the error middleware. */
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Split a concatenated unified diff into one `{ path, diffText }` per file,
 * splitting on each `diff --git a/<path> b/<path>` header.
 * @param {string} text
 * @returns {Array<{ path: string, diffText: string }>}
 */
function splitUnifiedDiff(text) {
  if (!text || !text.trim()) return [];
  return text
    .split(/\n(?=diff --git )/g)
    .map((block) => {
      const m = block.match(/^diff --git a\/(.+?) b\//);
      return { path: m ? m[1] : '', diffText: block };
    })
    .filter((d) => d.path);
}

/**
 * Build the Express app bound to a specific data directory. Exported (without
 * listening) so tests can drive it over an ephemeral port.
 * @param {string} dataDir absolute path to the repo root
 * @returns {import('express').Express}
 */
export function createApp(dataDir) {
  const app = express();
  app.use(express.json());

  // CORS: explicit origin, else "*" only when not in production.
  const corsOrigin =
    process.env.CORS_ORIGIN || (process.env.NODE_ENV === 'production' ? null : '*');
  app.use((req, res, next) => {
    if (corsOrigin) res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  const openRepo = () => Repo.find(dataDir);

  app.get('/health', (req, res) => res.json({ ok: true }));

  app.get(
    '/status',
    wrap(async (req, res) => {
      const repo = await openRepo();
      const s = await computeStatus(repo);
      res.json({
        branch: s.branch,
        headSha: s.headSha,
        staged: s.staged,
        unstaged: s.unstaged,
        untracked: s.untracked,
      });
    }),
  );

  app.get(
    '/log',
    wrap(async (req, res) => {
      const repo = await openRepo();
      const max = req.query.max ? parseInt(req.query.max, 10) : Infinity;
      const start = req.query.start
        ? await repo.resolveRevision(String(req.query.start))
        : await repo.resolveHead();
      // Response shape: an array of { sha, commit } (log.schema.ts).
      const commits = [];
      if (start) {
        for await (const { sha, commit } of walkHistory(repo.store, start, { limit: max })) {
          commits.push({ sha, commit });
        }
      }
      res.json(commits);
    }),
  );

  app.get(
    '/branches',
    wrap(async (req, res) => {
      const repo = await openRepo();
      res.json({ branches: await repo.refs.listBranches(), current: await repo.currentBranch() });
    }),
  );

  app.get(
    '/diff',
    wrap(async (req, res) => {
      const { a, b } = req.query;
      const revs = a && b ? [String(a), String(b)] : [];
      const diff = await diffCommand({ cwd: dataDir, revs });
      // Split the concatenated unified diff into one { path, diffText } per file.
      res.json(splitUnifiedDiff(diff));
    }),
  );

  app.get(
    '/objects/:sha',
    wrap(async (req, res) => {
      const repo = await openRepo();
      const sha = await repo.resolveRevision(req.params.sha); // allows HEAD / branch / full sha
      const obj = await repo.store.read(sha);
      // Discriminated on type (object.schema.ts):
      //   blob   → content is base64-encoded bytes (string)
      //   tree   → content is the list of entries
      //   commit → content is the parsed commit
      let content;
      if (obj.type === 'tree') content = parseTree(obj.content);
      else if (obj.type === 'commit') content = parseCommit(obj.content);
      else content = obj.content.toString('base64');
      res.json({ type: obj.type, size: obj.size, content });
    }),
  );

  app.post(
    '/commits',
    wrap(async (req, res) => {
      await commitCommand({ cwd: dataDir, message: req.body?.message });
      const repo = await openRepo();
      res.status(201).json({ sha: await repo.resolveHead(), branch: await repo.currentBranch() });
    }),
  );

  app.post(
    '/branches',
    wrap(async (req, res) => {
      const name = req.body?.name;
      await branchCommand({ cwd: dataDir, name });
      const repo = await openRepo();
      res.status(201).json({ name, sha: await repo.refs.read(`refs/heads/${name}`) });
    }),
  );

  app.post(
    '/checkout',
    wrap(async (req, res) => {
      const target = req.body?.target;
      await checkoutCommand({ cwd: dataDir, target });
      const repo = await openRepo();
      // Detached when HEAD no longer points at a branch (checked out a commit).
      res.json({ switchedTo: target, detached: (await repo.currentBranch()) === null });
    }),
  );

  // Central error handling: typed GrittyError → matching 4xx; anything else →
  // 500 with no stack leaked to the client (logged server-side instead).
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof GrittyError) {
      return res
        .status(HTTP_STATUS[err.code] ?? 400)
        .json({ error: { code: err.code, message: err.message } });
    }
    console.error('[gritty] unexpected error:', err);
    res.status(500).json({ error: { code: 'Internal', message: 'internal server error' } });
  });

  return app;
}

/** Resolve the data dir from the environment (absolute). */
export function resolveDataDir() {
  return path.resolve(process.env.GRITTY_DATA_DIR || './data');
}

/** Ensure a repo exists at `dataDir`, then start listening. */
export async function start() {
  const dataDir = resolveDataDir();
  await init(dataDir); // idempotent scaffold of .gritty
  const port = parseInt(process.env.PORT, 10) || 8000;
  const app = createApp(dataDir);
  return app.listen(port, () => {
    console.log(`Gritty API running at http://localhost:${port}`);
  });
}

// Run only when invoked directly (`node src/server.js`), not when imported.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  start().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
