import {
  StatusSummary,
  BranchList,
  CommitBox,
  CommitList,
  StagingBoard,
  CommitGraphPanel,
} from '@/features';

/**
 * Repository dashboard. The commit graph is the signature element, so it takes
 * the dominant central column; status + branches sit in a narrow side rail, and
 * the staging board + commit log fill the space beneath the graph.
 */
export default function RepoPage() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
      {/* Side rail */}
      <aside className="flex flex-col gap-4 lg:col-span-1">
        <StatusSummary />
        <CommitBox />
        <BranchList />
      </aside>

      {/* Signature column */}
      <section className="flex flex-col gap-4 lg:col-span-3">
        <CommitGraphPanel />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <StagingBoard />
          <CommitList />
        </div>
      </section>
    </div>
  );
}
