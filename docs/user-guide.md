# User Guide

A tour of every surface in mlnode-editor. For the exported file format, see the backend's [json-schema.md](https://github.com/Nasser-Obeid/MLnode/blob/main/docs/json-schema.md).

## Layout

```
┌──────────────────────── Top Toolbar ────────────────────────┐
│ logo · model name · input shape · undo/redo · Tidy ·        │
│ Validate · Import · Export   (breadcrumb while in a layer)  │
├──────────┬────────────────────────────────┬─────────────────┤
│ Node     │                                │ Node Config     │
│ Library  │           Canvas               │ Panel           │
│ (palette,│        (ReactFlow)             │ (selected node) │
│ ◆ Custom │                                │ or Layer Panel  │
│  Layers) │                                │ (open layer)    │
└──────────┴────────────────────────────────┴─────────────────┘
```

Toasts (success/info/error) appear in the corner and disappear after 4 seconds.

## Top Toolbar

- **Model name** — inline text field; becomes `metadata.name` and the exported filename (`<name>.mlnode.json`).
- **shape** — the graph's `input_shape` as JSON, e.g. `["B", 3, 224, 224]`. The field only applies while the text parses as a JSON array. For a friendlier per-dimension editor, click an Input node.
- **Undo / Redo** — history covers structural changes (add node, connect, delete, Tidy); the last 30 states are kept. Parameter edits are applied live and are *not* part of the history.
- **Tidy** — re-runs the auto-layout on the current graph and re-fits the viewport. Undoable.
- **Validate** — runs the structural checks (below) and reports via toasts.
- **Import** — opens a file picker for `.json` / `.mlnode.json`. A model file is validated against the schema (`1.0` or `1.1`), laid out automatically (the format carries no positions), and replaces the current graph, custom layers included. Import clears the undo history. A **layer library** (`{"custom_layers": {...}}` with no nodes) is instead merged into the current model's layers; names that already exist are skipped.
- **Export** — validates the whole model (including every custom layer) first; on errors it refuses and shows them as toasts. On success it downloads `<name>.mlnode.json`. Files that define or use JSON custom layers are written as schema `1.1`; everything else stays `1.0`, so it still loads in mlnode 1.0.x. Export works while a layer is open — the open edits are included.

`Ctrl/Cmd + S` anywhere is a **quick-save**: it downloads the JSON immediately *without* validation — useful for saving work-in-progress graphs that don't validate yet.

## Node Library (Palette)

Layers are grouped by PyTorch category, each with a color. Click a category header to expand/collapse; drag an entry onto the canvas to create a node. New nodes get:

- an auto-generated ID (`conv2d_7`),
- default params matching the `torch.nn` constructor (see `src/constants/nodeDefaults.ts`) — sequence layers (`RNN`, `LSTM`, `GRU`, `MultiheadAttention`, transformer family) include `batch_first: true` because the backend's shape rules assume it,
- for `Split`: default output ports `part1, part2`.

> The HuggingFace palette entries are currently disabled (commented out in `nodeCategories.ts`), but imported graphs containing `hf_model`/`hf_config` nodes render and can be edited — see [huggingface.md](https://github.com/Nasser-Obeid/MLnode/blob/main/docs/huggingface.md).

## Custom Layers (JSON)

A custom layer is a reusable, parameterized piece of graph — mlnode schema 1.1's `custom_layers`. The **◆ Custom Layers** section at the top of the library lists the model's layers.

**Create a layer**

- **New** — asks for a name and opens a starter layer (`x → Identity`) for editing.
- **From selection** — select nodes on the canvas (Ctrl/Cmd-click, or Shift-drag a box), then click it. The selection becomes a layer and is replaced by one node using it, wired to the same neighbors. Every distinct value flowing into the selection becomes an Input port (`x`, or `in1`, `in2`, … for several); the selection must have a single output node. Constants stay inline — declare params afterwards to make them configurable.
- **Import** a layer library file (see Top Toolbar).

**Use a layer** — drag it from the library onto the canvas. The node shows the layer name; the config panel lists the layer's declared params with their types, marks required ones with `*`, and shows defaults as placeholders. Leave a field empty to use the default. Layers with several Input nodes show one named handle per port.

**Edit a layer** — double-click a layer node (or the pencil in the library, or *Edit* in the config panel). The canvas switches to the layer's sub-graph and the toolbar shows a breadcrumb: `Model › ◆ ResidualConv › ◆ ConvBNAct` for nested layers. Click a breadcrumb entry or **Done** to go back up; edits are kept. While a layer is open:

- **Input nodes are the layer's ports.** Rename a port by renaming the Input node's ID in the config panel. The port order is the Input nodes' order.
- **Right-click** a node to make it the layer's output.
- **Reference params** in any node field: `$channels` inserts the value, `${channels // reduction}` computes simple arithmetic (`+ - * / // % **`, `min`, `max`, `abs`, `int`, `float`, `round`). `$$text` is a literal `$text`.
- **The Layer Panel** (shown when no node is selected) edits the layer's name, description and params: name, type (`int`, `float`, `bool`, `str`, `list`, `dict`, `any`), required or a default, and a description. Renaming a param rewrites its `$` references inside the layer and the param name on every node that uses the layer. Renaming the layer updates every node that uses it.

**Delete a layer** with the trash icon in the library; a layer that is still used is not deleted (the toast lists the users).

**Share layers** — *Save library* downloads `layers.json` (`{"custom_layers": {...}}`). In Python, load it with `LayerRegistry().register_library("layers.json")`, or import it into another model here.

## Canvas

- **Connect**: drag from a node's right-side handle to another node's left-side handle.
- **Multi-input layers** (`Transformer`, `TransformerDecoder(-Layer)`, `MultiheadAttention`, `Bilinear`) show one labeled handle per port (`src`/`tgt`, `tgt`/`memory`, `query`/`key`/`value`, `input1`/`input2`). The handle you attach to is exported as the edge's `target_port`.
- **Multi-output nodes** (`Split`) show one labeled handle per declared output port; the handle becomes `source_port`.
- **Select** a node (click) to open the config panel; click empty canvas to deselect.
- **Double-click** a JSON custom layer node to open its sub-graph (see Custom Layers).
- **Right-click** a node to set it as the model output (yellow border + `OUTPUT` badge).
- **Delete/Backspace** removes the selection. Edges attached to deleted nodes are cleaned up; deleting the output node clears the output setting.
- Minimap and zoom controls sit in the corners; `Tidy` + auto-fit keep large graphs readable.

Node cards show the type (color-coded), the node ID, up to three params, and badges for output status, inline/referenced blocks, and HuggingFace models. Input nodes display the current input shape.

## Node Config Panel

Opens when a node is selected.

- **Set Output / Delete** — same actions as right-click / keyboard.
- **Input Shape** (Input nodes only) — edit each dimension in place; type a number for a concrete dim or a name (`B`, `Seq`, `D`, …) for a symbolic one. `+ Add dim` / `− Remove last` change the rank. With several Input nodes the panel shows which `forward()` argument this node maps to. **The shape is global** — schema v1.0 feeds the same `input_shape` to every Input node.
- **Parameters** — every param is a free-form field with type sniffing: numeric text becomes a number, `[...]`/`{...}` parses as JSON, `true`/`false` become booleans, anything else stays a string, and clearing a field deletes the param. `+ Add parameter` prompts for a name.
- **Node ID** — the field under the type in the panel header. Edits commit on Enter or when the field loses focus; edges and the output setting follow the rename. IDs must be unique.
- **Custom nodes** — switch between **◆ JSON layer** (choose a layer, then fill its declared params; *Edit* opens it) and **Python class** (the dotted path to your `nn.Module` subclass, e.g. `user.layers.MyLayer`). One of the two is required for export.
- **Layer Input Port** (Input nodes inside an open layer) — replaces the input-shape editor: the port's shape comes from wherever the layer is used.
- **🤗 HuggingFace** — `hf_model` / `hf_config` fields, shown only when the node already carries them (e.g. from an imported file).
- **Weight Sharing** — set the same `shared_id` on two or more nodes to share one module instance. The backend requires identical `type` and `params` across the group.
- **Fallback Reduction** — `concat` / `add` / `stack` for non-reduction nodes that receive multiple inputs. Hidden on reduction ops (`Add`, `Concat`, …), which reduce implicitly — setting it there is a validation error.
- **Output Ports** (`Split` nodes) — comma-separated port names; handles update live.

## Validation

**Validate** and **Export** run these structural checks (`src/utils/dagValidator.ts`):

| Check | Severity |
|-------|----------|
| Duplicate node IDs | error |
| No output node set, or it was deleted | error |
| Cycle in the graph | error |
| No Input node (model or open layer) | error |
| `custom` node without a JSON layer or import path (or with both) | error |
| JSON layer node: missing required param, undeclared param, or wrong type (e.g. `true` or `16.5` for an `int`) | error |
| JSON layer node with several ports: edge not on a port, a port with two edges, or an unconnected port | error |
| JSON layer node with one port receiving several edges and no fallback reduction | error |
| `$name` reference to an undeclared layer param (inside a layer) | error |
| Layer definitions: structure (Input node, output node, edges, unique IDs, param names), layers using each other in a loop | error |
| JSON layer not defined in the file (expected from a Python `LayerRegistry`) | warning |
| `$…` values outside any layer (not substituted) | warning |
| `Block` node without `block`/`block_ref` | error |
| `reduction` field on a reduction op | error |
| Nodes unreachable from any Input | warning |

Shape correctness (do the tensors actually fit?) is **not** checked in the editor — that's the backend's `model.validate()`. The client-side shape checker (`shapeValidator.ts`) is a placeholder for a future release.

## Import Details

Imports are validated with Zod against the same schema the backend enforces (`mlnode_schema_version` `"1.0"` or `"1.1"`; `custom_layers` requires `"1.1"`). Two conveniences on top:

- **Auto-layout** — nodes are ranked left-to-right by dependency, crossings reduced, and rows spaced by estimated card height.
- **Port backfill** — unlabeled edges into multi-input nodes are assigned `target_port` by declaration order (the same fallback the Python executor uses), so older files attach to the correct labeled handles and re-export cleanly.

Files exported by `MLnodeModel.save()` — including `expanded=True` flattened graphs — import fine; namespaced IDs like `res1/conv` are just IDs to the editor.
