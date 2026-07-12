import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { CommitDetail, DiffView } from '@/features';
import { Panel } from '@/components/ui/Panel';
import { useObject } from '@/hooks';
import { useRepoStore } from '@/store/repoStore';

interface CommitDetailParams extends Record<string, string | undefined> {
  sha: string;
}

/** Commit metadata + the commit's own diff (first parent → this commit). */
export default function CommitDetailPage() {
  const { sha } = useParams<CommitDetailParams>();
  const setSelectedCommitSha = useRepoStore((s) => s.setSelectedCommitSha);

  useEffect(() => {
    if (sha) setSelectedCommitSha(sha);
  }, [sha, setSelectedCommitSha]);

  // Deduped with CommitDetail's own query — read the first parent for the diff.
  const { data } = useObject(sha ?? '');
  const parent = data?.type === 'commit' ? data.content.parents[0] : undefined;

  if (!sha) {
    return (
      <Panel title="Commit">
        <p className="text-sm text-fg-faint">No commit selected.</p>
      </Panel>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <CommitDetail sha={sha} />
      {parent ? (
        <DiffView a={parent} b={sha} title="Commit diff" />
      ) : data?.type === 'commit' ? (
        <Panel title="Commit diff">
          <p className="text-sm text-fg-faint">Root commit — no parent to diff against.</p>
        </Panel>
      ) : null}
    </div>
  );
}
