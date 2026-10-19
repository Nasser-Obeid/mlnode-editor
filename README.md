# mlnode-editor

**Visual node-based editor for [MLnode](https://github.com/Nasser-Obeid/MLnode) graphs.**

### ▶ [Try it live — nasser-obeid.github.io/mlnode-editor](https://nasser-obeid.github.io/mlnode-editor/)

No install, no sign-up, no server — the whole editor runs in your browser.

Drag PyTorch layers onto a canvas, wire them into a DAG, and export a `.mlnode.json` file that the MLnode Python backend validates and compiles into an executable `nn.Module`. The editor and the backend share only the JSON schema — there is no server; everything runs in the browser.

```
draw graph  →  Export  →  model.mlnode.json  →  MLnodeModel.load()  →  validate()/build()
```

## Quick Start

The [hosted version](https://nasser-obeid.github.io/mlnode-editor/) needs nothing installed. To run it locally:

```bash
npm install
npm run dev        # Vite dev server → http://localhost:5173
```

Other scripts:

```bash
npm run build      # type-check (tsc -b) + production build to dist/
npm run preview    # serve the production build locally
```

Requires Node 18+.

## Features

- **Full palette** — every node type the Python backend accepts, grouped by PyTorch category (convolution, pooling, activations, normalization, recurrent, transformer, linear, dropout, sparse, vision, reduction, tensor ops, Block, custom), with sensible PyTorch-matching default params.
- **JSON custom layers** (mlnode schema 1.1) — define reusable, parameterized layers and use them like built-in types. Create one from scratch or **group a selection** of nodes into a layer; double-click a layer node to edit its sub-graph (nested layers open as a breadcrumb); declare typed params with defaults and reference them in node fields as `$name` / `${expr}`. Layers with several Input nodes get named ports. Layers travel inside the model file or as a shareable library (`LayerRegistry.register_library()` in Python).
- **Named input ports** — multi-input layers (`Transformer`, `TransformerDecoder(-Layer)`, `MultiheadAttention`, `Bilinear`) render one labeled handle per port; the handle you connect to becomes the edge's `target_port` in the exported JSON.
- **Multi-output ports** — `Split` nodes expose configurable named output handles (`source_port`).
- **Config panel** — rename node IDs, edit params, weight sharing (`shared_id`), fallback reduction, custom layers (JSON layer or Python import path), and HuggingFace fields on the selected node.
- **Graph validation** — duplicate IDs, cycles, missing output/Input node, disconnected nodes, custom nodes without a layer or path, Block definitions, illegal `reduction` fields, and for JSON layers the same param and port checks the backend runs at load time — surfaced as toasts before export.
- **Auto-layout** — imported files (which carry no positions) are arranged with a layered Sugiyama-style layout; the **Tidy** button re-runs it any time.
- **Round-trip import/export** — exported files open in the Python backend and vice versa; unlabeled edges into multi-input nodes are backfilled with ports on import, matching the backend's declaration-order fallback.
- **Undo/redo**, minimap, pan/zoom, dark UI.

## Keyboard Shortcuts

| Keys | Action |
|------|--------|
| `Ctrl/Cmd + S` | Quick-save — downloads the current graph as `.mlnode.json` (skips validation; includes custom layers, even while one is open) |
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` | Redo |
| `Delete` / `Backspace` | Delete selected nodes/edges (canvas must have focus) |

## The 60-Second Tour

1. **Drag** a layer from the left sidebar onto the canvas. An `Input` node is already there.
2. **Connect** nodes by dragging from a right-side (output) handle to a left-side (input) handle.
3. **Click** a node to open the config panel on the right; edit its parameters.
4. **Right-click** a node (or use *Set Output* in the panel) to mark it as the model's output — it gets a yellow border.
5. Set the **model name** and **input shape** in the toolbar (or click the Input node for a per-dimension editor).
6. Hit **Validate** for a structural check, then **Export** to download the JSON.
7. Train it:

```python
from mlnode import MLnodeModel
model = MLnodeModel.load("my_model.mlnode.json")
print(model.validate().valid)     # backend static shape check
module = model.build()            # nn.Module — train as usual
```

The editor checks graph *structure*; tensor **shape** validation is the Python backend's job (`model.validate()`). A graph that exports cleanly can still fail backend validation — that's expected division of labor.

## Documentation

- [QUICKSTART.md](QUICKSTART.md) — draw and train your first model in five minutes
- [docs/user-guide.md](docs/user-guide.md) — every UI surface in detail
- [docs/architecture.md](docs/architecture.md) — code layout, stores, the RF ↔ MLnode mapping, what must stay in sync with the backend
- [MLnode docs/json-schema.md](https://github.com/Nasser-Obeid/MLnode/blob/main/docs/json-schema.md) — the exported format itself

## Project Structure

```
src/
├── App.tsx                        # Layout + global Ctrl/Cmd+S handler
├── components/
│   ├── toolbar/TopToolbar.tsx     # Name, shape, undo/redo, Tidy, Validate, Import, Export
│   ├── sidebar/NodeLibrary.tsx    # Draggable palette (categories from constants/)
│   ├── sidebar/NodeConfigPanel.tsx# Selected-node editor
│   ├── canvas/ModelCanvas.tsx     # ReactFlow wrapper, keyboard + drag-drop
│   ├── canvas/nodeTypes.tsx       # The node card component (handles, badges, colors)
│   └── dialogs/Toasts.tsx         # Toast notifications
├── stores/
│   ├── graphStore.ts              # Zustand: nodes, edges, settings, undo history
│   └── uiStore.ts                 # Zustand: selection, toasts, fit-view requests
├── constants/
│   ├── nodeCategories.ts          # Palette grouping + colors
│   └── nodeDefaults.ts            # Default params per type (matches torch.nn)
├── types/
│   ├── mlnode.ts                  # MLnode JSON types + INPUT_PORTS table
│   └── reactflow.ts               # RF node/edge data types
└── utils/
    ├── exportImport.ts            # RF state ↔ MLnode JSON
    ├── jsonSchema.ts              # Zod schemas (mirror of backend Pydantic)
    ├── dagValidator.ts            # Structural validation
    ├── autoLayout.ts              # Layered auto-layout (import + Tidy)
    └── shapeValidator.ts          # Advisory shape hints (placeholder)
```

Tech stack: React 18, ReactFlow 11, Zustand 4, Zod 3, Tailwind 3, Vite 5, TypeScript 5.
