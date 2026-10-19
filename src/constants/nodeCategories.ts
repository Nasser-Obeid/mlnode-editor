/** Node categories for the sidebar palette. */

export interface NodeCategory {
  name: string;
  color: string;
  types: { type: string; label: string }[];
}

export const NODE_CATEGORIES: NodeCategory[] = [
  {
    name: 'I/O',
    color: '#22c55e',
    types: [{ type: 'Input', label: 'Input' }],
  },
  {
    name: 'Convolution Layers',
    color: '#3b82f6',
    types: [
      { type: 'Conv1d', label: 'Conv1d' },
      { type: 'Conv2d', label: 'Conv2d' },
      { type: 'Conv3d', label: 'Conv3d' },
      { type: 'ConvTranspose1d', label: 'ConvTranspose1d' },
      { type: 'ConvTranspose2d', label: 'ConvTranspose2d' },
      { type: 'ConvTranspose3d', label: 'ConvTranspose3d' },
      { type: 'LazyConv1d', label: 'LazyConv1d' },
      { type: 'LazyConv2d', label: 'LazyConv2d' },
      { type: 'LazyConv3d', label: 'LazyConv3d' },
      { type: 'LazyConvTranspose1d', label: 'LazyConvTranspose1d' },
      { type: 'LazyConvTranspose2d', label: 'LazyConvTranspose2d' },
      { type: 'LazyConvTranspose3d', label: 'LazyConvTranspose3d' },
      { type: 'Unfold', label: 'Unfold' },
      { type: 'Fold', label: 'Fold' },
    ],
  },
  {
    name: 'Pooling Layers',
    color: '#e4c519',
    types: [
      { type: 'MaxPool1d', label: 'MaxPool1d' },
      { type: 'MaxPool2d', label: 'MaxPool2d' },
      { type: 'MaxPool3d', label: 'MaxPool3d' },
      { type: 'MaxUnpool1d', label: 'MaxUnpool1d' },
      { type: 'MaxUnpool2d', label: 'MaxUnpool2d' },
      { type: 'MaxUnpool3d', label: 'MaxUnpool3d' },
      { type: 'AvgPool1d', label: 'AvgPool1d' },
      { type: 'AvgPool2d', label: 'AvgPool2d' },
      { type: 'AvgPool3d', label: 'AvgPool3d' },
       { type: 'FractionalMaxPool2d', label: 'FractionalMaxPool2d' },
      { type: 'FractionalMaxPool3d', label: 'FractionalMaxPool3d' },
      { type: 'LPPool1d', label: 'LPPool1d' },
      { type: 'LPPool2d', label: 'LPPool2d' },
      { type: 'LPPool3d', label: 'LPPool3d' },
      { type: 'AdaptiveMaxPool1d', label: 'AdaptiveMaxPool1d' },
      { type: 'AdaptiveMaxPool2d', label: 'AdaptiveMaxPool2d' },
      { type: 'AdaptiveMaxPool3d', label: 'AdaptiveMaxPool3d' },
      { type: 'AdaptiveAvgPool1d', label: 'AdaptiveAvgPool1d' },
      { type: 'AdaptiveAvgPool2d', label: 'AdaptiveAvgPool2d' },
      { type: 'AdaptiveAvgPool3d', label: 'AdaptiveAvgPool3d' },
    ],
  },
  {
    name: 'Non-linear Activations (weighted sum, nonlinearity)',
    color: '#7f12fc',
    types: [
      { type: 'ELU', label: 'ELU' },
      { type: 'Hardshrink', label: 'Hardshrink' },
      { type: 'Hardsigmoid', label: 'Hardsigmoid' },
      { type: 'Hardtanh', label: 'Hardtanh' },
      { type: 'Hardswish', label: 'Hardswish' },
      { type: 'LeakyReLU', label: 'LeakyReLU' },
      { type: 'LogSigmoid', label: 'LogSigmoid' },
      { type: 'PReLU', label: 'PReLU' },
      { type: 'ReLU6', label: 'ReLU6' },
      { type: 'RReLU', label: 'RReLU' },
      { type: 'MultiheadAttention', label: 'MultiheadAttention' },
      { type: 'SELU', label: 'SELU' },
      { type: 'CELU', label: 'CELU' },
      { type: 'SiLU', label: 'SiLU' },
      { type: 'Mish', label: 'Mish' },
      { type: 'Softplus', label: 'Softplus' },
      { type: 'Softshrink', label: 'Softshrink' },
      { type: 'Softsign', label: 'Softsign' },
      { type: 'ReLU', label: 'ReLU' },
      { type: 'GELU', label: 'GELU' },
      { type: 'Sigmoid', label: 'Sigmoid' },
      { type: 'Tanh', label: 'Tanh' },
      { type: 'Tanhshrink', label: 'Tanhshrink' },
      { type: 'Threshold', label: 'Threshold' },
      { type: 'GLU', label: 'GLU' },
    ],
  },
  {
    name: 'Non-linear Activations (other)',
    color: '#e41eeb',
    types: [
      { type: 'Softmin', label: 'Softmin' },
      { type: 'Softmax', label: 'Softmax' },
      { type: 'Softmax2d', label: 'Softmax2d' },
      { type: 'LogSoftmax', label: 'LogSoftmax' },
      { type: 'AdaptiveLogSoftmaxWithLoss', label: 'AdaptiveLogSoftmaxWithLoss' },
    ],
  },
  {
    name: 'Normalization Layers',
    color: '#000296',
    types: [
      { type: 'BatchNorm1d', label: 'BatchNorm1d' },
      { type: 'BatchNorm2d', label: 'BatchNorm2d' },
      { type: 'BatchNorm3d', label: 'BatchNorm3d' },
      { type: 'LazyBatchNorm1d', label: 'LazyBatchNorm1d' },
      { type: 'LazyBatchNorm2d', label: 'LazyBatchNorm2d' },
      { type: 'LazyBatchNorm3d', label: 'LazyBatchNorm3d' },
      { type: 'LayerNorm', label: 'LayerNorm' },
      { type: 'GroupNorm', label: 'GroupNorm' },
      { type: 'SyncBatchNorm', label: 'SyncBatchNorm' },
      { type: 'InstanceNorm1d', label: 'InstanceNorm1d' },
      { type: 'InstanceNorm2d', label: 'InstanceNorm2d' },
      { type: 'InstanceNorm3d', label: 'InstanceNorm3d' },
      { type: 'LazyInstanceNorm1d', label: 'LazyInstanceNorm1d' },
      { type: 'LazyInstanceNorm2d', label: 'LazyInstanceNorm2d' },
      { type: 'LazyInstanceNorm3d', label: 'LazyInstanceNorm3d' },
      { type: 'LocalResponseNorm', label: 'LocalResponseNorm' },
      { type: 'RMSNorm', label: 'RMSNorm' },
    ],
  },
  {
    name: 'Recurrent Layers',
    color: '#103e88',
    types: [
      { type: 'RNN', label: 'RNN' },
      { type: 'LSTM', label: 'LSTM' },
      { type: 'GRU', label: 'GRU' },
      { type: 'RNNCell', label: 'RNNCell' },
      { type: 'LSTMCell', label: 'LSTMCell' },
      { type: 'GRUCell', label: 'GRUCell' },
    ],
  },
  {
    name: 'Transformer Layers',
    color: '#fcb232',
    types: [
      { type: 'Transformer', label: 'Transformer' },
      { type: 'TransformerEncoder', label: 'TransformerEncoder' },
      { type: 'TransformerDecoder', label: 'TransformerDecoder' },
      { type: 'TransformerEncoderLayer', label: 'TransformerEncoderLayer' },
      { type: 'TransformerDecoderLayer', label: 'TransformerDecoderLayer' },
    ],
  },
  {
    name: 'Linear',
    color: '#cf5218',
    types: [
      { type: 'Identity', label: 'Identity' },
      { type: 'Linear', label: 'Linear' },
      { type: 'Bilinear', label: 'Bilinear' },
      { type: 'LazyLinear', label: 'LazyLinear' },
    ],
  },
  {
    name: 'Dropout Layers',
    color: '#ff7b00',
    types: [
      { type: 'Dropout', label: 'Dropout' },
      { type: 'Dropout1d', label: 'Dropout1d' },
      { type: 'Dropout2d', label: 'Dropout2d' },
      { type: 'Dropout3d', label: 'Dropout3d' },
      { type: 'AlphaDropout', label: 'AlphaDropout' },
      { type: 'FeatureAlphaDropout', label: 'FeatureAlphaDropout' },
    ],
  },
  {
    name: 'Sparse Layers',
    color: '#ff7b00',
    types: [
      { type: 'Embedding', label: 'Embedding' },
      { type: 'EmbeddingBag', label: 'EmbeddingBag' },
    ],
  },
  {
    name: 'Vision Ops',
    color: '#14b8a6',
    types: [
      { type: 'PixelShuffle', label: 'PixelShuffle' },
      { type: 'PixelUnshuffle', label: 'PixelUnshuffle' },
    ],
  },
  {
    name: 'Reduction Ops',
    color: '#ec4899',
    types: [
      { type: 'Add', label: 'Add' },
      { type: 'Subtract', label: 'Subtract' },
      { type: 'Multiply', label: 'Multiply' },
      { type: 'Divide', label: 'Divide' },
      { type: 'Concat', label: 'Concat' },
      { type: 'Stack', label: 'Stack' },
    ],
  },
  {
    name: 'Tensor Ops',
    color: '#8b5cf6',
    types: [
      { type: 'Flatten', label: 'Flatten' },
      { type: 'Reshape', label: 'Reshape' },
      { type: 'Permute', label: 'Permute' },
      { type: 'Transpose', label: 'Transpose' },
      { type: 'View', label: 'View' },
      { type: 'Squeeze', label: 'Squeeze' },
      { type: 'Unsqueeze', label: 'Unsqueeze' },
      { type: 'Split', label: 'Split' },
    ],
  },
  //{
  //  name: 'HuggingFace',
  //  color: '#f97316',
  //  types: [
  //    { type: 'HF_Pretrained', label: '🤗 Pretrained' },
  //    { type: 'HF_Config', label: '🤗 From Config' },
  //  ],
  //},
  {
    name: 'Block',
    color: '#06b6d4',
    types: [{ type: 'Block', label: 'Block' }],
  },
  {
    name: 'Custom',
    color: '#64748b',
    types: [{ type: 'custom', label: 'Python Class' }],
  },
];

export function getNodeColor(type: string): string {
  if (type === 'Input') return '#22c55e';
  if (type === 'Block') return '#06b6d4';
  if (type === 'custom') return '#64748b';
  if (type === 'HF_Pretrained' || type === 'HF_Config') return '#f97316';
  if ([
    'MultiheadAttention', 'Transformer', 'TransformerEncoder', 'TransformerDecoder',
    'TransformerEncoderLayer', 'TransformerDecoderLayer',
  ].includes(type)) return '#f59e0b';
  if (['PixelShuffle', 'PixelUnshuffle'].includes(type)) return '#14b8a6';
  if (['Add', 'Subtract', 'Multiply', 'Divide', 'Concat', 'Stack'].includes(type)) return '#ec4899';
  if (['Flatten', 'Reshape', 'Permute', 'Transpose', 'View', 'Unsqueeze', 'Squeeze', 'Split'].includes(type)) return '#8b5cf6';
  return '#3b82f6';
}
