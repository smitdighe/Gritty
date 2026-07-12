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
        head: s.headSha,
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
      const commits = [];
      if (start) {
        for await (const { sha, commit } of walkHistory(repo.store, start, { limit: max })) {
          commits.push({
            sha,
            tree: commit.tree,
            parents: commit.parents,
            author: commit.author,
            committer: commit.committer,
            message: commit.message,
          });
        }
      }
      res.json({ commits });
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
      res.json({ diff });
    }),
  );

  app.get(
    '/objects/:sha',
    wrap(async (req, res) => {
      const repo = await openRepo();
      const sha = await repo.resolveRevision(req.params.sha); // allows HEAD / branch / full sha
      const obj = await repo.store.read(sha);
      // Blobs and trees are binary → base64; commits are text.
      const encoding = obj.type === 'commit' ? 'utf8' : 'base64';
      res.json({ sha, type: obj.type, size: obj.size, encoding, content: obj.content.toString(encoding) });
    }),
  );

  app.post(
    '/commits',
    wrap(async (req, res) => {
      const result = await commitCommand({ cwd: dataDir, message: req.body?.message });
      const repo = await openRepo();
      res.status(201).json({ result, head: await repo.resolveHead() });
    }),
  );

  app.post(
    '/branches',
    wrap(async (req, res) => {
      await branchCommand({ cwd: dataDir, name: req.body?.name });
      res.status(201).json({ ok: true, name: req.body?.name });
    }),
  );

  app.post(
    '/checkout',
    wrap(async (req, res) => {
      const result = await checkoutCommand({ cwd: dataDir, target: req.body?.target });
      res.json({ result });
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
