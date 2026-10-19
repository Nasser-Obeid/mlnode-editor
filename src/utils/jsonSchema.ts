/** Zod schemas — mirrors the Python backend's Pydantic models exactly. */

import { z } from 'zod';
import { PARAM_TYPES, SUPPORTED_SCHEMA_VERSIONS, CUSTOM_LAYERS_SCHEMA_VERSION } from '../types/mlnode';

export const MLnodeBlockSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    input_node: z.string(),
    output_node: z.string(),
    nodes: z.array(MLnodeNodeSchema),
    edges: z.array(MLnodeEdgeSchema),
  })
);

export const MLnodeNodeSchema = z.object({
  id: z.string().min(1),
  type: z.string(),
  params: z.record(z.any()).default({}),
  shared_id: z.string().optional(),
  outputs: z.array(z.string()).optional(),
  reduction: z.enum(['concat', 'add', 'stack']).optional(),
  reduction_dim: z.number().optional(),
  hf_model: z.string().optional(),
  hf_config: z.string().optional(),
  path: z.string().optional(),
  layer: z.string().optional(),
  block: MLnodeBlockSchema.optional(),
  block_ref: z.string().optional(),
});

export const MLnodeEdgeSchema = z.object({
  source: z.string(),
  source_port: z.string().nullable().default(null),
  target: z.string(),
  target_port: z.string().nullable().default(null),
});

/** Python identifier rule for layer param names (expressions refer to them by name). */
export const PARAM_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Python keywords — not usable as param names (mirrors keyword.iskeyword). */
export const PYTHON_KEYWORDS = new Set([
  'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break',
  'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'finally', 'for',
  'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not', 'or',
  'pass', 'raise', 'return', 'try', 'while', 'with', 'yield',
]);

export const MLnodeParamSpecSchema = z.object({
  type: z.enum(PARAM_TYPES as [string, ...string[]]).default('any'),
  default: z.any().optional(),
  description: z.string().optional(),
});

/** Mirrors LayerDefinition (mlnode/schema/models.py), including its validators. */
export const MLnodeLayerSchema = z
  .object({
    description: z.string().optional(),
    params: z.record(MLnodeParamSpecSchema).default({}),
    nodes: z.array(MLnodeNodeSchema),
    edges: z.array(MLnodeEdgeSchema),
    output_node: z.string(),
  })
  .superRefine((layer, ctx) => {
    for (const name of Object.keys(layer.params)) {
      if (!PARAM_NAME_RE.test(name) || PYTHON_KEYWORDS.has(name)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Layer param name '${name}' must be a valid identifier (letters, digits, underscores; not a keyword).`,
        });
      }
    }
    const ids = layer.nodes.map((n) => n.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (dupes.length > 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate node IDs in layer: ${[...new Set(dupes)].join(', ')}` });
    }
    if (!layer.nodes.some((n) => n.type === 'Input')) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Layer must have at least one Input node.' });
    }
    if (!ids.includes(layer.output_node)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Layer output_node '${layer.output_node}' not found in layer nodes.` });
    }
    for (const e of layer.edges) {
      if (!ids.includes(e.source)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Layer edge source '${e.source}' not in layer nodes.` });
      }
      if (!ids.includes(e.target)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Layer edge target '${e.target}' not in layer nodes.` });
      }
    }
  });

export const MLnodeModelSchema = z
  .object({
    mlnode_schema_version: z.enum(SUPPORTED_SCHEMA_VERSIONS as unknown as [string, ...string[]]),
    metadata: z
      .object({
        name: z.string().optional(),
        description: z.string().optional(),
        author: z.string().optional(),
      })
      .optional(),
    input_shape: z.array(z.union([z.string(), z.number()])),
    output_node: z.string(),
    nodes: z.array(MLnodeNodeSchema),
    edges: z.array(MLnodeEdgeSchema),
    custom_layers: z.record(MLnodeLayerSchema).default({}),
  })
  .superRefine((model, ctx) => {
    if (
      Object.keys(model.custom_layers).length > 0 &&
      model.mlnode_schema_version !== CUSTOM_LAYERS_SCHEMA_VERSION
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `'custom_layers' requires mlnode_schema_version '${CUSTOM_LAYERS_SCHEMA_VERSION}' (found '${model.mlnode_schema_version}').`,
      });
    }
  });

/** A layer library file: {"custom_layers": {name: definition}} with no graph. */
export const MLnodeLayerLibrarySchema = z.object({
  custom_layers: z.record(MLnodeLayerSchema),
});

export type MLnodeModelParsed = z.infer<typeof MLnodeModelSchema>;
