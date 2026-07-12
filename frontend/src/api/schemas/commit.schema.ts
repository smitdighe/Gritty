import { z } from 'zod';
import type { Ident, Commit, LogEntry, CommitResult } from '@/types/domain';

export const identSchema = z.object({
  name: z.string(),
  email: z.string(),
  timestamp: z.number(),
  timezone: z.string(),
});

export const commitSchema = z.object({
  tree: z.string(),
  parents: z.array(z.string()),
  author: identSchema,
  committer: identSchema,
  message: z.string(),
});

/** One `/log` entry: id + parsed commit. */
export const logEntrySchema = z.object({
  sha: z.string(),
  commit: commitSchema,
});

export const logSchema = z.array(logEntrySchema);

/** POST /commits result. */
export const commitResultSchema = z.object({
  sha: z.string(),
  branch: z.string().nullable(),
});

export function parseCommit(data: unknown): Commit {
  return commitSchema.parse(data);
}

export function parseLog(data: unknown): LogEntry[] {
  return logSchema.parse(data);
}

export function parseCommitResult(data: unknown): CommitResult {
  return commitResultSchema.parse(data);
}

// --- drift guard: zod-inferred types must equal the hand-written domain types.
type MutualEqual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
const _identOk: MutualEqual<Ident, z.infer<typeof identSchema>> = true;
const _commitOk: MutualEqual<Commit, z.infer<typeof commitSchema>> = true;
const _logOk: MutualEqual<LogEntry, z.infer<typeof logEntrySchema>> = true;
const _commitResultOk: MutualEqual<CommitResult, z.infer<typeof commitResultSchema>> = true;
void _identOk;
void _commitOk;
void _logOk;
void _commitResultOk;
