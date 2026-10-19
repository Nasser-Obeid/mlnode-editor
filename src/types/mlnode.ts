/** MLnode JSON types — the exported format consumed by the Python backend. */

export type Dim = string | number;
export type Shape = Dim[];

export interface MLnodeMetadata {
  name?: string;
  description?: string;
  author?: string;
}

export interface MLnodeBlockDefinition {
  input_node: string;
  output_node: string;
  nodes: MLnodeNode[];
  edges: MLnodeEdge[];
}

export interface MLnodeNode {
  id: string;
  type: string;
  params: Record<string, any>;
  // Optional fields
  shared_id?: string;
  outputs?: string[];
  reduction?: 'concat' | 'add' | 'stack';
  reduction_dim?: number;
  // HuggingFace (top-level, NOT inside params)
  hf_model?: string;
  hf_config?: string;
  // Custom layer (top-level, NOT inside params): a Python class path, or the
  // name of a JSON layer definition (schema 1.1) — exactly one of the two.
  path?: string;
  layer?: string;
  // Block
  block?: MLnodeBlockDefinition;
  block_ref?: string;
}

export interface MLnodeEdge {
  source: string;
  source_port: string | null;
  target: string;
  target_port: string | null;
}

export type ParamType = 'int' | 'float' | 'bool' | 'str' | 'list' | 'dict' | 'any';

export const PARAM_TYPES: ParamType[] = ['int', 'float', 'bool', 'str', 'list', 'dict', 'any'];

/** A declared param of a JSON custom layer. No `default` key → required. */
export interface MLnodeParamSpec {
  type?: ParamType;
  default?: any;
  description?: string;
}

/**
 * A JSON custom layer (schema 1.1): a named, parameterized sub-graph.
 * Mirrors LayerDefinition in the Python backend (mlnode/schema/models.py).
 * Its Input nodes are its input ports, in declaration order.
 */
export interface MLnodeLayerDefinition {
  description?: string;
  params: Record<string, MLnodeParamSpec>;
  nodes: MLnodeNode[];
  edges: MLnodeEdge[];
  output_node: string;
}

export interface MLnodeModel {
  mlnode_schema_version: string;
  metadata?: MLnodeMetadata;
  input_shape: Dim[];
  output_node: string;
  nodes: MLnodeNode[];
  edges: MLnodeEdge[];
  custom_layers?: Record<string, MLnodeLayerDefinition>;
}

/** Schema versions the backend accepts; 1.1 adds custom_layers. */
export const SUPPORTED_SCHEMA_VERSIONS = ['1.0', '1.1'] as const;
export const CUSTOM_LAYERS_SCHEMA_VERSION = '1.1';

/** Reduction ops — implicit reduction, no `reduction` field allowed. */
export const REDUCTION_OPS = new Set([
  'Add', 'Subtract', 'Multiply', 'Divide', 'Concat', 'Stack',
]);

/** Elementwise ops — all input shapes must be identical. */
export const ELEMENTWISE_OPS = new Set([
  'Add', 'Subtract', 'Multiply', 'Divide',
]);

/** Tensor ops with no learnable parameters. */
export const TENSOR_OPS = new Set([
  'Flatten', 'Reshape', 'Permute', 'Transpose', 'View',
  'Unsqueeze', 'Squeeze', 'Split',
]);

/**
 * Layers whose forward() takes several positional tensor inputs.
 * Maps type → ordered input port names; mirrors MULTI_INPUT_LAYERS in the
 * Python backend (mlnode/schema/types.py). Edges into these nodes carry the
 * port name as target_port so the backend binds arguments correctly.
 */
export const INPUT_PORTS: Record<string, string[]> = {
  Transformer: ['src', 'tgt'],
  TransformerDecoder: ['tgt', 'memory'],
  TransformerDecoderLayer: ['tgt', 'memory'],
  MultiheadAttention: ['query', 'key', 'value'],
  Bilinear: ['input1', 'input2'],
};
