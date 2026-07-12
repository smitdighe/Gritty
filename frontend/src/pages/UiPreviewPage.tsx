import { useState } from 'react';
import { Button, Panel, Tabs, Tooltip, Badge, Skeleton } from '@/components/ui';
import { shortenSha, formatTimestamp, pluralize } from '@/lib/format';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-sans text-sm font-semibold uppercase tracking-wide text-fg-faint">
        {title}
      </h2>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </section>
  );
}

/**
 * DEV-only visual catalog of every UI primitive and its variants. Not wired
 * into app navigation. Includes a local toggle that emulates
 * prefers-reduced-motion for the previewed subtree so motion behavior is
 * checkable without changing OS settings.
 */
export default function UiPreviewPage() {
  const [reduce, setReduce] = useState(false);
  const sha = '1e4f9a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f';

  return (
    <div className="min-h-screen bg-bg p-8 text-fg" data-reduce-motion={reduce}>
      {/* Emulated reduced-motion: zero out all motion within this subtree. */}
      {reduce && (
        <style>{`
          [data-reduce-motion="true"] *,
          [data-reduce-motion="true"] *::before,
          [data-reduce-motion="true"] *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        `}</style>
      )}

      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="font-sans text-xl font-bold text-fg">UI Primitives</h1>
            <p className="text-sm text-fg-muted">/dev/ui — dev preview, not in nav</p>
          </div>
          <label className="flex items-center gap-2 font-sans text-sm text-fg-muted">
            <input
              type="checkbox"
              checked={reduce}
              onChange={(e) => setReduce(e.target.checked)}
            />
            Emulate reduced motion
          </label>
        </header>

        <Section title="Button">
          <Button variant="default">Default</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="default" size="sm">
            Small
          </Button>
          <Button variant="default" disabled>
            Disabled
          </Button>
        </Section>

        <Section title="Badge">
          <Badge variant="default">default</Badge>
          <Badge variant="branch">feature/graph</Badge>
          <Badge variant="head">HEAD</Badge>
          <Badge variant="add">+add</Badge>
          <Badge variant="remove">-remove</Badge>
          <Badge variant="muted">detached</Badge>
        </Section>

        <Section title="Tooltip">
          <Tooltip content={sha} side="top">
            <span className="cursor-default text-hash">{shortenSha(sha)}</span>
          </Tooltip>
          <Tooltip content="right side" side="right">
            <Button variant="ghost" size="sm">
              hover me
            </Button>
          </Tooltip>
        </Section>

        <Section title="Skeleton">
          <div className="flex w-full max-w-sm flex-col gap-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <div className="flex items-center gap-2">
              <Skeleton circle className="h-8 w-8" />
              <Skeleton className="h-4 flex-1" />
            </div>
          </div>
        </Section>

        <section className="flex flex-col gap-3">
          <h2 className="font-sans text-sm font-semibold uppercase tracking-wide text-fg-faint">
            Panel + Tabs
          </h2>
          <div className="h-64">
            <Panel title="Repository" actions={<Badge variant="muted">preview</Badge>}>
              <Tabs
                items={[
                  {
                    id: 'log',
                    label: 'Log',
                    content: (
                      <div className="flex flex-col gap-1 text-sm">
                        <div>
                          <span className="text-hash">{shortenSha(sha)}</span>{' '}
                          <span className="text-fg">initial commit</span>
                        </div>
                        <div className="text-xs text-fg-muted">
                          {formatTimestamp(1609459200, 330)}
                        </div>
                        <div className="text-xs text-fg-muted">{pluralize(3, 'commit')}</div>
                      </div>
                    ),
                  },
                  {
                    id: 'diff',
                    label: 'Diff',
                    content: (
                      <pre className="text-xs leading-relaxed">
                        <span className="text-diff-add">+ added line</span>
                        {'\n'}
                        <span className="text-diff-remove">- removed line</span>
                      </pre>
                    ),
                  },
                  { id: 'empty', label: 'Empty', content: null, disabled: true },
                ]}
              />
            </Panel>
          </div>
        </section>
      </div>
    </div>
  );
}
