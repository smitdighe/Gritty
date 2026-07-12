import { useMutation, useQueryClient } from '@tanstack/react-query';
import { checkout } from '@/api/endpoints';
import { queryKeys, queryKeyRoots } from '@/lib/queryKeys';
import { captureQueries, restoreQueries, type QuerySnapshot } from './optimistic';
import type { CheckoutResult, BranchList, RepoStatus } from '@/types/domain';
import type { GrittyApiError } from '@/api/GrittyApiError';

interface CheckoutContext {
  snapshot: QuerySnapshot;
}

/**
 * Switch branches/commit, optimistically moving HEAD (and the branch pointer)
 * to the target. If checkout is rejected — e.g. UsageError "your local changes
 * to the following files would be overwritten by checkout: …" — onError rolls
 * HEAD back to its actual previous position; the mutation's typed error (which
 * lists the blocked files verbatim) is surfaced inline by the caller, not
 * flattened into a generic string.
 */
export function useCheckout() {
  const qc = useQueryClient();

  return useMutation<CheckoutResult, GrittyApiError, string, CheckoutContext>({
    mutationFn: (target: string) => checkout(target),

    onMutate: async (target): Promise<CheckoutContext> => {
      await Promise.all([
        qc.cancelQueries({ queryKey: queryKeyRoots.status }),
        qc.cancelQueries({ queryKey: queryKeyRoots.branches }),
      ]);

      const snapshot = captureQueries(qc, [queryKeyRoots.status, queryKeyRoots.branches]);

      const branches = qc.getQueryData<BranchList>(queryKeys.branches());
      const status = qc.getQueryData<RepoStatus>(queryKeys.status());
      const targetRef = branches?.branches.find((b) => b.name === target);

      if (status) {
        qc.setQueryData<RepoStatus>(queryKeys.status(), {
          ...status,
          branch: target,
          headSha: targetRef?.sha ?? status.headSha,
        });
      }

      return { snapshot };
    },

    onError: (_err, _target, ctx) => {
      if (ctx) restoreQueries(qc, ctx.snapshot);
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeyRoots.status });
      qc.invalidateQueries({ queryKey: queryKeyRoots.log });
      qc.invalidateQueries({ queryKey: queryKeyRoots.branches });
      qc.invalidateQueries({ queryKey: queryKeyRoots.diff });
    },
  });
}
