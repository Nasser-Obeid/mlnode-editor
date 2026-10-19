/** DAG validation — cycle detection, orphan checking, custom layer checks. */

import type { RFNode, RFEdge } from '../types/reactflow';
import type { MLnodeParamSpec } from '../types/mlnode';
import { REDUCTION_OPS } from '../types/mlnode';
import { MLnodeLayerSchema } from './jsonSchema';
import {
  checkLayerParams,
  findLayerCycle,
  layerInputPorts,
  referencedParams,
  type LayerMap,
} from './customLayers';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  type:
    | 'cycle' | 'duplicate_id' | 'no_output' | 'no_input' | 'missing_param' | 'missing_path'
    | 'missing_block' | 'reduction_on_op' | 'layer_params' | 'layer_ports' | 'param_reference'
    | 'layer_definition';
  message: string;
  nodeIds?: string[];
  edgeIds?: string[];
}

export interface ValidationWarning {
  type: 'orphan' | 'shared_mismatch' | 'unknown_layer' | 'param_reference';
  message: string;
  nodeIds: string[];
}

export interface ValidateOptions {
  /** JSON custom layer definitions available to `custom` nodes. */
  customLayers?: LayerMap;
  /** Set when the canvas shows a layer's sub-graph rather than the model. */
  editingLayer?: { name: string; params: Record<string, MLnodeParamSpec> };
}

export function validateGraph(
  nodes: RFNode[],
  edges: RFEdge[],
  outputNodeId: string,
  opts: ValidateOptions = {}
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const customLayers = opts.customLayers ?? {};
  const where = opts.editingLayer ? `layer ${opts.editingLayer.name}` : 'model';

  // 1. Duplicate IDs
  const idSet = new Set<string>();
  const dupes = new Set<string>();
  for (const n of nodes) {
    if (idSet.has(n.id)) dupes.add(n.id);
    idSet.add(n.id);
  }
  if (dupes.size > 0) {
    errors.push({
      type: 'duplicate_id',
      message: `Duplicate node IDs: ${[...dupes].join(', ')}`,
      nodeIds: [...dupes],
    });
  }

  // 2. output_node not set or doesn't exist; at least one Input
  if (!outputNodeId) {
    errors.push({
      type: 'no_output',
      message: `No output node selected for the ${where}. Right-click a node → "Set as output".`,
    });
  } else if (!nodes.some((n) => n.id === outputNodeId)) {
    errors.push({
      type: 'no_output',
      message: `Output node "${outputNodeId}" not found. It may have been deleted.`,
    });
  }

  if (!nodes.some((n) => n.type === 'Input')) {
    errors.push({
      type: 'no_input',
      message: opts.editingLayer
        ? `Layer ${opts.editingLayer.name} needs at least one Input node (its input ports).`
        : 'The model needs at least one Input node.',
    });
  }

  // 3. Cycle detection (DFS)
  const adj = new Map<string, string[]>();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) {
    adj.get(e.source)?.push(e.target);
  }

  const visited = new Set<string>();
  const stack = new Set<string>();
  let hasCycle = false;
  const cycleNodes: string[] = [];

  function dfs(node: string): boolean {
    if (stack.has(node)) {
      hasCycle = true;
      cycleNodes.push(node);
      return true;
    }
    if (visited.has(node)) return false;
    visited.add(node);
    stack.add(node);
    for (const neighbor of adj.get(node) ?? []) {
      if (dfs(neighbor)) {
        cycleNodes.push(node);
        return true;
      }
    }
    stack.delete(node);
    return false;
  }

  for (const n of nodes) {
    if (!visited.has(n.id)) dfs(n.id);
  }

  if (hasCycle) {
    errors.push({
      type: 'cycle',
      message: `Cycle detected in graph`,
      nodeIds: cycleNodes,
    });
  }

  // 4. Orphan detection (not reachable from any Input)
  const inputIds = nodes.filter((n) => n.type === 'Input').map((n) => n.id);
  const reachable = new Set<string>();

  function bfs(start: string) {
    const queue = [start];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (reachable.has(cur)) continue;
      reachable.add(cur);
      for (const neighbor of adj.get(cur) ?? []) {
        queue.push(neighbor);
      }
    }
  }

  for (const id of inputIds) bfs(id);

  const orphans = nodes.filter((n) => n.type !== 'Input' && !reachable.has(n.id));
  if (orphans.length > 0) {
    warnings.push({
      type: 'orphan',
      message: `Disconnected nodes: ${orphans.map((n) => n.id).join(', ')}`,
      nodeIds: orphans.map((n) => n.id),
    });
  }

  // 5. Custom nodes: a JSON layer or a Python path (exactly one), and for
  // JSON layers the same param/port checks the backend runs at load time.
  for (const n of nodes) {
    if (n.type !== 'custom') continue;
    const { path, layer } = n.data;
    if (!path && !layer) {
      errors.push({
        type: 'missing_path',
        message: `Custom node "${n.id}" needs a JSON layer or a Python import path.`,
        nodeIds: [n.id],
      });
      continue;
    }
    if (path && layer) {
      errors.push({
        type: 'missing_path',
        message: `Custom node "${n.id}" has both a layer and a path — keep one.`,
        nodeIds: [n.id],
      });
      continue;
    }
    if (!layer) continue;
    const def = customLayers[layer];
    if (!def) {
      warnings.push({
        type: 'unknown_layer',
        message: `"${n.id}" uses layer "${layer}", which is not defined in this file — it must come from a LayerRegistry when loaded in Python.`,
        nodeIds: [n.id],
      });
      continue;
    }
    for (const issue of checkLayerParams(n.id, layer, n.data.params ?? {}, def)) {
      errors.push({ type: 'layer_params', message: issue.message, nodeIds: [n.id] });
    }
    for (const message of checkLayerPorts(n, edges, layerInputPorts(def))) {
      errors.push({ type: 'layer_ports', message, nodeIds: [n.id] });
    }
  }

  // 5b. "$param" references: only meaningful inside a layer, and must name a
  // declared param of that layer.
  for (const n of nodes) {
    const refs = [...referencedParams(n.data.params ?? {})];
    if (refs.length === 0) continue;
    if (!opts.editingLayer) {
      warnings.push({
        type: 'param_reference',
        message: `"${n.id}" has "$…" param values — references are only substituted inside a custom layer.`,
        nodeIds: [n.id],
      });
      continue;
    }
    const declared = opts.editingLayer.params;
    const unknown = refs.filter((r) => !(r in declared));
    if (unknown.length > 0) {
      errors.push({
        type: 'param_reference',
        message: `"${n.id}" references undeclared layer param(s) ${unknown.map((u) => `"${u}"`).join(', ')}. Declare them in the layer panel.`,
        nodeIds: [n.id],
      });
    }
  }

  // 6. Block node missing definition
  for (const n of nodes) {
    if (n.type === 'Block' && !n.data.block && !n.data.block_ref) {
      errors.push({
        type: 'missing_block',
        message: `Block node "${n.id}" requires a block definition or reference.`,
        nodeIds: [n.id],
      });
    }
  }

  // 7. Reduction field on reduction op
  for (const n of nodes) {
    if (REDUCTION_OPS.has(n.type ?? '') && n.data.reduction) {
      errors.push({
        type: 'reduction_on_op',
        message: `"${n.id}" (${n.type}) has implicit reduction. Remove the reduction field.`,
        nodeIds: [n.id],
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/** Edge → port binding for a JSON layer node (mirrors resolve_multi_inputs). */
function checkLayerPorts(node: RFNode, edges: RFEdge[], ports: string[]): string[] {
  const incoming = edges.filter((e) => e.target === node.id);
  const issues: string[] = [];
  if (ports.length <= 1) {
    if (incoming.length > 1 && !node.data.reduction) {
      issues.push(
        `"${node.id}" receives ${incoming.length} inputs, but layer ${node.data.layer} has one input port. Set a fallback reduction or add Input nodes to the layer.`
      );
    }
    return issues;
  }
  const seen = new Set<string>();
  for (const e of incoming) {
    const port = e.targetHandle;
    if (!port || !ports.includes(port)) {
      issues.push(`"${node.id}": an edge from "${e.source}" is not attached to a port of layer ${node.data.layer} (${ports.join(', ')}). Reconnect it.`);
    } else if (seen.has(port)) {
      issues.push(`"${node.id}": port "${port}" receives more than one edge.`);
    }
    if (port) seen.add(port);
  }
  const missing = ports.filter((p) => !seen.has(p));
  if (missing.length > 0) {
    issues.push(`"${node.id}": layer ${node.data.layer} input(s) ${missing.join(', ')} not connected.`);
  }
  return issues;
}

/**
 * Document-level checks on JSON layer definitions: structure (same rules as
 * the backend's LayerDefinition), param references, nested layer params and
 * cycles between layers.
 */
export function validateLayers(layers: LayerMap, opts: { skip?: string[] } = {}): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  for (const [name, def] of Object.entries(layers)) {
    if (opts.skip?.includes(name)) continue;
    const parsed = MLnodeLayerSchema.safeParse(def);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push({ type: 'layer_definition', message: `Layer ${name}: ${issue.message}` });
      }
      continue;
    }
    for (const n of def.nodes) {
      const unknown = [...referencedParams(n.params ?? {})].filter((r) => !(r in def.params));
      if (unknown.length > 0) {
        errors.push({
          type: 'param_reference',
          message: `Layer ${name}, node "${n.id}": undeclared param reference(s) ${unknown.map((u) => `"${u}"`).join(', ')}.`,
        });
      }
      if (n.type !== 'custom') continue;
      if (!n.path === !n.layer) {
        errors.push({
          type: 'missing_path',
          message: `Layer ${name}, node "${n.id}": a custom node needs exactly one of layer / path.`,
        });
        continue;
      }
      if (!n.layer) continue;
      const inner = layers[n.layer];
      if (!inner) {
        warnings.push({
          type: 'unknown_layer',
          message: `Layer ${name}, node "${n.id}" uses layer "${n.layer}", which is not defined in this file.`,
          nodeIds: [],
        });
        continue;
      }
      for (const issue of checkLayerParams(`${name}/${n.id}`, n.layer, n.params ?? {}, inner)) {
        errors.push({ type: 'layer_params', message: issue.message });
      }
    }
  }

  const cycle = findLayerCycle(layers);
  if (cycle) {
    errors.push({ type: 'cycle', message: `Layers use each other in a loop: ${cycle.join(' → ')}.` });
  }

  return { valid: errors.length === 0, errors, warnings };
}

/** Merge several validation results. */
export function mergeResults(...results: ValidationResult[]): ValidationResult {
  const errors = results.flatMap((r) => r.errors);
  return { valid: errors.length === 0, errors, warnings: results.flatMap((r) => r.warnings) };
}
