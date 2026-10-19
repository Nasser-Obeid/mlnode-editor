/** ReactFlow internal types used by the editor. */

import type { Node, Edge } from 'reactflow';
import type { MLnodeBlockDefinition } from './mlnode';

export interface RFNodeData {
  label: string;
  params: Record<string, any>;
  shared_id?: string;
  outputs?: string[];
  reduction?: 'concat' | 'add' | 'stack';
  reduction_dim?: number;
  hf_model?: string;
  hf_config?: string;
  path?: string;
  layer?: string;
  block?: MLnodeBlockDefinition;
  block_ref?: string;
}

export type RFNode = Node<RFNodeData>;
export type RFEdge = Edge;

export interface ModelSettings {
  metadata: { name?: string; description?: string; author?: string };
  inputShape: (string | number)[];
  outputNodeId: string;
}
