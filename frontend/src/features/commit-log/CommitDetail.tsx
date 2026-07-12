import { Link } from 'react-router-dom';
import { useObject } from '@/hooks';
import { Panel } from '@/components/ui/Panel';
import { shortenSha, formatIdentTime } from '@/lib/format';
import { ErrorNote, LoadingRows } from '@/features/common/states';
import type { Commit, Ident } from '@/types/domain';

function sameIdent(a: Ident, b: Ident): boolean {
  return a.name === b.name && a.email === b.email && a.timestamp === b.timestamp && a.timezone === b.timezone;
}

function IdentLine({ label, ident }: { label: string; ident: Ident }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs uppercase tracking-wide text-fg-faint">{label}</span>
      <span className="text-sm text-fg">
        {ident.name} <span className="text-fg-muted">&lt;{ident.email}&gt;</span>
      </span>
      <span className="text-xs text-fg-faint">{formatIdentTime(ident.timestamp, ident.timezone)}</span>
    </div>
  );
}

/** Full metadata for a single commit, fetched via GET /objects/:sha. */
export function CommitDetail({ sha }: { sha: string }) {
  const { data, isLoading, isError, error } = useObject(sha);

  if (isLoading) return <Panel title="Commit"><LoadingRows rows={4} /></Panel>;
  if (isError) return <Panel title="Commit"><ErrorNote error={error} /></Panel>;
  if (!data) return null;

  if (data.type !== 'commit') {
    return (
      <Panel title={`Object ${shortenSha(sha)}`}>
        <ErrorNote error={new Error(`Expected a commit but ${shortenSha(sha)} is a ${data.type}.`)} />
      </Panel>
    );
  }

  const commit: Commit = data.content;
  const subject = commit.message.split('\n')[0];
  const body = commit.message.slice(subject.length).replace(/^\n+/, '');
  const identsDiffer = !sameIdent(commit.author, commit.committer);

  return (
    <Panel title={`Commit ${shortenSha(sha)}`}>
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-base font-semibold text-fg">{subject}</h2>
          {body && <pre className="mt-2 whitespace-pre-wrap text-sm text-fg-muted">{body}</pre>}
        </div>

        <div className="grid grid-cols-1 gap-3 border-t border-border pt-3 sm:grid-cols-2">
          <IdentLine label="Author" ident={commit.author} />
          {identsDiffer && <IdentLine label="Committer" ident={commit.committer} />}
        </div>

        <div className="flex flex-col gap-2 border-t border-border pt-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-fg-faint">Tree</span>
            <span className="text-hash">{shortenSha(commit.tree)}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-fg-faint">
              {commit.parents.length === 1 ? 'Parent' : 'Parents'}
            </span>
            {commit.parents.length === 0 && <span className="text-fg-faint">root commit</span>}
            {commit.parents.map((p) => (
              <Link
                key={p}
                to={`/repo/commit/${p}`}
                className="text-accent underline-offset-2 hover:underline"
              >
                {shortenSha(p)}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}
