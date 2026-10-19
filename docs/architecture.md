# Architecture

How the editor is put together, and — most importantly — which pieces mirror the Python backend and must stay in sync with it.

## Stack

React 18 + TypeScript, ReactFlow 11 (canvas), Zustand 4 (state), Zod 3 (import validation), Tailwind 3 (styling), Vite 5 (build). No server component; the editor is a static SPA.

## Data Flow

```
palette drag ─▶ graphStore.addNode ─┐
canvas wire  ─▶ graphStore.onConnect ├─▶ RFNode[] / RFEdge[] / ModelSettings
config panel ─▶ updateNodeData      ─┘          │
                                                ▼
                              exportImport.exportMLnode()   ── Export/Ctrl+S ──▶ .mlnode.json
                              exportImport.importMLnode()   ◀─ Import ─────────  .mlnode.json
                                                │
                                    jsonSchema.ts (Zod) + autoLayout.ts
```

The editor's working representation is ReactFlow state; MLnode JSON exists only at the import/export boundary.

## State (Zustand)

**`stores/graphStore.ts`** — the document:

- `nodes: RFNode[]`, `edges: RFEdge[]` — ReactFlow objects for **whatever the canvas shows**: the model, or the open custom layer. All MLnode-specific node fields live in `node.data` (`RFNodeData`: `params`, `shared_id`, `outputs`, `reduction`, `reduction_dim`, `hf_model`, `hf_config`, `path`, `layer`, `block`, `block_ref`).
- `settings: ModelSettings` — `metadata`, `inputShape`, `outputNodeId` (the graph-level JSON fields; `outputNodeId` is the open layer's `output_node` while one is open).
- `customLayers` — JSON layer definitions (`MLnodeLayerDefinition`, exported as `custom_layers`).
- `editStack: EditFrame[]` — open layers, outermost first. `openLayer(name)` pushes a frame holding the parent canvas (nodes, edges, output, undo history) and loads the layer's sub-graph onto the canvas; `closeLayer()` writes the canvas back into `customLayers[name]` and restores the parent. `getDocument()` / `getDocumentLayers()` assemble the full model with all open edits applied — Export and Ctrl+S use them, so they work at any depth.
- Layer actions: `addLayer`, `updateLayerMeta` (params/description), `renameLayer` (rewrites every `layer` reference; clears undo history, since older snapshots use the old name), `renameLayerParam` (rewrites `$` references and usage param keys), `deleteLayer` (refused while used or open), `mergeLayers` (library import), `createLayerFromSelection`. `renameNode` renames a node ID across edges and the output setting.
- Actions: ReactFlow change handlers, `addNode` (applies `NODE_DEFAULTS`, auto-ID `<type>_<n>`), `deleteSelected` (also drops dangling edges and clears a deleted output), `updateNodeData`, `setOutputNode`, `setGraph` (import — resyncs the ID counter to avoid collisions), `tidyLayout`.
- History: `past`/`future` snapshots of nodes, edges and `customLayers` (max 30), pushed by `onConnect`, `addNode`, `deleteSelected`, `tidyLayout`, `renameNode`, `addLayer`, `deleteLayer`, `mergeLayers` and `createLayerFromSelection` (param and description edits, like node param edits, are not). Each open layer has its own history; the parent's is restored on close. `updateNodeData` deliberately does **not** push — param typing would flood the history.

**`stores/uiStore.ts`** — ephemera: selected node, toast queue (4 s auto-dismiss), and `fitViewNonce`, a counter bumped to ask the canvas to re-fit the viewport after import/Tidy.

## Export / Import (`utils/exportImport.ts`)

Field mapping:

| ReactFlow | MLnode JSON |
|-----------|-------------|
| `node.id` | `node.id` |
| `node.type` | `node.type` |
| `node.data.params` | `node.params` |
| `node.data.*` (optional fields) | same-named top-level node fields (only when set), incl. `layer` |
| `customLayers` | `custom_layers` (only when non-empty) |
| `node.position` / `data.label` | **dropped** — the format carries no layout |
| `edge.sourceHandle` | `source_port` (`null` if default) |
| `edge.targetHandle` | `target_port` (`null` if default) |
| `settings.metadata / inputShape / outputNodeId` | `metadata` / `input_shape` / `output_node` |
| — | `mlnode_schema_version`: `"1.1"` if the model defines or uses JSON layers, else `"1.0"` |

Import reverses the mapping, then:

1. **Zod validation** (`utils/jsonSchema.ts`) — a structural mirror of the backend's Pydantic models: versions `"1.0"`/`"1.1"`, `custom_layers` only with `1.1`, and `LayerDefinition`'s rules (an Input node, existing `output_node` and edge endpoints, unique IDs, identifier param names). Bad files fail with a toast before touching the store. A `{"custom_layers": …}` file without nodes is recognized as a layer library and merged instead.
2. **Port backfill** — edges into multi-input nodes (core multi-input layers and JSON layers with several Input nodes) without a `target_port` get one assigned in declaration order, replicating the Python executor's fallback, so they land on the correct labeled handles.

`toMLnodeNode` / `toMLnodeEdge` / `toRFGraph` are the per-node/edge converters; the store reuses them to load and save layer sub-graphs.

## Custom Layers (`utils/customLayers.ts`)

Pure helpers, no React: port names (`layerInputPorts`, `getInputPorts`), param binding checks mirroring the backend's `bind_params` (`checkLayerParams`, `matchesParamType` — `bool` is not `int`), typed parsing of param fields (`parseParamText`), `$` reference scanning and renaming (`referencedParams`, `renameParamReferences`), layer dependency cycles (`findLayerCycle`), usages, and `buildLayerFromSelection` (Input port per distinct external source, single output node, internal edges kept). The editor does not evaluate `${expr}`; it only checks that the names it uses are declared params.
3. **Auto-layout** — positions are synthesized (see below), and the viewport re-fits.

## Auto-Layout (`utils/autoLayout.ts`)

Sugiyama-style layered layout, left → right, dependency-free:

1. **Rank assignment** — longest-path layering via Kahn's algorithm (cycle-tolerant; unranked leftovers are dropped into rank 0).
2. **Crossing reduction** — 4 alternating barycenter sweeps.
3. **Coordinates** — x = rank × 280 px; y stacks nodes using per-card height estimates (mirroring the card rendering logic in `nodeTypes.tsx`), then 3 relaxation passes pull each node toward the mean of its neighbors.

Used on import and by the toolbar **Tidy** action.

## Validation (`utils/dagValidator.ts`)

Runs on Validate and before Export (`utils/documentValidation.ts` picks the view: Validate checks what the canvas shows, Export checks the whole document). `validateGraph` errors: duplicate IDs, missing/deleted output node, no Input node, cycles (DFS), `custom` without exactly one of `layer`/`path`, JSON layer param binding and port binding, undeclared `$` references inside a layer, `Block` without definition, `reduction` on a reduction op. Warnings: nodes unreachable from any Input (BFS), layers not defined in the file (they may come from a Python `LayerRegistry`), `$` values outside layers. `validateLayers` checks every layer definition (Zod `MLnodeLayerSchema`, references, nested layer params) and cycles between layers. Shape inference (`utils/shapeValidator.ts`) is a stub that reports `unknown` for every edge — the Python backend is the shape authority.

## Node Rendering (`components/canvas/nodeTypes.tsx`)

One card component serves every type; ReactFlow's `nodeTypes` registry maps all ~120 type strings to it. The card derives everything from `node.type` + `node.data`: category color, param preview (first 3), badges (OUTPUT, block, 🤗), and handles:

- default: one target handle (left) + one source handle (right);
- types in `INPUT_PORTS`, and JSON layer nodes whose layer has several Input nodes: one labeled target handle per port — **the handle `id` is the port name**, which is what makes `target_port` round-trip (the card calls `useUpdateNodeInternals` when a layer's ports change);
- nodes with `data.outputs`: one labeled source handle per declared port.

## Contract with the Python Backend

These editor tables are hand-synced mirrors of backend code. If you change one side, change the other:

| Editor | Backend (`mlnode`) | Purpose |
|--------|--------------------|---------|
| `types/mlnode.ts` → `INPUT_PORTS` | `schema/types.py` → `MULTI_INPUT_LAYERS` | Named ports for multi-input layers |
| `types/mlnode.ts` → `REDUCTION_OPS`, `ELEMENTWISE_OPS`, `TENSOR_OPS` | `schema/types.py` (same names) | Op classification |
| `constants/nodeCategories.ts` + `canvas/nodeTypes.tsx` type list | `schema/types.py` → `CORE_LAYER_TYPES` | Which types exist |
| `constants/nodeDefaults.ts` | `torch.nn` constructor signatures | Default params (incl. `batch_first: true` on sequence layers) |
| `utils/jsonSchema.ts` (Zod) | `schema/models.py` (Pydantic) | File format validation, incl. `LayerDefinition` |
| `utils/customLayers.ts` → `checkLayerParams`, `matchesParamType`, `EXPR_FUNCTIONS` | `layers/json_layers.py` → `bind_params`, `_TYPE_CHECKS`, `_FUNCTIONS` | JSON layer param binding and expressions |

Known intentional gaps: the palette offers some types (`Unfold`, `Fold`, lazy convs, `MaxUnpool*`, `LPPool*`, `GLU`, `LSTMCell`, …) whose backend **shape rules are still pending** — they export fine but fail backend `validate()` today (see [validation.md](https://github.com/Nasser-Obeid/MLnode/blob/main/docs/validation.md)); the HuggingFace palette entries are commented out while HF nodes remain import-only.
