import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createBranch } from '@/api/endpoints';
import { queryKeys, queryKeyRoots } from '@/lib/queryKeys';
import { captureQueries, restoreQueries, type QuerySnapshot } from './optimistic';
import type { BranchRef, BranchList, RepoStatus } from '@/types/domain';
import type { GrittyApiError } from '@/api/GrittyApiError';

interface CreateBranchContext {
  snapshot: QuerySnapshot;
}

const byName = (a: BranchRef, b: BranchRef) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

/**
 * Create a branch at HEAD, optimistically adding it to the list. On an
 * "a branch named '…' already exists" conflict, onError rolls the optimistic
 * entry back and the typed error is shown inline.
 */
export function useCreateBranch() {
  const qc = useQueryClient();

  return useMutation<BranchRef | null, GrittyApiError, string, CreateBranchContext>({
    mutationFn: (name: string) => createBranch(name),

    onMutate: async (name): Promise<CreateBranchContext> => {
      await qc.cancelQueries({ queryKey: queryKeyRoots.branches });
      const snapshot = captureQueries(qc, [queryKeyRoots.branches]);

      const branches = qc.getQueryData<BranchList>(queryKeys.branches());
      const status = qc.getQueryData<RepoStatus>(queryKeys.status());
      const sha = status?.headSha ?? '';

      if (branches && !branches.branches.some((b) => b.name === name)) {
        qc.setQueryData<BranchList>(queryKeys.branches(), {
          ...branches,
          branches: [...branches.branches, { name, sha }].sort(byName),
        });
      }

      return { snapshot };
    },

    onError: (_err, _name, ctx) => {
      if (ctx) restoreQueries(qc, ctx.snapshot);
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeyRoots.branches });
    },
  });
}
