/**
 * Hand-written domain types for the Gritty backend contract. These mirror the
 * shapes produced by `backend/src/core/*` (commit.js parseCommit, workdir.js
 * computeStatus, dag/diff.js, objectStore.js) as surfaced by the thin REST
 * wrapper. The zod schemas in `src/api/schemas/*.schema.ts` mirror these
 * exactly; a compile-time assertion in each schema file guards against drift.
 */

/** A git author/committer identity. `timestamp` is Unix seconds; `timezone` is a signed 4-digit offset (`+0000`, `-0530`). */
export interface Ident {
  name: string;
  email: string;
  timestamp: number;
  timezone: string;
}

/** A parsed commit object (core/objects/commit.js). Parent order is significant. */
export interface Commit {
  tree: string;
  parents: string[];
  author: Ident;
  committer: Ident;
  message: string;
}

/** One entry of a tree object (core/objects/tree.js). `mode` is ASCII, no leading zero. */
export interface TreeEntry {
  mode: string;
  name: string;
  sha: string;
}

/** A staging-area entry as serialized from git's DIRC v2 index (core/index/indexEntry.js). */
export interface IndexEntryDTO {
  ctimeSec: number;
  ctimeNano: number;
  mtimeSec: number;
  mtimeNano: number;
  dev: number;
  ino: number;
  /** git mode as an integer, e.g. 0o100644. */
  mode: number;
  uid: number;
  gid: number;
  size: number;
  sha: string;
  /** merge stage 0-3 (always 0 in v1). */
  stage: number;
  path: string;
}

/** A single status change (staged or unstaged) — HEAD↔index or index↔worktree. */
export type StatusChangeType = 'new file' | 'modified' | 'deleted';
export interface StatusChange {
  path: string;
  type: StatusChangeType;
}

/** Repository status (core/workdir/workdir.js computeStatus). */
export interface RepoStatus {
  branch: string | null;
  headSha: string | null;
  staged: StatusChange[];
  unstaged: StatusChange[];
  untracked: string[];
}

/**
 * One file's diff in a /diff response. ASSUMPTION (see diff.schema.ts): the
 * wrapper returns raw unified-diff text per file. `diffText` is the exact
 * `diff --git …` block produced by dag/diff.js unifiedDiff.
 */
export interface DiffChange {
  path: string;
  diffText: string;
}

/** One entry in a log listing: the commit id plus its parsed body. */
export interface LogEntry {
  sha: string;
  commit: Commit;
}

/** A branch ref: its short name and the commit it points at. */
export interface BranchRef {
  name: string;
  sha: string;
}

/** The /branches response: all refs plus the current branch (null when detached). */
export interface BranchList {
  branches: BranchRef[];
  current: string | null;
}

/** POST /checkout result. */
export interface CheckoutResult {
  switchedTo: string;
  detached: boolean;
}

/** POST /commits result. */
export interface CommitResult {
  sha: string;
  branch: string | null;
}

/** GET /health result. */
export interface Health {
  ok: boolean;
}

/**
 * A read object (GET /objects/:sha). Discriminated on `type`. Blob content is
 * base64-encoded; tree content is entries; commit content is a parsed commit.
 */
export type GritObject =
  | { type: 'blob'; size: number; content: string }
  | { type: 'tree'; size: number; content: TreeEntry[] }
  | { type: 'commit'; size: number; content: Commit };

/** Stable machine-readable error codes thrown by backend core (util/errors.js). */
export type GrittyErrorCode = 'NotARepo' | 'BadObject' | 'RefNotFound' | 'UsageError' | (string & {});

/** The JSON body the wrapper surfaces for a typed GrittyError. */
export interface GrittyApiErrorBody {
  error: {
    code: GrittyErrorCode;
    message: string;
  };
}
