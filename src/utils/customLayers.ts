/**
 * JSON custom layers (schema 1.1) — pure helpers shared by the store, the
 * canvas, the config panel, the validator, and import/export.
 *
 * Semantics mirror the Python backend (mlnode/layers/json_layers.py):
 * - a layer's Input nodes are its input ports, in declaration order;
 * - a param without a `default` key is required;
 * - "$name" / "${expr}" in inner node params reference the layer's params.
 */

import type { RFNode, RFEdge, RFNodeData } from '../types/reactflow';
import type {
  MLnodeEdge,
  MLnodeLayerDefinition,
  MLnodeNode,
  MLnodeParamSpec,
  ParamType,
} from '../types/mlnode';
import { INPUT_PORTS } from '../types/mlnode';

export type LayerMap = Record<string, MLnodeLayerDefinition>;

// ──────────────────────────────────────────────
// Ports and params
// ──────────────────────────────────────────────

/** Input port names of a layer: its Input node ids, in declaration order. */
export function layerInputPorts(def: MLnodeLayerDefinition): string[] {
  return def.nodes.filter((n) => n.type === 'Input').map((n) => n.id);
}

/**
 * Named input handles for a node, or undefined for a single default handle.
 * Core multi-input layers use INPUT_PORTS; JSON layers with several Input
 * nodes use those nodes' ids (which become the edge's target_port).
 */
export function getInputPorts(
  type: string | undefined,
  data: Pick<RFNodeData, 'layer'> | undefined,
  customLayers: LayerMap
): string[] | undefined {
  if (type === 'custom' && data?.layer) {
    const def = customLayers[data.layer];
    if (!def) return undefined;
    const ports = layerInputPorts(def);
    return ports.length > 1 ? ports : undefined;
  }
  return INPUT_PORTS[type ?? ''];
}

export function isRequired(spec: MLnodeParamSpec): boolean {
  return !('default' in spec);
}

export function isParamReference(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('$') && !value.startsWith('$$');
}

/** Same type rules as the backend's _TYPE_CHECKS (bool is not an int). */
export function matchesParamType(type: ParamType | undefined, value: unknown): boolean {
  switch (type ?? 'any') {
    case 'int': return typeof value === 'number' && Number.isInteger(value);
    case 'float': return typeof value === 'number';
    case 'bool': return typeof value === 'boolean';
    case 'str': return typeof value === 'string';
    case 'list': return Array.isArray(value);
    case 'dict': return typeof value === 'object' && value !== null && !Array.isArray(value);
    default: return true;
  }
}

/**
 * Parse text from a param field. With a declared type the text is read as
 * that type; otherwise numbers, JSON arrays/objects and true/false are sniffed.
 * "$…" references are always kept as strings.
 */
export function parseParamText(raw: string, type?: ParamType): any {
  const text = raw.trim();
  if (text.startsWith('$')) return raw;
  if (type === 'str') return raw;
  if (type === 'list' || type === 'dict') {
    try { return JSON.parse(text); } catch { return raw; }
  }
  if (type === 'bool') {
    if (text === 'true') return true;
    if (text === 'false') return false;
    return raw;
  }
  const num = Number(text);
  if (text !== '' && !isNaN(num)) return num;
  if (text.startsWith('[') || text.startsWith('{')) {
    try { return JSON.parse(text); } catch { return raw; }
  }
  if (text === 'true') return true;
  if (text === 'false') return false;
  if (text === 'null') return null;
  return raw;
}

export function formatParamValue(value: unknown): string {
  if (value === undefined) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

/** Functions allowed in "${expr}" — names that are not param references. */
const EXPR_FUNCTIONS = new Set(['min', 'max', 'abs', 'int', 'float', 'round']);

/** Param names referenced by a JSON value ("$name" and names inside "${expr}"). */
export function referencedParams(value: unknown, out: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) {
    value.forEach((v) => referencedParams(v, out));
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((v) => referencedParams(v, out));
  } else if (isParamReference(value)) {
    if (value.startsWith('${') && value.endsWith('}')) {
      const expr = value.slice(2, -1);
      for (const m of expr.matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)) {
        // Skip digits-attached tokens like the "e5" in "1e5".
        const before = expr[m.index! - 1];
        if (before && /[0-9.]/.test(before)) continue;
        if (!EXPR_FUNCTIONS.has(m[0])) out.add(m[0]);
      }
    } else {
      out.add(value.slice(1));
    }
  }
  return out;
}

/**
 * Rewrite references to param `from` as `to` in a JSON value: "$from" and the
 * identifier `from` inside "${…}" expressions. Returns the new value and how
 * many references changed.
 */
export function renameParamReferences(value: any, from: string, to: string): { value: any; count: number } {
  if (Array.isArray(value)) {
    let count = 0;
    const out = value.map((v) => {
      const r = renameParamReferences(v, from, to);
      count += r.count;
      return r.value;
    });
    return { value: out, count };
  }
  if (value && typeof value === 'object') {
    let count = 0;
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      const r = renameParamReferences(v, from, to);
      count += r.count;
      out[k] = r.value;
    }
    return { value: out, count };
  }
  if (!isParamReference(value)) return { value, count: 0 };
  if (value.startsWith('${') && value.endsWith('}')) {
    let count = 0;
    const expr = value.slice(2, -1).replace(/[A-Za-z_][A-Za-z0-9_]*/g, (name, offset: number, whole: string) => {
      const before = whole[offset - 1];
      if (name !== from || (before && /[0-9.]/.test(before))) return name;
      count++;
      return to;
    });
    return { value: `\${${expr}}`, count };
  }
  return value === `$${from}` ? { value: `$${to}`, count: 1 } : { value, count: 0 };
}

export interface ParamIssue {
  kind: 'unknown' | 'missing' | 'type';
  param: string;
  message: string;
}

/**
 * Check a layer node's params against the layer's declared params — the same
 * checks the backend runs at load time (bind_params). Values that are "$…"
 * references (inside another layer) are resolved later and not type-checked.
 */
export function checkLayerParams(
  nodeId: string,
  layerName: string,
  params: Record<string, any>,
  def: MLnodeLayerDefinition
): ParamIssue[] {
  const issues: ParamIssue[] = [];
  for (const name of Object.keys(params)) {
    if (!(name in def.params)) {
      issues.push({
        kind: 'unknown',
        param: name,
        message: `"${nodeId}" (layer ${layerName}): unknown param "${name}". Declared: ${Object.keys(def.params).join(', ') || 'none'}.`,
      });
    }
  }
  for (const [name, spec] of Object.entries(def.params)) {
    if (!(name in params)) {
      if (isRequired(spec)) {
        issues.push({
          kind: 'missing',
          param: name,
          message: `"${nodeId}" (layer ${layerName}): missing required param "${name}".`,
        });
      }
      continue;
    }
    const value = params[name];
    if (isParamReference(value)) continue;
    if (value === null && !isRequired(spec)) continue;
    if (!matchesParamType(spec.type, value)) {
      issues.push({
        kind: 'type',
        param: name,
        message: `"${nodeId}" (layer ${layerName}): param "${name}" expects ${spec.type ?? 'any'}, got ${JSON.stringify(value)}.`,
      });
    }
  }
  return issues;
}

// ──────────────────────────────────────────────
// Layer graph structure
// ──────────────────────────────────────────────

/** Layer names used directly by a layer's nodes. */
export function layerDependencies(def: MLnodeLayerDefinition): string[] {
  return [...new Set(def.nodes.filter((n) => n.type === 'custom' && n.layer).map((n) => n.layer!))];
}

/** A cycle of layers using each other (e.g. ["A", "B", "A"]), or null. */
export function findLayerCycle(layers: LayerMap): string[] | null {
  const state = new Map<string, 'visiting' | 'done'>();
  const path: string[] = [];

  function visit(name: string): string[] | null {
    if (state.get(name) === 'done' || !layers[name]) return null;
    if (state.get(name) === 'visiting') {
      return [...path.slice(path.indexOf(name)), name];
    }
    state.set(name, 'visiting');
    path.push(name);
    for (const dep of layerDependencies(layers[name])) {
      const cycle = visit(dep);
      if (cycle) return cycle;
    }
    path.pop();
    state.set(name, 'done');
    return null;
  }

  for (const name of Object.keys(layers)) {
    const cycle = visit(name);
    if (cycle) return cycle;
  }
  return null;
}

/** Ids of nodes (main graph + all layers) that use the given layer. */
export function layerUsages(name: string, nodes: RFNode[], layers: LayerMap): string[] {
  const used = nodes.filter((n) => n.type === 'custom' && n.data.layer === name).map((n) => n.id);
  for (const [layerName, def] of Object.entries(layers)) {
    for (const n of def.nodes) {
      if (n.type === 'custom' && n.layer === name) used.push(`${layerName}/${n.id}`);
    }
  }
  return used;
}

export function renameLayerRefsInDef(def: MLnodeLayerDefinition, from: string, to: string): MLnodeLayerDefinition {
  return {
    ...def,
    nodes: def.nodes.map((n) => (n.type === 'custom' && n.layer === from ? { ...n, layer: to } : n)),
  };
}

export function renameLayerRefsInNodes(nodes: RFNode[], from: string, to: string): RFNode[] {
  return nodes.map((n) =>
    n.type === 'custom' && n.data.layer === from ? { ...n, data: { ...n.data, layer: to } } : n
  );
}

/** Starter definition for "New layer": x → Identity, ready to edit. */
export function newLayerTemplate(): MLnodeLayerDefinition {
  return {
    description: '',
    params: {},
    nodes: [
      { id: 'x', type: 'Input', params: {} },
      { id: 'out', type: 'Identity', params: {} },
    ],
    edges: [{ source: 'x', source_port: null, target: 'out', target_port: null }],
    output_node: 'out',
  };
}

export function uniqueLayerName(base: string, layers: LayerMap): string {
  if (!layers[base]) return base;
  let i = 2;
  while (layers[`${base}${i}`]) i++;
  return `${base}${i}`;
}

// ──────────────────────────────────────────────
// Create a layer from a canvas selection
// ──────────────────────────────────────────────

export interface SelectionLayerResult {
  definition: MLnodeLayerDefinition;
  /** Wiring for the node that replaces the selection. */
  inputs: { source: string; sourceHandle: string | null; port: string }[];
  outputs: { target: string; targetHandle: string | null }[];
  /** True when the model's output node was inside the selection. */
  containsOutput: boolean;
}

/**
 * Turn the selected nodes into a layer definition.
 *
 * Every distinct external source feeding the selection becomes an Input node
 * (port). The selection must have exactly one output: the single node whose
 * value leaves the selection (or, if nothing leaves it, its single sink).
 * Constants stay inline — declare params afterwards in the layer editor.
 */
export function buildLayerFromSelection(
  nodes: RFNode[],
  edges: RFEdge[],
  selectedIds: Set<string>,
  outputNodeId: string,
  toNode: (n: RFNode) => MLnodeNode
): SelectionLayerResult {
  const selected = nodes.filter((n) => selectedIds.has(n.id));
  if (selected.length === 0) throw new Error('Select the nodes to turn into a layer first.');
  if (selected.some((n) => n.type === 'Input')) {
    throw new Error('Input nodes cannot go into a layer — leave them out of the selection.');
  }

  const incoming = edges.filter((e) => selectedIds.has(e.target) && !selectedIds.has(e.source));
  const outgoing = edges.filter((e) => selectedIds.has(e.source) && !selectedIds.has(e.target));
  const internal = edges.filter((e) => selectedIds.has(e.source) && selectedIds.has(e.target));

  // Output node
  let outputId: string;
  const leaving = [...new Set(outgoing.map((e) => `${e.source}\u0000${e.sourceHandle ?? ''}`))];
  if (leaving.length > 1) {
    throw new Error('A layer has one output, but values leave the selection from several nodes/ports.');
  }
  if (leaving.length === 1) {
    const [src, handle] = leaving[0].split('\u0000');
    if (handle) throw new Error(`The selection's output comes from port "${handle}" of "${src}" — a layer output must be a whole node.`);
    outputId = src;
  } else {
    const sinks = selected.filter((n) => !internal.some((e) => e.source === n.id));
    if (sinks.length !== 1) {
      throw new Error('Cannot tell which node is the layer output — the selection has several ends.');
    }
    outputId = sinks[0].id;
  }
  const containsOutput = selectedIds.has(outputNodeId);
  if (containsOutput && outputNodeId !== outputId) {
    throw new Error(`The model output "${outputNodeId}" is inside the selection but is not its output node.`);
  }
  if (incoming.length === 0) {
    throw new Error('Nothing flows into the selection — a layer needs at least one input.');
  }

  // One Input node per distinct external source (+port)
  const sourceKeys: string[] = [];
  for (const e of incoming) {
    const key = `${e.source}\u0000${e.sourceHandle ?? ''}`;
    if (!sourceKeys.includes(key)) sourceKeys.push(key);
  }
  const taken = new Set(selected.map((n) => n.id));
  const portNames = sourceKeys.map((_, i) => {
    let name = sourceKeys.length === 1 ? 'x' : `in${i + 1}`;
    while (taken.has(name)) name = `${name}_`;
    taken.add(name);
    return name;
  });
  const portFor = (e: RFEdge) => portNames[sourceKeys.indexOf(`${e.source}\u0000${e.sourceHandle ?? ''}`)];

  const toEdge = (source: string, sourceHandle: string | null | undefined, target: string, targetHandle: string | null | undefined): MLnodeEdge => ({
    source,
    source_port: sourceHandle ?? null,
    target,
    target_port: targetHandle ?? null,
  });

  const definition: MLnodeLayerDefinition = {
    description: '',
    params: {},
    nodes: [
      ...portNames.map((id) => ({ id, type: 'Input', params: {} })),
      ...selected.map(toNode),
    ],
    edges: [
      ...incoming.map((e) => toEdge(portFor(e), null, e.target, e.targetHandle)),
      ...internal.map((e) => toEdge(e.source, e.sourceHandle, e.target, e.targetHandle)),
    ],
    output_node: outputId,
  };

  return {
    definition,
    inputs: sourceKeys.map((key, i) => {
      const [source, handle] = key.split('\u0000');
      return { source, sourceHandle: handle || null, port: portNames[i] };
    }),
    outputs: outgoing.map((e) => ({ target: e.target, targetHandle: e.targetHandle ?? null })),
    containsOutput,
  };
}
