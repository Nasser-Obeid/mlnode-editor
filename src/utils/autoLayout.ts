/**
 * Layered auto-layout for MLnode DAGs (Sugiyama-style, left → right).
 *
 * Used on JSON import (the .mlnode.json format carries no positions) and by
 * the toolbar "Tidy" action. Three phases:
 *   1. Rank assignment — longest-path layering (Kahn), cycle-tolerant.
 *   2. Crossing reduction — alternating barycenter sweeps.
 *   3. Coordinates — x from the layer index; y stacked with estimated node
 *      heights, then relaxed toward the mean of each node's neighbors.
 */

import type { RFNode, RFEdge } from '../types/reactflow';

const COL_WIDTH = 280;   // horizontal distance between layer columns
const ROW_GAP = 48;      // vertical gap between nodes in a column
const MARGIN_X = 60;
const MARGIN_Y = 60;
const SWEEPS = 4;        // barycenter passes (alternating direction)
const RELAX_PASSES = 3;  // neighbor-pull passes for y refinement

/** Estimate rendered node height (see MLnodeNode in nodeTypes.tsx). */
function estimateHeight(node: RFNode): number {
  const paramCount = Math.min(Object.keys(node.data?.params ?? {}).length, 3);
  const badges =
    (node.data?.block || node.data?.block_ref ? 1 : 0) +
    (node.data?.hf_model ? 1 : 0) +
    (node.type === 'custom' && !node.data?.layer ? 1 : 0);
  const base = 58 + paramCount * 15 + badges * 15;
  const portRows = node.data?.outputs?.length ?? 0;
  return Math.max(base, 34 + portRows * 24);
}

export function layoutGraph(nodes: RFNode[], edges: RFEdge[]): RFNode[] {
  if (nodes.length === 0) return nodes;

  const ids = new Set(nodes.map((n) => n.id));
  const preds = new Map<string, string[]>();
  const succs = new Map<string, string[]>();
  for (const n of nodes) {
    preds.set(n.id, []);
    succs.set(n.id, []);
  }
  for (const e of edges) {
    if (!ids.has(e.source) || !ids.has(e.target) || e.source === e.target) continue;
    succs.get(e.source)!.push(e.target);
    preds.get(e.target)!.push(e.source);
  }

  // ── 1. Rank assignment (longest path from sources) ──
  const rank = new Map<string, number>();
  const indeg = new Map<string, number>();
  for (const n of nodes) indeg.set(n.id, preds.get(n.id)!.length);

  const queue = nodes.filter((n) => indeg.get(n.id) === 0).map((n) => n.id);
  for (const id of queue) rank.set(id, 0);
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    for (const next of succs.get(cur)!) {
      rank.set(next, Math.max(rank.get(next) ?? 0, rank.get(cur)! + 1));
      const d = indeg.get(next)! - 1;
      indeg.set(next, d);
      if (d === 0) queue.push(next);
    }
  }
  // Nodes on a cycle never reach indegree 0 — park them one column past the
  // deepest ranked node so the layout still succeeds (validation reports the
  // cycle separately).
  const maxRanked = Math.max(0, ...queue.map((id) => rank.get(id)!));
  for (const n of nodes) {
    if (!rank.has(n.id)) rank.set(n.id, maxRanked + 1);
  }

  // ── 2. Build layers and reduce crossings with barycenter sweeps ──
  const layerCount = Math.max(...Array.from(rank.values())) + 1;
  const layers: string[][] = Array.from({ length: layerCount }, () => []);
  for (const n of nodes) layers[rank.get(n.id)!].push(n.id);

  const orderIndex = new Map<string, number>();
  const syncIndex = () =>
    layers.forEach((layer) => layer.forEach((id, i) => orderIndex.set(id, i)));
  syncIndex();

  const barycenter = (id: string, neighbors: string[]): number => {
    const positions = neighbors
      .filter((nb) => orderIndex.has(nb))
      .map((nb) => orderIndex.get(nb)!);
    if (positions.length === 0) return orderIndex.get(id)!;
    return positions.reduce((a, b) => a + b, 0) / positions.length;
  };

  for (let sweep = 0; sweep < SWEEPS; sweep++) {
    const downward = sweep % 2 === 0;
    const layerIdxs = downward
      ? Array.from({ length: layerCount }, (_, i) => i).slice(1)
      : Array.from({ length: layerCount }, (_, i) => i).slice(0, -1).reverse();
    for (const li of layerIdxs) {
      const neighborsOf = (id: string) =>
        downward ? preds.get(id)! : succs.get(id)!;
      layers[li] = layers[li]
        .map((id, i) => ({ id, key: barycenter(id, neighborsOf(id)), tie: i }))
        .sort((a, b) => a.key - b.key || a.tie - b.tie)
        .map((x) => x.id);
      syncIndex();
    }
  }

  // ── 3. Coordinates ──
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const heights = new Map(nodes.map((n) => [n.id, estimateHeight(n)]));

  // Initial stacking, columns vertically centered against the tallest one.
  const layerHeights = layers.map((layer) =>
    layer.reduce((acc, id) => acc + heights.get(id)!, 0) + ROW_GAP * Math.max(0, layer.length - 1)
  );
  const tallest = Math.max(...layerHeights);

  const y = new Map<string, number>();
  layers.forEach((layer, li) => {
    let cursor = MARGIN_Y + (tallest - layerHeights[li]) / 2;
    for (const id of layer) {
      y.set(id, cursor);
      cursor += heights.get(id)! + ROW_GAP;
    }
  });

  // Relaxation: pull each node toward the mean center of its neighbors,
  // then push overlaps apart top-to-bottom within the column.
  const centerOf = (id: string) => y.get(id)! + heights.get(id)! / 2;
  for (let pass = 0; pass < RELAX_PASSES; pass++) {
    const usePreds = pass % 2 === 0;
    const layerIdxs = usePreds
      ? Array.from({ length: layerCount }, (_, i) => i)
      : Array.from({ length: layerCount }, (_, i) => i).reverse();
    for (const li of layerIdxs) {
      for (const id of layers[li]) {
        const neighbors = usePreds ? preds.get(id)! : succs.get(id)!;
        if (neighbors.length === 0) continue;
        const target =
          neighbors.map(centerOf).reduce((a, b) => a + b, 0) / neighbors.length;
        y.set(id, target - heights.get(id)! / 2);
      }
      // Resolve overlaps while preserving the crossing-reduced order.
      let minY = MARGIN_Y;
      for (const id of layers[li]) {
        const yy = Math.max(y.get(id)!, minY);
        y.set(id, yy);
        minY = yy + heights.get(id)! + ROW_GAP;
      }
    }
  }

  return nodes.map((n) => ({
    ...nodeById.get(n.id)!,
    position: {
      x: MARGIN_X + rank.get(n.id)! * COL_WIDTH,
      y: y.get(n.id)!,
    },
  }));
}
