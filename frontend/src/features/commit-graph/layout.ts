import type { Commit, BranchRef } from '@/types/domain';

/**
 * Pure commit-DAG layout. Turns loaded commits + branch refs + HEAD into
 * positioned nodes/edges plus independently-animatable branch/HEAD markers.
 *
 * Model facts (grounded in backend/src/core):
 *  - A commit has 0..n parents (commit.js), parent order significant; parents[0]
 *    is the mainline. Merges (2+ parents) must route without overlap.
 *  - Branch refs are {name, sha} (refs.js). HEAD is symbolic→branch,
 *    detached→sha, or null on an unborn branch (head.js / repo.js).
 *  - X-axis = generation (topological depth); time flows left→right.
 *  - Y-axis = lane, allocated so two unrelated nodes never share (gen, lane).
 */

export const X_SPACING = 168;
export const Y_SPACING = 64;

export interface GraphNode {
  id: string;
  sha: string;
  generation: number;
  lane: number;
  x: number;
  y: number;
  commit: Commit;
  isRoot: boolean;
  /** A parent exists but is not among the rendered nodes (window truncation). */
  hasHiddenParents: boolean;
  /** In the ancestor set of HEAD (excludes the HEAD node itself). */
  isAncestorOfHead: boolean;
}

export interface GraphEdge {
  id: string;
  /** Reactflow draws source→target; we orient parent(left)→child(right). */
  source: string;
  target: string;
  childSha: string;
  parentSha: string;
  parentIndex: number;
  /** parents[0]: the mainline line-of-descent. */
  isMainline: boolean;
}

export interface BranchPointerPos {
  name: string;
  sha: string;
  /** Node id the pointer sits on, or null when that commit is not rendered. */
  nodeId: string | null;
  x: number | null;
  y: number | null;
}

export type HeadMarker =
  | { kind: 'unborn' }
  | { kind: 'symbolic'; branch: string; sha: string; nodeId: string | null; x: number | null; y: number | null }
  | { kind: 'detached'; sha: string; nodeId: string | null; x: number | null; y: number | null };

export interface GraphModel {
  nodes: GraphNode[];
  edges: GraphEdge[];
  branchPointers: BranchPointerPos[];
  head: HeadMarker;
  laneCount: number;
  /** Number of distinct generations rendered. */
  generationSpan: number;
  totalCount: number;
  visibleCount: number;
  truncated: boolean;
  hiddenCount: number;
}

export interface LayoutInput {
  commits: { sha: string; commit: Commit }[];
  branches: BranchRef[];
  headSha: string | null;
  /** Current branch name (null = detached). Distinguishes symbolic vs detached HEAD. */
  currentBranch?: string | null;
  /** Render only the newest N generations; older ones become hidden parents. */
  maxGenerations?: number;
}

const EMPTY_HEAD: HeadMarker = { kind: 'unborn' };

/** Generation = 1 + max(parent generations present in the set); 0 for roots. */
function computeGenerations(byId: Map<string, Commit>): Map<string, number> {
  const gen = new Map<string, number>();
  const visiting = new Set<string>();

  const resolve = (sha: string): number => {
    const cached = gen.get(sha);
    if (cached !== undefined) return cached;
    const commit = byId.get(sha);
    if (!commit) return -1; // parent outside the loaded set
    if (visiting.has(sha)) return 0; // cycle guard (shouldn't happen in a DAG)
    visiting.add(sha);
    let g = 0;
    for (const p of commit.parents) {
      const pg = byId.has(p) ? resolve(p) : -1;
      if (pg >= 0) g = Math.max(g, pg + 1);
    }
    visiting.delete(sha);
    gen.set(sha, g);
    return g;
  };

  for (const sha of byId.keys()) resolve(sha);
  return gen;
}

/** Ancestors of `start` within the loaded set (inclusive of start). */
function computeAncestors(start: string | null, byId: Map<string, Commit>): Set<string> {
  const seen = new Set<string>();
  if (!start || !byId.has(start)) return seen;
  const stack = [start];
  while (stack.length) {
    const sha = stack.pop()!;
    if (seen.has(sha)) continue;
    seen.add(sha);
    const commit = byId.get(sha);
    if (!commit) continue;
    for (const p of commit.parents) if (byId.has(p)) stack.push(p);
  }
  return seen;
}

/**
 * Allocate lanes by walking newest→oldest (a child is always processed before
 * its parents, since gen(child) > gen(parent)). Each lane reserves the sha it
 * expects next; the mainline parent inherits the child's lane, extra parents
 * take fresh lanes, and lanes free when their branch tip is reached.
 */
function assignLanes(
  ordered: { sha: string; commit: Commit }[],
  visible: Set<string>,
): Map<string, number> {
  const laneOf = new Map<string, number>();
  const lanes: (string | null)[] = [];

  const allocate = (): number => {
    const free = lanes.indexOf(null);
    if (free !== -1) return free;
    lanes.push(null);
    return lanes.length - 1;
  };

  for (const { sha, commit } of ordered) {
    // Lanes that were reserved for this commit by already-processed children.
    const reserved: number[] = [];
    lanes.forEach((s, i) => {
      if (s === sha) reserved.push(i);
    });

    let lane: number;
    if (reserved.length > 0) {
      lane = reserved[0];
      for (let k = 1; k < reserved.length; k++) lanes[reserved[k]] = null; // merge duplicates
    } else {
      lane = allocate();
      lanes[lane] = sha;
    }
    laneOf.set(sha, lane);

    const present = commit.parents.filter((p) => visible.has(p));
    if (present.length === 0) {
      lanes[lane] = null; // line ends here (root or oldest loaded)
      continue;
    }

    const [first, ...rest] = present;
    // Mainline parent continues in this lane, unless it is already reserved in
    // another lane — then this line merges into that one and frees its lane.
    const firstAlreadyReserved = lanes.includes(first);
    lanes[lane] = firstAlreadyReserved ? null : first;

    // Extra (merge) parents each take a fresh lane, unless already reserved.
    for (const p of rest) {
      if (!lanes.includes(p)) lanes[allocate()] = p;
    }
  }

  return laneOf;
}

export function layoutCommitGraph(input: LayoutInput): GraphModel {
  const { commits, branches, headSha, currentBranch = null, maxGenerations } = input;

  const totalCount = commits.length;
  if (totalCount === 0) {
    return {
      nodes: [],
      edges: [],
      branchPointers: [],
      head: headSha
        ? currentBranch != null
          ? { kind: 'symbolic', branch: currentBranch, sha: headSha, nodeId: null, x: null, y: null }
          : { kind: 'detached', sha: headSha, nodeId: null, x: null, y: null }
        : EMPTY_HEAD,
      laneCount: 0,
      generationSpan: 0,
      totalCount: 0,
      visibleCount: 0,
      truncated: false,
      hiddenCount: 0,
    };
  }

  const byId = new Map(commits.map((c) => [c.sha, c.commit]));
  const generation = computeGenerations(byId);
  const ancestorsOfHead = computeAncestors(headSha, byId);

  const maxGen = Math.max(...commits.map((c) => generation.get(c.sha) ?? 0));
  const keepFrom =
    maxGenerations && maxGenerations > 0 ? Math.max(0, maxGen - (maxGenerations - 1)) : 0;

  const visibleCommits = commits.filter((c) => (generation.get(c.sha) ?? 0) >= keepFrom);
  const visible = new Set(visibleCommits.map((c) => c.sha));
  const minVisibleGen = Math.min(...visibleCommits.map((c) => generation.get(c.sha) ?? 0));

  // Deterministic newest→oldest order for lane routing.
  const ordered = [...visibleCommits].sort((a, b) => {
    const ga = generation.get(a.sha) ?? 0;
    const gb = generation.get(b.sha) ?? 0;
    if (gb !== ga) return gb - ga;
    const ta = a.commit.committer.timestamp;
    const tb = b.commit.committer.timestamp;
    if (tb !== ta) return tb - ta;
    return a.sha < b.sha ? -1 : a.sha > b.sha ? 1 : 0;
  });

  const laneOf = assignLanes(ordered, visible);

  const nodes: GraphNode[] = visibleCommits.map((c) => {
    const g = generation.get(c.sha) ?? 0;
    const lane = laneOf.get(c.sha) ?? 0;
    const presentParents = c.commit.parents.filter((p) => visible.has(p));
    const hasHiddenParents = c.commit.parents.length > presentParents.length;
    return {
      id: c.sha,
      sha: c.sha,
      generation: g,
      lane,
      x: (g - minVisibleGen) * X_SPACING,
      y: lane * Y_SPACING,
      commit: c.commit,
      isRoot: c.commit.parents.length === 0,
      hasHiddenParents,
      isAncestorOfHead: c.sha !== headSha && ancestorsOfHead.has(c.sha),
    };
  });

  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  const edges: GraphEdge[] = [];
  for (const c of visibleCommits) {
    c.commit.parents.forEach((parent, parentIndex) => {
      if (!visible.has(parent)) return;
      edges.push({
        id: `${c.sha}->${parent}`,
        source: parent, // parent sits left; draw parent→child
        target: c.sha,
        childSha: c.sha,
        parentSha: parent,
        parentIndex,
        isMainline: parentIndex === 0,
      });
    });
  }

  const laneCount = nodes.reduce((m, n) => Math.max(m, n.lane + 1), 0);
  const generationSpan = maxGen - minVisibleGen + 1;

  const branchPointers: BranchPointerPos[] = branches.map((b) => {
    const node = nodeById.get(b.sha) ?? null;
    return {
      name: b.name,
      sha: b.sha,
      nodeId: node ? node.id : null,
      x: node ? node.x : null,
      y: node ? node.y : null,
    };
  });

  let head: HeadMarker;
  if (!headSha) {
    head = EMPTY_HEAD;
  } else {
    const node = nodeById.get(headSha) ?? null;
    const pos = { nodeId: node ? node.id : null, x: node ? node.x : null, y: node ? node.y : null };
    head =
      currentBranch != null
        ? { kind: 'symbolic', branch: currentBranch, sha: headSha, ...pos }
        : { kind: 'detached', sha: headSha, ...pos };
  }

  return {
    nodes,
    edges,
    branchPointers,
    head,
    laneCount,
    generationSpan,
    totalCount,
    visibleCount: visibleCommits.length,
    truncated: visibleCommits.length < totalCount,
    hiddenCount: totalCount - visibleCommits.length,
  };
}
