/** Validation entry points used by the toolbar and keyboard shortcuts. */

import { useGraphStore } from '../stores/graphStore';
import { mergeResults, validateGraph, validateLayers, type ValidationResult } from './dagValidator';

type GraphState = ReturnType<typeof useGraphStore.getState>;

/** Validate what the canvas shows: the model, or the open layer's sub-graph. */
export function validateCurrentView(state: GraphState): ValidationResult {
  const layers = state.getDocumentLayers();
  const open = state.editStack[state.editStack.length - 1];
  if (!open) return validateDocument(state);
  return mergeResults(
    validateGraph(state.nodes, state.edges, state.settings.outputNodeId, {
      customLayers: layers,
      editingLayer: { name: open.layer, params: layers[open.layer]?.params ?? {} },
    }),
    validateLayers(layers, { skip: [open.layer] })
  );
}

/** Validate the whole document as it would be exported. */
export function validateDocument(state: GraphState): ValidationResult {
  const doc = state.getDocument();
  return mergeResults(
    validateGraph(doc.nodes, doc.edges, doc.settings.outputNodeId, { customLayers: doc.customLayers }),
    validateLayers(doc.customLayers)
  );
}
