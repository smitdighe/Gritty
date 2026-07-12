import { useEffect, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  EdgeLabelRenderer,
  useReactFlow,
  type Node,
  type Edge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { CommitNode, type CommitNodeData } from './CommitNode';
import { BranchPointer, type PointerVariant } from './BranchPointer';
import { GRAPH_COLORS, GRAPH_EDGE } from './graphTheme';
import { isPendingSha } from '@/hooks/optimistic';
import type { GraphModel, GraphNode } from './layout';

const nodeTypes = { commit: CommitNode };

export interface CommitGraphProps {
  model: GraphModel;
  selectedSha: string | null;
  onSelect: (sha: string) => void;
}

/** Ancestor set of `sha` within the model (for dimming unrelated nodes). */
function ancestorsOf(sha: string | null, nodes: GraphNode[]): Set<string> {
  const set = new Set<string>();
  if (!sha) return set;
  const byId = new Map(nodes.map((n) => [n.sha, n]));
  const stack = [sha];
  while (stack.length) {
    const cur = stack.pop()!;
    if (set.has(cur)) continue;
    set.add(cur);
    const node = byId.get(cur);
    if (node) for (const p of node.commit.parents) if (byId.has(p)) stack.push(p);
  }
  return set;
}

interface Pill {
  layoutId: string;
  label: string;
  variant: PointerVariant;
  x: number;
  y: number;
  title?: string;
}

/** Build branch/HEAD pills in flow coordinates, stacked above shared nodes. */
function buildPills(model: GraphModel): Pill[] {
  const groups = new Map<string, Pill[]>();
  const push = (nodeId: string, pill: Omit<Pill, 'x' | 'y'>, x: number) => {
    const list = groups.get(nodeId) ?? [];
    list.push({ ...pill, x, y: 0 });
    groups.set(nodeId, list);
  };

  for (const bp of model.branchPointers) {
    if (bp.nodeId == null || bp.x == null || bp.y == null) continue;
    const isHeadBranch = model.head.kind === 'symbolic' && model.head.branch === bp.name;
    push(bp.nodeId, { layoutId: bp.name, label: bp.name, variant: 'branch', title: bp.sha }, bp.x);
    if (isHeadBranch) {
      push(bp.nodeId, { layoutId: 'HEAD', label: 'HEAD', variant: 'head', title: 'HEAD' }, bp.x);
    }
  }

  // Detached HEAD has its own pill on its node.
  if (model.head.kind === 'detached' && model.head.nodeId && model.head.x != null) {
    push(
      model.head.nodeId,
      { layoutId: 'HEAD', label: model.head.sha.slice(0, 7), variant: 'detached', title: model.head.sha },
      model.head.x,
    );
  }

  const nodeY = new Map(model.nodes.map((n) => [n.id, n.y]));
  const pills: Pill[] = [];
  for (const [nodeId, list] of groups) {
    const baseY = (nodeY.get(nodeId) ?? 0) - 8;
    list.forEach((p, i) => {
      pills.push({ ...p, y: baseY - (list.length - i) * 20 });
    });
  }
  return pills;
}

/** Fit the viewport on structural change only (not on every render). */
function FitOnChange({ signature }: { signature: string }) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    const t = setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 0);
    return () => clearTimeout(t);
  }, [signature, fitView]);
  return null;
}

export function CommitGraph({ model, selectedSha, onSelect }: CommitGraphProps) {
  const dimAnchor = useMemo(() => ancestorsOf(selectedSha, model.nodes), [selectedSha, model.nodes]);
  const headSha = model.head.kind === 'unborn' ? null : model.head.sha;

  const rfNodes = useMemo<Node<CommitNodeData>[]>(
    () =>
      model.nodes.map((n) => ({
        id: n.id,
        type: 'commit',
        position: { x: n.x, y: n.y },
        draggable: false,
        data: {
          sha: n.sha,
          subject: n.commit.message.split('\n')[0],
          author: n.commit.author.name,
          isSelected: n.sha === selectedSha,
          isHeadTarget: n.sha === headSha,
          isAncestor: n.isAncestorOfHead,
          dimmed: selectedSha != null && !dimAnchor.has(n.sha),
          hasHiddenParents: n.hasHiddenParents,
          isPending: isPendingSha(n.sha),
        },
      })),
    [model.nodes, selectedSha, headSha, dimAnchor],
  );

  const rfEdges = useMemo<Edge[]>(
    () =>
      model.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: 'smoothstep',
        style: e.isMainline ? GRAPH_EDGE.mainline : GRAPH_EDGE.merge,
      })),
    [model.edges],
  );

  const pills = useMemo(() => buildPills(model), [model]);

  // Structural signature: node/edge identity + positions + pointer targets.
  const signature = useMemo(
    () =>
      [
        model.nodes.length,
        model.edges.length,
        model.laneCount,
        model.generationSpan,
        model.branchPointers.map((p) => `${p.name}@${p.nodeId}`).join(','),
      ].join('|'),
    [model],
  );

  return (
    <ReactFlow
      nodes={rfNodes}
      edges={rfEdges}
      nodeTypes={nodeTypes}
      fitView
      minZoom={0.2}
      maxZoom={1.75}
      proOptions={{ hideAttribution: true }}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable
      onNodeClick={(_, node) => onSelect(node.id)}
    >
      <Background gap={20} color={GRAPH_COLORS.background} />
      <Controls showInteractive={false} />
      <EdgeLabelRenderer>
        {pills.map((p) => (
          <BranchPointer
            key={p.layoutId}
            layoutId={p.layoutId}
            label={p.label}
            variant={p.variant}
            x={p.x}
            y={p.y}
            title={p.title}
          />
        ))}
      </EdgeLabelRenderer>
      <FitOnChange signature={signature} />
    </ReactFlow>
  );
}
