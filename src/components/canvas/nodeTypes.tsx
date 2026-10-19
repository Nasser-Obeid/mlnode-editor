/** Node component registry — renders each node type with handles and color coding. */

import React, { memo, useEffect } from 'react';
import { Handle, Position, NodeProps, useUpdateNodeInternals } from 'reactflow';
import type { RFNodeData } from '../../types/reactflow';
import { getNodeColor } from '../../constants/nodeCategories';
import { useGraphStore } from '../../stores/graphStore';
import { useUIStore } from '../../stores/uiStore';
import { getInputPorts } from '../../utils/customLayers';

const MLnodeNode = memo(({ id, data, type, selected }: NodeProps<RFNodeData>) => {
  const outputNodeId = useGraphStore((s) => s.settings.outputNodeId);
  const inputShape = useGraphStore((s) => s.settings.inputShape);
  const selectNode = useUIStore((s) => s.selectNode);
  const isOutput = id === outputNodeId;
  const isInput = type === 'Input';
  const color = getNodeColor(type ?? 'Linear');
  const hasOutputPorts = data.outputs && data.outputs.length > 0;
  const customLayers = useGraphStore((s) => s.customLayers);
  const inputPorts = getInputPorts(type, data, customLayers);
  const portRows = Math.max(inputPorts?.length ?? 0, data.outputs?.length ?? 0);

  // Handles change when a JSON layer's Input nodes change; tell ReactFlow to
  // re-measure them so edges attach to the new positions.
  const updateNodeInternals = useUpdateNodeInternals();
  const portKey = inputPorts?.join('|') ?? '';
  useEffect(() => updateNodeInternals(id), [id, portKey, updateNodeInternals]);

  return (
    <div
      onClick={() => selectNode(id)}
      className="relative group"
      style={{
        minWidth: 140,
        minHeight: portRows > 0 ? 34 + portRows * 24 : undefined,
        background: '#1a1a22',
        border: `2px solid ${selected ? '#fff' : isOutput ? '#facc15' : color}`,
        borderRadius: 10,
        boxShadow: selected
          ? `0 0 20px ${color}44`
          : '0 2px 8px rgba(0,0,0,0.4)',
        fontFamily: '"DM Sans", sans-serif',
      }}
    >
      {/* Category stripe */}
      <div
        style={{
          height: 4,
          borderRadius: '8px 8px 0 0',
          background: color,
        }}
      />

      {/* Body */}
      <div style={{ padding: '8px 12px' }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: color,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            marginBottom: 2,
          }}
        >
          {data.layer ? `◆ ${data.layer}` : type}
        </div>
        <div
          style={{
            fontSize: 12,
            color: '#a1a1aa',
            fontFamily: '"JetBrains Mono", monospace',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: 130,
          }}
        >
          {id}
        </div>

        {/* Input shape display */}
        {isInput && (
          <div
            style={{
              marginTop: 4,
              fontSize: 10,
              color: '#4ade80',
              fontFamily: '"JetBrains Mono", monospace',
            }}
          >
            ({inputShape.join(', ')})
          </div>
        )}

        {/* Param preview */}
        {!isInput && data.params && Object.keys(data.params).length > 0 && (
          <div style={{ marginTop: 4, fontSize: 10, color: '#71717a', lineHeight: 1.5 }}>
            {Object.entries(data.params)
              .slice(0, 3)
              .map(([k, v]) => (
                <div key={k}>
                  {k}: <span style={{ color: '#a1a1aa' }}>{JSON.stringify(v)}</span>
                </div>
              ))}
          </div>
        )}

        {/* Output badge */}
        {isOutput && (
          <div
            style={{
              marginTop: 4,
              fontSize: 9,
              fontWeight: 700,
              color: '#facc15',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            ⬤ OUTPUT
          </div>
        )}

        {/* Block badge */}
        {type === 'Block' && (
          <div style={{ marginTop: 4, fontSize: 9, fontWeight: 600, color: '#06b6d4' }}>
            {data.block_ref ? `↪ ${data.block_ref}` : '⊞ inline block'}
          </div>
        )}

        {/* Custom layer badges */}
        {type === 'custom' && !data.layer && (
          <div style={{ marginTop: 4, fontSize: 9, fontWeight: 600, color: '#94a3b8' }}>
            {data.path ? `py: ${data.path.split('.').pop()}` : 'no layer / path'}
          </div>
        )}
        {data.layer && !customLayers[data.layer] && (
          <div style={{ marginTop: 4, fontSize: 9, fontWeight: 600, color: '#f59e0b' }}>
            ↪ from LayerRegistry
          </div>
        )}

        {/* HF badge */}
        {data.hf_model && (
          <div style={{ marginTop: 4, fontSize: 9, fontWeight: 600, color: '#f97316' }}>
            🤗 {data.hf_model}
          </div>
        )}
      </div>

      {/* Input handles — multi-input layers get one named handle per port
          (the handle id becomes target_port in the exported JSON) */}
      {type !== 'Input' &&
        (inputPorts ? (
          inputPorts.map((port, i) => (
            <Handle
              key={port}
              type="target"
              position={Position.Left}
              id={port}
              style={{
                width: 10,
                height: 10,
                background: '#27272f',
                border: `2px solid ${color}`,
                borderRadius: '50%',
                top: 30 + i * 24,
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  left: 14,
                  top: -3,
                  fontSize: 9,
                  color: '#71717a',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                }}
              >
                {port}
              </span>
            </Handle>
          ))
        ) : (
          <Handle
            type="target"
            position={Position.Left}
            style={{
              width: 10,
              height: 10,
              background: '#27272f',
              border: `2px solid ${color}`,
              borderRadius: '50%',
            }}
          />
        ))}

      {/* Output handles */}
      {hasOutputPorts ? (
        data.outputs!.map((port, i) => (
          <Handle
            key={port}
            type="source"
            position={Position.Right}
            id={port}
            style={{
              width: 10,
              height: 10,
              background: '#27272f',
              border: `2px solid ${color}`,
              borderRadius: '50%',
              top: 30 + i * 24,
            }}
          >
            <span
              style={{
                position: 'absolute',
                right: 14,
                top: -3,
                fontSize: 9,
                color: '#71717a',
                whiteSpace: 'nowrap',
              }}
            >
              {port}
            </span>
          </Handle>
        ))
      ) : (
        <Handle
          type="source"
          position={Position.Right}
          style={{
            width: 10,
            height: 10,
            background: '#27272f',
            border: `2px solid ${color}`,
            borderRadius: '50%',
          }}
        />
      )}
    </div>
  );
});

MLnodeNode.displayName = 'MLnodeNode';

// Register all node types pointing to the same component.
// ReactFlow uses the `type` field on each node to look up the component.
const allTypes = [
  "Input",

    //#Convolution Layers
    "Conv1d", "Conv2d", "Conv3d",
    "ConvTranspose1d", "ConvTranspose2d", "ConvTranspose3d",
    "LazyConv1d", "LazyConv2d", "LazyConv3d",
    "LazyConvTranspose1d", "LazyConvTranspose2d", "LazyConvTranspose3d",
    "Unfold", "Fold",
    
    //# Pooling layers
    "MaxPool1d", "MaxPool2d", "MaxPool3d",
    "MaxUnpool1d", "MaxUnpool2d", "MaxUnpool3d",
    "AvgPool1d", "AvgPool2d", "AvgPool3d",
    "AdaptiveAvgPool1d", "AdaptiveAvgPool2d", "AdaptiveAvgPool3d",
    "FractionalMaxPool2d", "FractionalMaxPool3d",
    "LPPool1d", "LPPool2d", "LPPool3d",
    "AdaptiveMaxPool1d", "AdaptiveMaxPool2d", "AdaptiveMaxPool3d",
    "AdaptiveAvgPool1d", "AdaptiveAvgPool2d", "AdaptiveAvgPool3d",
    
    //# Non-linear Activations (weighted sum, nonlinearity)
    "ELU", "Hardshrink", "Hardsigmoid", "Hardtanh", "Hardswish",
    "LeakyReLU", "LogSigmoid", "PReLU", "ReLU6", "RReLU", "MultiheadAttention",
    "SELU", "CELU", "SiLU", "Mish", "Softplus", "Softshrink", "Softsign",
    "ReLU", "GELU", "Sigmoid", "Tanh",
    "Tanhshrink", "Threshold", "GLU",
    
    //# Non-linear Activations (other)
    "Softmin", "Softmax", "Softmax2d", "LogSoftmax", "AdaptiveLogSoftmaxWithLoss",
    
    //# Normalization Layers
    "BatchNorm1d", "BatchNorm2d", "BatchNorm3d",
    "LazyBatchNorm1d", "LazyBatchNorm2d", "LazyBatchNorm3d",
    "GroupNorm", "SyncBatchNorm",
    "InstanceNorm1d", "InstanceNorm2d", "InstanceNorm3d", 
    "LazyInstanceNorm1d", "LazyInstanceNorm2d", "LazyInstanceNorm3d",
    "LayerNorm", "LocalResponseNorm", "RMSNorm",
    
    //# Recurrent Layers (RNNBase removed — abstract base, not executable)
    "RNN", "LSTM", "GRU",
    "RNNCell", "LSTMCell", "GRUCell",
    
    //# Transformer Layers
    "Transformer", "TransformerEncoder", "TransformerDecoder",
    "TransformerEncoderLayer", "TransformerDecoderLayer",
    
    //# Linear
    "Identity", "Linear", "Bilinear", "LazyLinear",
    
    //# Dropout Layers
    "Dropout",
    "Dropout1d", "Dropout2d", "Dropout3d", 
    "AlphaDropout", "FeatureAlphaDropout",
    
    //# Sparse Layers
    "Embedding", "EmbeddingBag",

    //# Composable blocks
    "Block",
    //# Custom layers
    "custom",
    //# Reduction ops
    "Add", "Subtract", "Multiply", "Divide", "Concat", "Stack",
    //# Element wise ops
    "Add", "Subtract", "Multiply", "Divide", 
    "PixelShuffle", "PixelUnshuffle", 
    
    //# Tensor ops
    "Flatten", "Reshape", "Permute", "Transpose", "View",
    "Unsqueeze", "Squeeze", "Split", 
    //#
    //#to be added
    //#
    //#"ChannelShuffle",
    //#"Upsample", "UpsamplingNearest2d", "UpsamplingBilinear2d",
    //#
    //# Padding Layers
    //#"ReflectionPad1d", "ReflectionPad2d", "ReflectionPad3d",
    //#"ReplicationPad1d", "ReplicationPad2d", "ReplicationPad3d",
    //#"ZeroPad1d", "ZeroPad2d", "ZeroPad3d",
    //#"ConstantPad1d", "ConstantPad2d", "ConstantPad3d",
    //#"CircularPad1d", "CircularPad2d", "CircularPad3d",

];

export const nodeTypes: Record<string, React.ComponentType<any>> = {};
for (const t of allTypes) {
  nodeTypes[t] = MLnodeNode;
}
