import { useState, type FormEvent } from 'react';
import { useBranches, useCreateBranch, useCheckout } from '@/hooks';
import { Panel } from '@/components/ui/Panel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { shortenSha } from '@/lib/format';
import { cn } from '@/lib/cn';
import { useRepoStore } from '@/store/repoStore';
import { ErrorNote, LoadingRows } from '@/features/common/states';

export function BranchList() {
  const { data, isLoading, isError, error } = useBranches();
  const createBranch = useCreateBranch();
  const checkout = useCheckout();
  const setSelectedBranch = useRepoStore((s) => s.setSelectedBranch);

  const [newName, setNewName] = useState('');

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    createBranch.mutate(name, { onSuccess: () => setNewName('') });
  };

  const onCheckout = (name: string) => {
    setSelectedBranch(name);
    checkout.mutate(name);
  };

  return (
    <Panel title="Branches">
      {isLoading && <LoadingRows rows={3} />}
      {isError && <ErrorNote error={error} />}

      {data && (
        <div className="flex flex-col gap-3">
          {data.branches.length === 0 && (
            <p className="text-sm text-fg-faint">No branches yet.</p>
          )}
          <ul className="flex flex-col gap-1">
            {data.branches.map((b) => {
              const isCurrent = b.name === data.current;
              const switching = checkout.isPending && checkout.variables === b.name;
              return (
                <li
                  key={b.name}
                  className={cn(
                    'flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm',
                    isCurrent ? 'bg-bg-hover' : 'hover:bg-bg-hover',
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={cn('truncate', isCurrent ? 'text-fg' : 'text-fg-muted')}>
                      {b.name}
                    </span>
                    {isCurrent && <Badge variant="head">current</Badge>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-hash">{shortenSha(b.sha)}</span>
                    {!isCurrent && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={switching}
                        aria-label={`Check out branch ${b.name}`}
                        onClick={() => onCheckout(b.name)}
                      >
                        {switching ? 'switching…' : 'checkout'}
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          {checkout.isError && <ErrorNote error={checkout.error} />}

          <form onSubmit={onCreate} className="flex items-center gap-2 border-t border-border pt-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="new-branch"
              aria-label="New branch name"
              className={cn(
                'min-w-0 flex-1 rounded border border-border bg-bg-inset px-2 py-1 text-sm text-fg',
                'outline-none placeholder:text-fg-faint focus-visible:ring-2 focus-visible:ring-accent',
              )}
            />
            <Button type="submit" size="sm" disabled={createBranch.isPending || !newName.trim()}>
              {createBranch.isPending ? 'creating…' : 'create'}
            </Button>
          </form>
          {createBranch.isError && <ErrorNote error={createBranch.error} />}
        </div>
      )}
    </Panel>
  );
}
