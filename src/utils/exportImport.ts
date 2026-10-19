/** RF ↔ MLnode transform — the critical export/import layer. */

import type { RFNode, RFEdge, ModelSettings } from '../types/reactflow';
import type { MLnodeEdge, MLnodeModel, MLnodeNode } from '../types/mlnode';
import { CUSTOM_LAYERS_SCHEMA_VERSION } from '../types/mlnode';
import { MLnodeLayerLibrarySchema, MLnodeModelSchema } from './jsonSchema';
import { layoutGraph } from './autoLayout';
import { getInputPorts, type LayerMap } from './customLayers';

/** One ReactFlow node → MLnode JSON node. Drops position, label, RF-only fields. */
export function toMLnodeNode(n: RFNode): MLnodeNode {
  const d = n.data;
  const out: MLnodeNode = {
    id: n.id,
    type: n.type ?? 'Linear',
    params: d.params ?? {},
  };
  if (d.shared_id) out.shared_id = d.shared_id;
  if (d.outputs) out.outputs = d.outputs;
  if (d.reduction) out.reduction = d.reduction;
  if (d.reduction_dim != null) out.reduction_dim = d.reduction_dim;
  if (d.hf_model) out.hf_model = d.hf_model;
  if (d.hf_config) out.hf_config = d.hf_config;
  if (d.path) out.path = d.path;
  if (d.layer) out.layer = d.layer;
  if (d.block) out.block = d.block;
  if (d.block_ref) out.block_ref = d.block_ref;
  return out;
}

export function toMLnodeEdge(e: RFEdge): MLnodeEdge {
  return {
    source: e.source,
    source_port: e.sourceHandle ?? null,
    target: e.target,
    target_port: e.targetHandle ?? null,
  };
}

/**
 * MLnode JSON nodes/edges → laid-out ReactFlow nodes/edges.
 *
 * Multi-input nodes (core multi-input layers and JSON layers with several
 * Input nodes) render one handle per named port. Unlabeled edges into them
 * get a target_port backfilled in declaration order — the same fallback the
 * Python executor applies — so they attach to the right handles.
 */
export function toRFGraph(
  mlNodes: MLnodeNode[],
  mlEdges: MLnodeEdge[],
  customLayers: LayerMap
): { nodes: RFNode[]; edges: RFEdge[] } {
  const nodes: RFNode[] = mlNodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: { x: 0, y: 0 }, // replaced by layoutGraph below
    data: {
      label: `${n.type} (${n.id})`,
      params: n.params ?? {},
      ...(n.shared_id && { shared_id: n.shared_id }),
      ...(n.outputs && { outputs: n.outputs }),
      ...(n.reduction && { reduction: n.reduction }),
      ...(n.reduction_dim != null && { reduction_dim: n.reduction_dim }),
      ...(n.hf_model && { hf_model: n.hf_model }),
      ...(n.hf_config && { hf_config: n.hf_config }),
      ...(n.path && { path: n.path }),
      ...(n.layer && { layer: n.layer }),
      ...(n.block && { block: n.block }),
      ...(n.block_ref && { block_ref: n.block_ref }),
    },
  }));

  const byId = new Map(mlNodes.map((n) => [n.id, n]));
  const portCursor = new Map<string, number>();
  const edges: RFEdge[] = mlEdges.map((e, i) => {
    let targetHandle = e.target_port ?? undefined;
    const target = byId.get(e.target);
    const ports = target ? getInputPorts(target.type, target, customLayers) : undefined;
    if (ports && !targetHandle) {
      const used = portCursor.get(e.target) ?? 0;
      targetHandle = ports[Math.min(used, ports.length - 1)];
      portCursor.set(e.target, used + 1);
    }
    return {
      id: `e-${i}`,
      source: e.source,
      sourceHandle: e.source_port ?? undefined,
      target: e.target,
      targetHandle,
    };
  });

  return { nodes: layoutGraph(nodes, edges), edges };
}

/** True when the document needs schema 1.1 (it defines or uses JSON layers). */
export function usesCustomLayers(nodes: RFNode[], customLayers: LayerMap): boolean {
  return Object.keys(customLayers).length > 0 || nodes.some((n) => n.type === 'custom' && !!n.data.layer);
}

/**
 * Export: ReactFlow state → MLnode JSON string.
 * Writes schema 1.0 unless the model defines or uses JSON custom layers (1.1),
 * so files without layers stay readable by mlnode 1.0.x.
 */
export function exportMLnode(
  nodes: RFNode[],
  edges: RFEdge[],
  settings: ModelSettings,
  customLayers: LayerMap = {}
): string {
  const mlnode: MLnodeModel = {
    mlnode_schema_version: usesCustomLayers(nodes, customLayers) ? CUSTOM_LAYERS_SCHEMA_VERSION : '1.0',
    metadata: settings.metadata,
    input_shape: settings.inputShape,
    output_node: settings.outputNodeId,
    nodes: nodes.map(toMLnodeNode),
    edges: edges.map(toMLnodeEdge),
  };
  if (Object.keys(customLayers).length > 0) mlnode.custom_layers = customLayers;
  return JSON.stringify(mlnode, null, 2);
}

/** A {"custom_layers": {...}} library — loadable with LayerRegistry.register_library(). */
export function exportLayerLibrary(customLayers: LayerMap): string {
  return JSON.stringify({ custom_layers: customLayers }, null, 2);
}

export type ImportResult =
  | { kind: 'model'; nodes: RFNode[]; edges: RFEdge[]; settings: ModelSettings; customLayers: LayerMap }
  | { kind: 'library'; customLayers: LayerMap };

/**
 * Import: MLnode JSON string → ReactFlow state.
 *
 * A model file is validated against the Zod schema and laid out. A layer
 * library ({"custom_layers": {...}} without nodes) is returned for merging
 * into the current document.
 */
export function importMLnode(json: string): ImportResult {
  const raw = JSON.parse(json);

  if (raw && typeof raw === 'object' && 'custom_layers' in raw && !('nodes' in raw)) {
    const lib = MLnodeLayerLibrarySchema.parse(raw);
    return { kind: 'library', customLayers: lib.custom_layers as LayerMap };
  }

  const data = MLnodeModelSchema.parse(raw);
  const customLayers = data.custom_layers as LayerMap;
  const { nodes, edges } = toRFGraph(data.nodes as MLnodeNode[], data.edges as MLnodeEdge[], customLayers);

  return {
    kind: 'model',
    nodes,
    edges,
    customLayers,
    settings: {
      metadata: data.metadata ?? {},
      inputShape: data.input_shape,
      outputNodeId: data.output_node,
    },
  };
}
