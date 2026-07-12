import { useState, type FormEvent } from 'react';
import { useCommit } from '@/hooks';
import { Panel } from '@/components/ui/Panel';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { ErrorNote } from '@/features/common/states';

/**
 * Commit action. Drives the optimistic useCommit mutation; the pending commit
 * appears in the log/graph immediately. On failure the real GrittyApiError
 * message (e.g. "nothing to commit (no files staged)") is shown inline right
 * here, next to the action — never as a transient toast.
 */
export function CommitBox() {
  const commit = useCommit();
  const [message, setMessage] = useState('');

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const msg = message.trim();
    if (!msg) return;
    commit.mutate(msg, { onSuccess: () => setMessage('') });
  };

  return (
    <Panel title="Commit">
      <form onSubmit={onSubmit} className="flex flex-col gap-2">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Commit message"
          aria-label="Commit message"
          rows={2}
          className={cn(
            'w-full resize-y rounded border border-border bg-bg-inset px-2 py-1 text-sm text-fg',
            'outline-none placeholder:text-fg-faint focus-visible:ring-2 focus-visible:ring-accent',
          )}
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-fg-faint">
            {commit.isPending ? 'committing…' : 'snapshots the staged index'}
          </span>
          <Button type="submit" size="sm" disabled={commit.isPending || !message.trim()}>
            Commit
          </Button>
        </div>
        {commit.isError && <ErrorNote error={commit.error} />}
      </form>
    </Panel>
  );
}
