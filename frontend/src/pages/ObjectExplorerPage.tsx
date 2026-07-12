import { Panel } from '@/components/ui/Panel';

/** Object database browser (blobs/trees/commits). Filled in a later phase. */
export default function ObjectExplorerPage() {
  return (
    <Panel title="Objects">
      <p className="text-sm text-fg-muted">
        Content-addressed object explorer — browse blobs, trees, and commits by SHA.
      </p>
    </Panel>
  );
}
