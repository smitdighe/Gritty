import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createCommit } from '@/api/endpoints';
import { queryKeys, queryKeyRoots } from '@/lib/queryKeys';
import {
  captureQueries,
  restoreQueries,
  makePendingSha,
  type QuerySnapshot,
} from './optimistic';
import type { CommitResult, LogEntry, BranchList, RepoStatus } from '@/types/domain';
import type { GrittyApiError } from '@/api/GrittyApiError';

interface CommitContext {
  snapshot: QuerySnapshot;
  tempSha: string;
}

/**
 * Create a commit from the current index, optimistically. onMutate inserts a
 * clearly-pending temp node into the log and advances the current branch +
 * HEAD to it. The temp sha can never equal the real one (commits are
 * content-hashed and unpredictable client-side), so onSettled invalidates to
 * REPLACE the temp with the server's real commit. onError rolls the temp back
 * and leaves the typed error on the mutation for inline display.
 */
export function useCommit() {
  const qc = useQueryClient();

  return useMutation<CommitResult, GrittyApiError, string, CommitContext>({
    mutationFn: (message: string) => createCommit(message),

    onMutate: async (message): Promise<CommitContext> => {
      await Promise.all([
        qc.cancelQueries({ queryKey: queryKeyRoots.log }),
        qc.cancelQueries({ queryKey: queryKeyRoots.status }),
        qc.cancelQueries({ queryKey: queryKeyRoots.branches }),
      ]);

      const snapshot = captureQueries(qc, [
        queryKeyRoots.log,
        queryKeyRoots.status,
        queryKeyRoots.branches,
      ]);

      const status = qc.getQueryData<RepoStatus>(queryKeys.status());
      const branches = qc.getQueryData<BranchList>(queryKeys.branches());
      const headSha = status?.headSha ?? null;
      const branch = status?.branch ?? null;
      const tempSha = makePendingSha();

      const nowSec = Math.floor(Date.now() / 1000);
      const ident = { name: 'you', email: '', timestamp: nowSec, timezone: '+0000' };
      const tempEntry: LogEntry = {
        sha: tempSha,
        commit: {
          tree: '',
          parents: headSha ? [headSha] : [],
          author: ident,
          committer: ident,
          message,
        },
      };

      // Prepend the pending commit to every log query variant.
      qc.setQueriesData<LogEntry[]>({ queryKey: queryKeyRoots.log }, (old) =>
        old ? [tempEntry, ...old] : [tempEntry],
      );

      // Advance the current branch ref + HEAD to the pending sha.
      if (branch && branches) {
        qc.setQueryData<BranchList>(queryKeys.branches(), {
          ...branches,
          branches: branches.branches.map((b) => (b.name === branch ? { ...b, sha: tempSha } : b)),
        });
      }
      if (status) {
        qc.setQueryData<RepoStatus>(queryKeys.status(), { ...status, headSha: tempSha });
      }

      return { snapshot, tempSha };
    },

    onError: (_err, _message, ctx) => {
      if (ctx) restoreQueries(qc, ctx.snapshot);
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeyRoots.log });
      qc.invalidateQueries({ queryKey: queryKeyRoots.status });
      qc.invalidateQueries({ queryKey: queryKeyRoots.branches });
    },
  });
}
