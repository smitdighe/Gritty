/**
 * Detect when a poll (or external `gritty` command) has changed the repo in a
 * way that makes animating from the currently-rendered view into the new one
 * nonsensical — e.g. the checked-out branch was deleted, or HEAD now points at
 * a commit no longer in the rendered history. In those cases the graph should
 * do a full re-fit and tell the user the repo changed externally, rather than
 * tween a meaningless transition.
 */

export interface RepoSnapshot {
  branch: string | null;
  headSha: string | null;
  branchNames: string[];
  shas: string[];
}

export type DivergenceReason = 'branch-deleted' | 'head-vanished' | 'history-disjoint';

export interface DivergenceResult {
  diverged: boolean;
  reason: DivergenceReason | null;
  message: string | null;
}

const OK: DivergenceResult = { diverged: false, reason: null, message: null };

/**
 * Compare the previously-rendered snapshot with incoming data. Returns the
 * first incompatibility found, or a non-diverged result. A `null` prev (first
 * load) is never divergent.
 */
export function detectExternalChange(
  prev: RepoSnapshot | null,
  next: RepoSnapshot,
): DivergenceResult {
  if (!prev) return OK;

  // The branch we were on no longer exists.
  if (prev.branch != null && !next.branchNames.includes(prev.branch)) {
    return {
      diverged: true,
      reason: 'branch-deleted',
      message: `The branch "${prev.branch}" was removed outside the browser.`,
    };
  }

  // The commit HEAD was on is gone from the incoming history entirely.
  if (
    prev.headSha != null &&
    prev.shas.includes(prev.headSha) &&
    next.shas.length > 0 &&
    !next.shas.includes(prev.headSha)
  ) {
    return {
      diverged: true,
      reason: 'head-vanished',
      message: 'HEAD moved to history that is no longer shown — the repo changed externally.',
    };
  }

  // The rendered history and the incoming one share nothing (a full reset).
  if (prev.shas.length > 0 && next.shas.length > 0) {
    const nextSet = new Set(next.shas);
    if (!prev.shas.some((s) => nextSet.has(s))) {
      return {
        diverged: true,
        reason: 'history-disjoint',
        message: 'The repository history changed completely outside the browser.',
      };
    }
  }

  return OK;
}
