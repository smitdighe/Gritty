<div align="center">
<pre>
 ██████╗  ██████╗ ██╗ ████████╗ ████████╗██╗   ██╗
██╔════╝ ██╔══██╗██║ ╚══██╔══╝ ╚══██╔══╝╚██╗ ██╔╝
██║  ███╗██████╔╝██║    ██║       ██║    ╚████╔╝ 
██║   ██║██╔══██╗██║    ██║       ██║     ╚██╔╝  
╚██████╔╝██║  ██║██║    ██║       ██║      ██║   
 ╚═════╝ ╚═╝  ╚═╝╚═╝    ╚═╝       ╚═╝      ╚═╝   
</pre>

### Every byte, hashed. Every history, exact.

</div>

> 💻 **Status:** Full-stack complete — CLI + HTTP API + web UI. No hosted demo yet; run locally (see [Getting Started](#️-getting-started)).

<div align="center">

**Gritty** is Git, reimplemented from scratch in Node.js — the object model, the DAG, refs, the index, and a working CLI. Not a wrapper around `libgit2`, `nodegit`, or the `git` binary: the internals are built from the byte level up, using only Node's standard library (`crypto`, `zlib`, `fs`, `path`, `buffer`). The gold standard for correctness is that **real Git can read what Gritty writes** — the test suite proves it against your installed `git` binary, not just against itself. A thin Express API exposes the same core over HTTP, and a React web UI sits on top, visualizing the commit DAG live as you commit, branch, and check out.

</div>

---

## 🔍 How It Works

**Core (CLI):**

```
worktree file  →  gritty add   →  Index (DIRC v2 — real binary format, sha1-checksummed)
                                        │
                                        ▼
Index snapshot →  gritty commit →  Tree objects (recursive, entries sorted git-style)
                                        │
                                        ▼
                                  Commit object (tree + parents + author + committer)
                                        │
                                        ▼
                                  Ref update (branch pointer → new sha, or detached HEAD)

Every object lands in objects/<sha[0:2]>/<sha[2:]>, content-addressed and zlib-deflated —
the hash is computed over the raw uncompressed bytes, deflate is storage-only.

gritty log      → walks parent pointers from HEAD, most-recent-first
gritty diff     → Myers diff (worktree vs index) or structural tree-vs-tree diff (commit vs commit)
gritty status   → three-way compare: HEAD tree ⇄ index ⇄ actual working directory
gritty checkout → diffs current vs target tree, blocks on colliding local edits, rewrites only what changed
```

**HTTP API + Web UI on top of the same model:**

```
Express API (backend/src/server.js) — thin wrapper, calls straight into the core, no logic duplicated
        │
        ▼
GET status/log/branches (polled)  →  commit-graph layout (generation + lane routing)
                                          │
                                          ▼
                              animated DAG — nodes = commits, pills = branch/HEAD pointers
                                          │
        checkout/commit/branch mutations  →  pointer slides to its new node (not a re-mount)

Worktree ⇄ Index ⇄ HEAD (from status)  →  three-column staging board
diffText (worktree-vs-index or commit-vs-commit)  →  Myers-op-aware diff viewer
```

Real `git` never shows up at runtime for any layer — only in the backend's test suite, as a parity oracle.

---

## ✨ Features

**Backend**

<table>
  <tr>
    <td align="center" width="220">
      <h3>🔬</h3>
      <b>Byte-Identical to Git</b><br/>
      <sub>Hash/tree/commit format verified against real <code>git</code> — <code>fsck</code>, <code>ls-tree</code>, <code>cat-file</code>, <code>status</code>, <code>diff</code> all agree</sub><br/>
    </td>
    <td align="center" width="220">
      <h3>🗃️</h3>
      <b>Real DIRC v2 Index</b><br/>
      <sub>Genuine binary index — <code>git ls-files --stage</code> reads Gritty's staging area directly</sub><br/>
    </td>
    <td align="center" width="220">
      <h3>🧵</h3>
      <b>Textbook Myers Diff</b><br/>
      <sub>O(ND) edit-script + unified-hunk formatting — matches <code>git diff</code> byte-for-byte, verified in tests</sub><br/>
    </td>
  </tr>
</table>

**Frontend**

<table>
  <tr>
    <td align="center" width="220">
      <h3>🕸️</h3>
      <b>Live Commit Graph</b><br/>
      <sub>Animated DAG — branch/HEAD pointers slide to their new node on commit/checkout instead of teleporting</sub><br/>
    </td>
    <td align="center" width="220">
      <h3>🗂️</h3>
      <b>Three-Way Staging Board</b><br/>
      <sub>Worktree / Index / HEAD columns, mirroring the exact comparison <code>gritty status</code> computes</sub><br/>
    </td>
    <td align="center" width="220">
      <h3>♿</h3>
      <b>Reduced-Motion Aware</b><br/>
      <sub>Every animated surface (graph, hash-reveal, transitions) degrades to instant state-changes under <code>prefers-reduced-motion</code></sub><br/>
    </td>
  </tr>
</table>

---

## 🛠️ Tech Stack

**Backend**

| Layer | Technology | Purpose |
|:------|:-----------|:--------|
| 🖥️ CLI | Node.js (ESM) + `commander` | Command wiring, typed-error → exit code mapping |
| 🌐 HTTP API | `express` | Thin server (`src/server.js`) wrapping the core — one route per operation, no logic duplicated |
| 🔐 Hashing | `node:crypto` | SHA-1 over `"<type> <size>\0<content>"` — object identity |
| 🗜️ Storage | `node:zlib` | Deflate/inflate for loose objects (storage-only, never hashed) |
| 📂 Filesystem | `node:fs`, `node:path`, `node:buffer` | Atomic writes, index metadata, tree walking — all funneled through `util/` |
| 🧪 Testing | `node:test` + real `git` (dev-time only) | Unit coverage + byte-for-byte parity oracles |

**Frontend**

| Layer | Technology | Purpose |
|:------|:-----------|:--------|
| ⚛️ Framework | React + Vite + TypeScript | Core UI and bundler |
| 🎨 Styling | Tailwind CSS | Dark-first, monospace-forward theme |
| 🎬 Animation | Framer Motion | Branch-pointer travel, hash-reveal, node entry |
| 🕸️ Graph | React Flow | Commit-DAG layout and rendering |
| 🔄 Server State | TanStack Query | Polling, optimistic mutations, cache invalidation |
| 🗄️ Client State | Zustand | Active repo, selected commit/branch |
| 🌐 API | Axios + Zod | Typed, runtime-validated calls into the backend |

---

## 📁 Project Structure

```bash
Gritty/
├── backend/
│   ├── bin/
│   │   └── gritty.js               # CLI entry (commander wiring)
│   ├── src/
│   │   ├── server.js               # Express HTTP API over the core
│   │   ├── core/
│   │   │   ├── objects/            # hash · objectStore · blob · tree · commit
│   │   │   ├── index/              # index · indexEntry · indexToTree (DIRC v2)
│   │   │   ├── refs/               # refs · head
│   │   │   ├── dag/                # walk (ancestry) · diff (Myers + tree-vs-tree)
│   │   │   ├── repo/                # repo (discovery, rev-parse) · init
│   │   │   └── workdir/            # workdir (status compare, checkout apply)
│   │   ├── cli/
│   │   │   ├── commands/           # init · add · commit · log · diff · status · branch · checkout
│   │   │   ├── identity.js
│   │   │   └── format.js
│   │   └── util/                   # fsx (atomic I/O) · zlibx · errors (typed GrittyError)
│   ├── test/                       # one suite per subsystem + real-git parity oracles
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── app/                    # App.tsx · router.tsx · providers.tsx
│   │   ├── api/
│   │   │   ├── client.ts
│   │   │   ├── endpoints/          # health · status · log · diff · branches · objects · commits · checkout
│   │   │   └── schemas/            # zod schemas mirroring backend response shapes
│   │   ├── types/
│   │   │   └── domain.ts           # Commit, TreeEntry, DiffChange, RepoStatus, BranchRef
│   │   ├── store/                  # repoStore · uiStore
│   │   ├── hooks/                  # useStatus · useLog · useDiff · useBranches · useCommitGraph
│   │   ├── features/
│   │   │   ├── commit-graph/       # signature element — animated DAG, live branch pointers
│   │   │   ├── staging-area/       # Worktree | Index | HEAD board
│   │   │   ├── diff-viewer/        # Myers-op-aware line rendering
│   │   │   ├── object-explorer/    # objects/xx/yyyy shard grid
│   │   │   ├── repo-status/
│   │   │   └── commit-log/
│   │   ├── components/
│   │   │   ├── ui/                 # Button, Panel, Tabs, Tooltip, Badge, Skeleton
│   │   │   └── layout/             # AppShell, Sidebar, TopBar
│   │   ├── pages/
│   │   └── lib/                    # motion.ts · format.ts
│   ├── .env.example
│   └── vite.config.ts
└── README.md
```

Backend dependency direction: **`util → core → cli`** (and `server.js` sits alongside `cli`, calling the same core). Nothing in `core` touches `fs`/`zlib` directly.

---

## 🧠 The Correctness Rules That Matter

These are the places naive Git clones go wrong; Gritty gets them right, and tests each one:

1. **Hashing.** An object's id is `SHA-1("<type> <size>\0<content>")` over the *uncompressed* bytes. zlib is storage-only and never touches the hash.
2. **Tree format.** Binary entries `"<mode> <name>\0" + 20 raw SHA bytes`, mode ASCII with no leading zero (`40000`, not `040000`). Entries sort by name with directories compared as if they end in `/`.
3. **Object storage.** `objects/<first-2>/<last-38>`, zlib-deflated, written atomically (temp + rename), skipped if already present.
4. **HEAD.** Symbolic (`ref: refs/heads/main\n`) or detached (raw 40-hex + `\n`).
5. **Commit format.** `tree`, then zero-or-more `parent` (order significant), `author`, `committer`, blank line, message.
6. **Default branch** is `main`.

The **index** is Git's real `DIRC` version-2 binary format — sorted entries, stat metadata, trailing SHA-1 checksum — so `git ls-files --stage` reads Gritty's staging area directly.

---

## ⚙️ Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- `git` installed locally — only needed for the backend test suite's parity oracles, not a runtime dependency

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/gritty.git
cd gritty
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

### 2. Run the CLI

```bash
cd backend
npm test                          # optional — full suite (64 tests) + real-git parity checks
npm link                          # optional: puts `gritty` on your PATH
node bin/gritty.js --help
```

A normal session:

```bash
gritty init
echo "hello" > README.md
gritty add .
gritty commit -m "first commit"
gritty log
gritty branch feature
gritty checkout feature
gritty status
gritty diff
```

Prove it to yourself — point **real Git** at a Gritty repo:

```bash
git --git-dir=.gritty --work-tree=. fsck        # validates the whole object graph
git --git-dir=.gritty log --oneline
git --git-dir=.gritty ls-tree -r HEAD
```

### 3. Run the API Server

```bash
cd backend
npm start                         # → Gritty API running at http://localhost:8000
```

Configurable via env (see `backend/.env.example`): `PORT` (default `8000`), `GRITTY_DATA_DIR` (repo root, default `./data`, scaffolded on startup), `CORS_ORIGIN` (defaults to `*` outside production).

```bash
curl http://localhost:8000/health    # → {"ok":true}
```

### 4. Run the Frontend

```bash
cd frontend
npm run dev
```

> Runs at `http://localhost:5173`. Set `VITE_API_BASE_URL` in `frontend/.env` to the backend URL — `http://localhost:8000` for the default setup. All three (API server + Vite dev server) need to be running at once.

---

## 📟 CLI Reference

| Command | Description |
|---|---|
| `gritty init [dir]` | Scaffold a `.gritty` repository |
| `gritty add <paths...>` | Stage files/dirs; a removed tracked path stages its deletion |
| `gritty commit -m <msg>` | Snapshot the index as a tree and record a commit |
| `gritty log` | Walk HEAD's ancestry (git "medium" format) |
| `gritty diff [a b]` | Working-vs-index (no args) or commit-vs-commit (Myers line diff) |
| `gritty status` | Staged / unstaged / untracked changes |
| `gritty branch [name]` | List branches, or create one at HEAD |
| `gritty checkout <target>` | Switch to a branch (symbolic HEAD) or commit (detached) |

---

## 🌐 HTTP API Reference

The API server (`backend/src/server.js`) exposes the same operations over HTTP. Typed `GrittyError`s map to `4xx` with `{ error: { code, message } }`; anything unexpected is a `500` with the stack logged server-side, never leaked in the body.

| Method & Route | Description |
|---|---|
| `GET /health` | Liveness — `{ ok: true }` |
| `GET /status` | Branch, HEAD sha, staged / unstaged / untracked |
| `GET /log?max=&start=` | Commit list from HEAD (or `start` rev), newest-first |
| `GET /branches` | Branch list + current branch |
| `GET /diff` | Working-tree-vs-index unified diff text |
| `GET /diff?a=&b=` | Commit-vs-commit diff |
| `GET /objects/:sha` | Object type/size/content (base64 for blob/tree, text for commit; accepts `HEAD`/branch/sha) |
| `POST /commits` `{ message }` | Create a commit from the staged index |
| `POST /branches` `{ name }` | Create a branch at HEAD |
| `POST /checkout` `{ target }` | Check out a branch or commit |

The frontend calls these through a thin, Zod-validated API layer (`frontend/src/api/endpoints/*.ts`), so response shapes are checked end-to-end.

---

## ⚠️ Known Limitations

- **No packfiles** — every object is stored loose; fine at portfolio scale, not built for large real-world histories
- **No merge command** — the object layer supports arbitrary multi-parent commits programmatically, but there's no CLI-driven three-way merge or conflict resolution
- **No remote operations** — no `clone`/`fetch`/`push`, no smart-HTTP transport
- **No tags** — not implemented in v1
- **Windows executable bit** isn't representable — status compares blob content instead (like `core.filemode=false`); symlinks check out as regular files. Object/tree/commit bytes stay identical across platforms regardless.
- **No multi-tenancy** in the API/web UI — one backend process serves one repo's working directory (`GRITTY_DATA_DIR`); a public multi-user demo would need per-session repos

---

## 🔮 Future Improvements

- **Merge command** — three-way merge with conflict markers, using the existing multi-parent commit support
- **Packfiles + delta compression** for realistic-sized histories
- **Tags** — lightweight and annotated
- **Minimal smart-HTTP** for `clone`/`fetch`/`push` against a remote
- **Multi-repo / multi-session support** in the API + web UI, for a real public demo
