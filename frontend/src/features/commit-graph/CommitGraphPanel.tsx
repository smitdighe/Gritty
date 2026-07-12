import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLog, useBranches, useStatus } from '@/hooks';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Panel } from '@/components/ui/Panel';
import { Button } from '@/components/ui/Button';
import { useRepoStore } from '@/store/repoStore';
import { ErrorNote, LoadingRows } from '@/features/common/states';
import { isPendingSha } from '@/hooks/optimistic';
import { detectExternalChange, type RepoSnapshot } from '@/lib/graphSync';
import { LOG_MAX, GRAPH_GENERATION_WINDOW as GEN_WINDOW, WIDE_MEDIA_QUERY as WIDE_QUERY } from '@/lib/constants';
import { layoutCommitGraph } from './layout';
import { CommitGraph } from './CommitGraph';
import { CompactGraph } from './CompactGraph';

export function CommitGraphPanel() {
  const log = useLog({ max: LOG_MAX });
  const branches = useBranches();
  const status = useStatus();
  const navigate = useNavigate();
  const selectedSha = useRepoStore((s) => s.selectedCommitSha);
  const setSelectedCommitSha = useRepoStore((s) => s.setSelectedCommitSha);
  const isWide = useMediaQuery(WIDE_QUERY);

  const [maxGenerations, setMaxGenerations] = useState(GEN_WINDOW);
  const [externalChange, setExternalChange] = useState<string | null>(null);
  const prevSnapshot = useRef<RepoSnapshot | null>(null);

  const model = useMemo(
    () =>
      layoutCommitGraph({
        commits: log.data ?? [],
        branches: branches.data?.branches ?? [],
        headSha: status.data?.headSha ?? null,
        currentBranch: status.data?.branch ?? null,
        maxGenerations,
      }),
    [log.data, branches.data, status.data, maxGenerations],
  );

  // Detect externally-driven, incompatible changes across polls (ignoring our
  // own optimistic pending shas, which are transient by construction).
  useEffect(() => {
    if (!log.data || !branches.data || !status.data) return;
    const rawHead = status.data.headSha;
    const next: RepoSnapshot = {
      branch: status.data.branch,
      headSha: rawHead && isPendingSha(rawHead) ? null : rawHead,
      branchNames: branches.data.branches.map((b) => b.name),
      shas: log.data.map((e) => e.sha).filter((s) => !isPendingSha(s)),
    };
    const result = detectExternalChange(prevSnapshot.current, next);
    if (result.diverged) setExternalChange(result.message);
    prevSnapshot.current = next;
  }, [log.data, branches.data, status.data]);

  const onSelect = (sha: string) => {
    if (isPendingSha(sha)) return; // can't navigate to a not-yet-real commit
    setSelectedCommitSha(sha);
    navigate(`/repo/commit/${sha}`);
  };

  const isLoading = log.isLoading || status.isLoading;
  const error = log.error ?? status.error ?? branches.error;

  return (
    <Panel
      title="Commit Graph"
      actions={
        model.truncated ? (
          <span className="text-xs text-fg-faint">
            newest {model.visibleCount} of {model.totalCount}
          </span>
        ) : undefined
      }
      flush
    >
      {externalChange && (
        <div
          role="status"
          className="flex items-center justify-between gap-2 border-b border-tag/40 bg-tag/10 px-3 py-1.5 text-xs text-tag"
        >
          <span>{externalChange}</span>
          <button
            type="button"
            aria-label="Dismiss external-change notice"
            className="shrink-0 rounded px-1.5 py-0.5 outline-none hover:bg-bg-hover focus-visible:ring-2 focus-visible:ring-accent"
            onClick={() => setExternalChange(null)}
          >
            dismiss
          </button>
        </div>
      )}

      {isLoading && (
        <div className="p-3">
          <LoadingRows rows={5} />
        </div>
      )}
      {!isLoading && error && (
        <div className="p-3">
          <ErrorNote error={error} />
        </div>
      )}

      {!isLoading && !error && model.nodes.length === 0 && (
        <div className="flex h-[440px] flex-col items-center justify-center gap-1 text-center">
          <p className="text-sm text-fg-muted">
            {model.head.kind === 'unborn' ? 'No commits yet.' : 'History is empty.'}
          </p>
          <p className="text-xs text-fg-faint">Create your first commit to grow the graph.</p>
        </div>
      )}

      {!isLoading && !error && model.nodes.length > 0 && (
        <>
          {isWide ? (
            <div className="relative h-[520px] w-full">
              <CommitGraph model={model} selectedSha={selectedSha} onSelect={onSelect} />
              {model.truncated && (
                <div className="absolute bottom-3 left-3 z-20">
                  <Button size="sm" onClick={() => setMaxGenerations((n) => n + GEN_WINDOW)}>
                    Load more history ({model.hiddenCount} older)
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="max-h-[520px] overflow-auto">
              <CompactGraph model={model} selectedSha={selectedSha} onSelect={onSelect} />
              {model.truncated && (
                <div className="p-3">
                  <Button size="sm" className="w-full" onClick={() => setMaxGenerations((n) => n + GEN_WINDOW)}>
                    Load more history ({model.hiddenCount} older)
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
