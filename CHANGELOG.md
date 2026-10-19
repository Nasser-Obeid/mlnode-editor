# Changelog

All notable changes to **mlnode-editor** are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [1.1.0] — 2026-10-19

Supports [mlnode 1.1.0](https://github.com/Nasser-Obeid/MLnode)'s JSON custom layers (schema `1.1`).

### Added

- **JSON custom layers.** A **◆ Custom Layers** library section lists the
  model's layers; drag one onto the canvas to use it.
  - **New** creates a starter layer; **From selection** turns the selected
    nodes into a layer and replaces them with one wired-up layer node (one
    Input port per distinct incoming value, single output).
  - **Double-click** a layer node to edit its sub-graph on the canvas; nested
    layers open as a breadcrumb (`Model › ◆ A › ◆ B`) with a **Done** button.
  - **Layer Panel**: rename the layer, description, and typed params
    (`int`/`float`/`bool`/`str`/`list`/`dict`/`any`, required or default).
    Renaming a param rewrites its `$`/`${…}` references and the param key on
    every node that uses the layer; renaming the layer updates all users.
  - Config panel for `custom` nodes: switch between **JSON layer** and
    **Python class**; layer nodes get a typed form of the declared params
    (required marked, defaults as placeholders, undeclared params flagged).
  - Layers with several Input nodes render named port handles (the Input
    node IDs), bound via `target_port` like core multi-input layers.
  - **Save library** downloads `{"custom_layers": …}` for
    `LayerRegistry.register_library()`; importing such a file merges its
    layers into the current model.
- **Validation** mirrors the backend's load-time checks: missing / unknown /
  mistyped layer params, port binding, undeclared `$` references, layer
  definition structure, layers using each other in a loop, at least one
  Input node. Layers not defined in the file are a warning (they may come
  from a Python `LayerRegistry`).
- **Editable node IDs** in the config panel (edges and the output follow).
- Text fields for layer params commit on Enter/blur, so values like `0.5` or
  `${dim * 4}` can be typed without being reparsed mid-keystroke.

### Changed

- Import accepts schema `1.0` and `1.1`; export writes `1.1` only when the
  model defines or uses JSON layers, otherwise `1.0`.
- Export, Validate and Ctrl+S work while a layer is open (the open edits are
  included). Undo history now also covers custom layer definitions.
- The palette's Python custom-layer entry is labeled **Python Class**.
- Import errors list Zod issue messages instead of raw JSON.

### Fixed

- **Fit-to-view after import / Tidy jumped to maximum zoom**: it ran before
  ReactFlow had measured the new nodes. It now waits for measurement.

## [1.0.0] — 2026-07-18

First public release, alongside [mlnode 1.0.0](https://github.com/Nasser-Obeid/MLnode) on PyPI.

### Added

- **Auto-layout on import** (`src/utils/autoLayout.ts`). Imported
  `.mlnode.json` graphs (which carry no positions) are arranged with a
  dependency-free layered layout: longest-path ranking → barycenter
  crossing-reduction sweeps → coordinate assignment using estimated node
  heights with neighbor-pull relaxation. Replaces the old 4-per-row grid.
- **"Tidy" toolbar button** (wand icon) — re-runs the auto-layout on the
  current graph at any time. Undoable (pushes history), and the viewport
  re-fits automatically after import/tidy (`fitViewNonce` in `uiStore` +
  `tidyLayout` action in `graphStore`).
- **`TransformerEncoder` / `TransformerDecoder` palette entries** with flat
  defaults matching the Python builders: layer params plus `num_layers` and
  `norm`. (They were previously commented out because nested
  `encoder_layer` params had no JSON representation.)
- **Named input handles for multi-input layers** (`INPUT_PORTS` in
  `src/types/mlnode.ts`, mirroring `MULTI_INPUT_LAYERS` in the Python
  backend): `Transformer` (src/tgt), `TransformerDecoder(-Layer)`
  (tgt/memory), `MultiheadAttention` (query/key/value), `Bilinear`
  (input1/input2). Each port renders as a labeled left-side handle; the
  handle id is exported as the edge's `target_port`.
- Import backfills `target_port` on unlabeled edges into multi-input nodes
  (declaration order — the same fallback the Python executor applies), so
  older files attach to the correct handles and round-trip cleanly.
- **`ReLU` palette entry** — it was missing from both the sidebar and
  `NODE_DEFAULTS` entirely.
- **Vision Ops category** with `PixelShuffle` / `PixelUnshuffle` (defaults
  `upscale_factor: 2` / `downscale_factor: 2`).
- `LazyBatchNorm1d/2d/3d` added to the Normalization palette.

### Changed

- `batch_first: true` added to the defaults of `RNN`, `LSTM`, `GRU`,
  `MultiheadAttention`, and the whole Transformer family — matching the
  `(B, Seq, D)` shape convention the backend validator assumes.
- `Transformer` defaults are now explicit (`d_model`, `nhead`,
  `num_encoder_layers`, `num_decoder_layers`, `dim_feedforward`, `dropout`,
  `batch_first`) instead of `{}`.
- `getNodeColor` covers the full transformer family and the vision ops.

### Fixed

- `custom` was missing from the ReactFlow node-type registry, so custom-layer
  nodes rendered as the unstyled default node instead of the MLnode card.

### Removed

- **`RNNBase`** from the palette, defaults, and node-type registry — removed
  from the Python backend as well (abstract base class without `forward()`).

### Docs

- **`QUICKSTART.md`** at the repo root — run the editor, draw a small MLP,
  export, and train it with the Python backend, in five minutes.
- **First `README.md`** — quick start, feature list, keyboard shortcuts,
  60-second tour, round-trip workflow with the Python backend, project
  structure.
- **New `docs/` directory**: `user-guide.md` (every UI surface: toolbar,
  palette, canvas, config panel, validation checks, import details) and
  `architecture.md` (state/data flow, RF ↔ MLnode field mapping, auto-layout
  phases, and the hand-synced contract tables shared with the Python
  backend).
