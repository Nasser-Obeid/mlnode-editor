/** Graph store — nodes, edges, custom layers, CRUD, undo/redo. */

import { create } from 'zustand';
import {
  Connection,
  EdgeChange,
  NodeChange,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
} from 'reactflow';
import type { RFNode, RFEdge, RFNodeData, ModelSettings } from '../types/reactflow';
import type { MLnodeLayerDefinition } from '../types/mlnode';
import { NODE_DEFAULTS } from '../constants/nodeDefaults';
import { layoutGraph } from '../utils/autoLayout';
import { toMLnodeEdge, toMLnodeNode, toRFGraph } from '../utils/exportImport';
import {
  buildLayerFromSelection,
  layerUsages,
  renameParamReferences,
  renameLayerRefsInDef,
  renameLayerRefsInNodes,
  type LayerMap,
} from '../utils/customLayers';

interface HistoryEntry {
  nodes: RFNode[];
  edges: RFEdge[];
  customLayers: LayerMap;
}

/**
 * One level of layer editing. While a layer is open, the canvas shows its
 * sub-graph; the frame keeps the parent canvas to restore on close.
 */
export interface EditFrame {
  layer: string;
  parentNodes: RFNode[];
  parentEdges: RFEdge[];
  parentOutputNodeId: string;
  parentPast: HistoryEntry[];
  parentFuture: HistoryEntry[];
}

interface GraphState {
  nodes: RFNode[];
  edges: RFEdge[];
  settings: ModelSettings;
  /** JSON custom layer definitions (schema 1.1), keyed by name. */
  customLayers: LayerMap;
  /** Layers being edited, outermost first; empty when the model is shown. */
  editStack: EditFrame[];
  // History
  past: HistoryEntry[];
  future: HistoryEntry[];
  // Actions
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (type: string, position: { x: number; y: number }, extra?: Partial<RFNodeData>) => void;
  deleteSelected: () => void;
  updateNodeData: (nodeId: string, data: Partial<RFNodeData>) => void;
  renameNode: (oldId: string, newId: string) => string | null;
  setOutputNode: (nodeId: string) => void;
  setSettings: (s: Partial<ModelSettings>) => void;
  setGraph: (nodes: RFNode[], edges: RFEdge[], settings: ModelSettings, customLayers?: LayerMap) => void;
  tidyLayout: () => void;
  // Custom layers
  addLayer: (name: string, def: MLnodeLayerDefinition) => void;
  updateLayerMeta: (name: string, patch: Partial<Pick<MLnodeLayerDefinition, 'params' | 'description'>>) => void;
  renameLayer: (oldName: string, newName: string) => string | null;
  /** Rename a param of the open layer and rewrite its "$…" references; returns how many. */
  renameLayerParam: (layer: string, oldKey: string, newKey: string) => number;
  deleteLayer: (name: string) => string | null;
  mergeLayers: (layers: LayerMap) => { added: string[]; skipped: string[] };
  openLayer: (name: string) => string | null;
  closeLayer: () => void;
  closeAllLayers: () => void;
  createLayerFromSelection: (name: string) => string | null;
  /** All layer definitions with the open layers' canvas edits applied. */
  getDocumentLayers: () => LayerMap;
  /** The whole model as it would be exported, even while a layer is open. */
  getDocument: () => { nodes: RFNode[]; edges: RFEdge[]; settings: ModelSettings; customLayers: LayerMap };
  // Undo/redo
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;
}

let nodeCounter = 0;

function generateId(type: string): string {
  nodeCounter++;
  return `${type.toLowerCase()}_${nodeCounter}`;
}

/** Keep generated ids clear of existing ones (after import / opening a layer). */
function syncCounter(nodes: RFNode[]) {
  for (const n of nodes) {
    const match = n.id.match(/_(\d+)$/);
    if (match) nodeCounter = Math.max(nodeCounter, parseInt(match[1], 10));
  }
}

function snapshot(nodes: RFNode[], edges: RFEdge[], customLayers: LayerMap): HistoryEntry {
  return {
    nodes: structuredClone(nodes),
    edges: structuredClone(edges),
    customLayers: structuredClone(customLayers),
  };
}

/** Write the canvas of the innermost open layer back into its definition. */
function commitCanvas(
  layers: LayerMap,
  frame: EditFrame,
  nodes: RFNode[],
  edges: RFEdge[],
  outputNodeId: string
): LayerMap {
  const def = layers[frame.layer];
  if (!def) return layers;
  return {
    ...layers,
    [frame.layer]: {
      ...def,
      nodes: nodes.map(toMLnodeNode),
      edges: edges.map(toMLnodeEdge),
      output_node: outputNodeId,
    },
  };
}

export const useGraphStore = create<GraphState>((set, get) => ({
  nodes: [
    {
      id: 'input_0',
      type: 'Input',
      position: { x: 100, y: 200 },
      data: { label: 'Input', params: {} },
    },
  ],
  edges: [],
  settings: {
    metadata: { name: 'Untitled Model' },
    inputShape: ['B', 3, 224, 224],
    outputNodeId: '',
  },
  customLayers: {},
  editStack: [],
  past: [],
  future: [],

  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) });
  },

  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },

  onConnect: (connection) => {
    get().pushHistory();
    const edge = {
      ...connection,
      id: `e-${Date.now()}`,
    };
    set({ edges: addEdge(edge, get().edges) });
  },

  addNode: (type, position, extra) => {
    get().pushHistory();
    const id = generateId(extra?.layer ?? type);
    const defaults = NODE_DEFAULTS[type] ?? {};
    const newNode: RFNode = {
      id,
      type,
      position,
      data: {
        label: `${type}`,
        params: { ...defaults },
        ...(type === 'Split' ? { outputs: ['part1', 'part2'] } : {}),
        ...(type === 'HF_Pretrained' ? { hf_model: 'bert-base-uncased' } : {}),
        ...(type === 'HF_Config' ? { hf_config: 'GPT2Config' } : {}),
        ...extra,
      },
    };
    set({ nodes: [...get().nodes, newNode] });
  },

  deleteSelected: () => {
    get().pushHistory();
    const nodes = get().nodes.filter((n) => !n.selected);
    const nodeIds = new Set(nodes.map((n) => n.id));
    const edges = get().edges.filter(
      (e) => !e.selected && nodeIds.has(e.source) && nodeIds.has(e.target)
    );
    // Clear outputNodeId if the output node was deleted
    const settings = get().settings;
    const newSettings = nodeIds.has(settings.outputNodeId)
      ? settings
      : { ...settings, outputNodeId: '' };
    set({ nodes, edges, settings: newSettings });
  },

  updateNodeData: (nodeId, data) => {
    set({
      nodes: get().nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
      ),
    });
  },

  renameNode: (oldId, newId) => {
    const id = newId.trim();
    if (id === oldId) return null;
    if (!id) return 'Node ID cannot be empty.';
    if (get().nodes.some((n) => n.id === id)) return `A node "${id}" already exists.`;
    get().pushHistory();
    const { nodes, edges, settings } = get();
    set({
      nodes: nodes.map((n) => (n.id === oldId ? { ...n, id } : n)),
      edges: edges.map((e) => ({
        ...e,
        source: e.source === oldId ? id : e.source,
        target: e.target === oldId ? id : e.target,
      })),
      settings: settings.outputNodeId === oldId ? { ...settings, outputNodeId: id } : settings,
    });
    return null;
  },

  setOutputNode: (nodeId) => {
    set({
      settings: { ...get().settings, outputNodeId: nodeId },
    });
  },

  setSettings: (s) => {
    set({ settings: { ...get().settings, ...s } });
  },

  setGraph: (nodes, edges, settings, customLayers = {}) => {
    nodeCounter = nodes.length;
    syncCounter(nodes);
    set({ nodes, edges, settings, customLayers, editStack: [], past: [], future: [] });
  },

  tidyLayout: () => {
    get().pushHistory();
    set({ nodes: layoutGraph(get().nodes, get().edges) });
  },

  // ── Custom layers ──

  addLayer: (name, def) => {
    get().pushHistory();
    set({ customLayers: { ...get().customLayers, [name]: def } });
  },

  updateLayerMeta: (name, patch) => {
    const def = get().customLayers[name];
    if (!def) return;
    set({ customLayers: { ...get().customLayers, [name]: { ...def, ...patch } } });
  },

  renameLayer: (oldName, newName) => {
    const name = newName.trim();
    if (name === oldName) return null;
    if (!name) return 'Layer name cannot be empty.';
    if (get().customLayers[name]) return `A layer "${name}" already exists.`;
    // History is cleared: older snapshots still use the old name, and undoing
    // across a rename would desync them from the open-layer stack.
    const { customLayers, nodes, editStack } = get();
    const renamed: LayerMap = {};
    for (const [key, def] of Object.entries(customLayers)) {
      renamed[key === oldName ? name : key] = renameLayerRefsInDef(def, oldName, name);
    }
    set({
      customLayers: renamed,
      nodes: renameLayerRefsInNodes(nodes, oldName, name),
      editStack: editStack.map((f) => ({
        ...f,
        layer: f.layer === oldName ? name : f.layer,
        parentNodes: renameLayerRefsInNodes(f.parentNodes, oldName, name),
        parentPast: [],
        parentFuture: [],
      })),
      past: [],
      future: [],
    });
    return null;
  },

  renameLayerParam: (layer, oldKey, newKey) => {
    const def = get().customLayers[layer];
    if (!def) return 0;
    const params: LayerMap[string]['params'] = {};
    for (const [k, v] of Object.entries(def.params)) params[k === oldKey ? newKey : k] = v;
    // The layer is open, so its nodes are the canvas nodes.
    let count = 0;
    const nodes = get().nodes.map((n) => {
      const r = renameParamReferences(n.data.params, oldKey, newKey);
      count += r.count;
      return r.count ? { ...n, data: { ...n.data, params: r.value } } : n;
    });
    // Nodes that use this layer pass the param by name: rename the key there
    // too — in other layer definitions and in the stashed parent canvases.
    const renameKey = (p: Record<string, any>) =>
      Object.fromEntries(Object.entries(p).map(([k, v]) => [k === oldKey ? newKey : k, v]));
    const usesLayer = (type: string | undefined, l: string | undefined) => type === 'custom' && l === layer;
    const customLayers: LayerMap = {};
    for (const [name, d] of Object.entries(get().customLayers)) {
      customLayers[name] = {
        ...(name === layer ? { ...d, params } : d),
        nodes: d.nodes.map((n) => (usesLayer(n.type, n.layer) ? { ...n, params: renameKey(n.params) } : n)),
      };
    }
    const editStack = get().editStack.map((f) => ({
      ...f,
      parentNodes: f.parentNodes.map((n) =>
        usesLayer(n.type, n.data.layer) ? { ...n, data: { ...n.data, params: renameKey(n.data.params) } } : n
      ),
    }));
    set({ customLayers, nodes, editStack });
    return count;
  },

  deleteLayer: (name) => {
    const { editStack } = get();
    if (editStack.some((f) => f.layer === name)) return `Close layer "${name}" before deleting it.`;
    const mainNodes = editStack.length > 0 ? editStack[0].parentNodes : get().nodes;
    const used = layerUsages(name, mainNodes, get().getDocumentLayers());
    if (used.length > 0) {
      return `Layer "${name}" is used by ${used.join(', ')}. Remove those nodes first.`;
    }
    get().pushHistory();
    const { [name]: _removed, ...rest } = get().customLayers;
    set({ customLayers: rest });
    return null;
  },

  mergeLayers: (layers) => {
    const added: string[] = [];
    const skipped: string[] = [];
    const merged = { ...get().customLayers };
    for (const [name, def] of Object.entries(layers)) {
      if (merged[name]) skipped.push(name);
      else { merged[name] = def; added.push(name); }
    }
    if (added.length > 0) {
      get().pushHistory();
      set({ customLayers: merged });
    }
    return { added, skipped };
  },

  openLayer: (name) => {
    const { customLayers, editStack, nodes, edges, settings, past, future } = get();
    if (!customLayers[name]) return `Layer "${name}" is not defined in this model.`;
    if (editStack.some((f) => f.layer === name)) return `Layer "${name}" is already open.`;
    const def = customLayers[name];
    const graph = toRFGraph(def.nodes, def.edges, customLayers);
    syncCounter(graph.nodes);
    set({
      editStack: [
        ...editStack,
        {
          layer: name,
          parentNodes: nodes,
          parentEdges: edges,
          parentOutputNodeId: settings.outputNodeId,
          parentPast: past,
          parentFuture: future,
        },
      ],
      nodes: graph.nodes,
      edges: graph.edges,
      settings: { ...settings, outputNodeId: def.output_node },
      past: [],
      future: [],
    });
    return null;
  },

  closeLayer: () => {
    const { editStack, customLayers, nodes, edges, settings } = get();
    if (editStack.length === 0) return;
    const frame = editStack[editStack.length - 1];
    set({
      customLayers: commitCanvas(customLayers, frame, nodes, edges, settings.outputNodeId),
      editStack: editStack.slice(0, -1),
      nodes: frame.parentNodes,
      edges: frame.parentEdges,
      settings: { ...settings, outputNodeId: frame.parentOutputNodeId },
      past: frame.parentPast,
      future: frame.parentFuture,
    });
  },

  closeAllLayers: () => {
    while (get().editStack.length > 0) get().closeLayer();
  },

  getDocumentLayers: () => {
    const { editStack, customLayers, nodes, edges, settings } = get();
    if (editStack.length === 0) return customLayers;
    // The innermost open layer lives on the canvas; each outer open layer's
    // canvas is stashed as the parent canvas of the frame above it.
    let layers = commitCanvas(customLayers, editStack[editStack.length - 1], nodes, edges, settings.outputNodeId);
    for (let i = editStack.length - 1; i > 0; i--) {
      const f = editStack[i];
      layers = commitCanvas(layers, editStack[i - 1], f.parentNodes, f.parentEdges, f.parentOutputNodeId);
    }
    return layers;
  },

  getDocument: () => {
    const { editStack, nodes, edges, settings } = get();
    const customLayers = get().getDocumentLayers();
    if (editStack.length === 0) return { nodes, edges, settings, customLayers };
    const root = editStack[0];
    return {
      nodes: root.parentNodes,
      edges: root.parentEdges,
      settings: { ...settings, outputNodeId: root.parentOutputNodeId },
      customLayers,
    };
  },

  createLayerFromSelection: (name) => {
    const layerName = name.trim();
    if (!layerName) return 'Layer name cannot be empty.';
    const { nodes, edges, settings, customLayers } = get();
    if (customLayers[layerName]) return `A layer "${layerName}" already exists.`;
    const selectedIds = new Set(nodes.filter((n) => n.selected).map((n) => n.id));

    let built;
    try {
      built = buildLayerFromSelection(nodes, edges, selectedIds, settings.outputNodeId, toMLnodeNode);
    } catch (err: any) {
      return err.message as string;
    }

    get().pushHistory();
    const selected = nodes.filter((n) => selectedIds.has(n.id));
    const position = {
      x: selected.reduce((s, n) => s + n.position.x, 0) / selected.length,
      y: selected.reduce((s, n) => s + n.position.y, 0) / selected.length,
    };
    const id = generateId(layerName);
    const multiPort = built.inputs.length > 1;
    const replacement: RFNode = {
      id,
      type: 'custom',
      position,
      selected: true,
      data: { label: layerName, params: {}, layer: layerName },
    };
    const keptEdges = edges.filter((e) => !selectedIds.has(e.source) && !selectedIds.has(e.target));
    const stamp = Date.now();
    const newEdges: RFEdge[] = [
      ...built.inputs.map((inp, i) => ({
        id: `e-${stamp}-in${i}`,
        source: inp.source,
        sourceHandle: inp.sourceHandle ?? undefined,
        target: id,
        targetHandle: multiPort ? inp.port : undefined,
      })),
      ...built.outputs.map((out, i) => ({
        id: `e-${stamp}-out${i}`,
        source: id,
        target: out.target,
        targetHandle: out.targetHandle ?? undefined,
      })),
    ];
    set({
      customLayers: { ...customLayers, [layerName]: built.definition },
      nodes: [...nodes.filter((n) => !selectedIds.has(n.id)).map((n) => ({ ...n, selected: false })), replacement],
      edges: [...keptEdges, ...newEdges],
      settings: built.containsOutput ? { ...settings, outputNodeId: id } : settings,
    });
    return null;
  },

  // ── History ──

  pushHistory: () => {
    const { nodes, edges, customLayers, past } = get();
    set({
      past: [...past.slice(-30), snapshot(nodes, edges, customLayers)],
      future: [],
    });
  },

  undo: () => {
    const { past, nodes, edges, customLayers } = get();
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    set({
      past: past.slice(0, -1),
      future: [snapshot(nodes, edges, customLayers), ...get().future],
      nodes: prev.nodes,
      edges: prev.edges,
      customLayers: prev.customLayers,
    });
  },

  redo: () => {
    const { future, nodes, edges, customLayers } = get();
    if (future.length === 0) return;
    const next = future[0];
    set({
      future: future.slice(1),
      past: [...get().past, snapshot(nodes, edges, customLayers)],
      nodes: next.nodes,
      edges: next.edges,
      customLayers: next.customLayers,
    });
  },
}));
