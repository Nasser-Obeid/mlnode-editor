/**
 * LayerPanel — settings of the JSON custom layer open on the canvas: name,
 * description, declared params, ports and usages. Shown when no node is
 * selected while editing a layer.
 */

import React from 'react';
import { CornerLeftUp, Plus, Trash2 } from 'lucide-react';
import { useGraphStore } from '../../stores/graphStore';
import { useUIStore } from '../../stores/uiStore';
import DraftInput from '../common/DraftInput';
import type { MLnodeParamSpec, ParamType } from '../../types/mlnode';
import { PARAM_TYPES } from '../../types/mlnode';
import { PARAM_NAME_RE, PYTHON_KEYWORDS } from '../../utils/jsonSchema';
import {
  formatParamValue,
  isRequired,
  layerUsages,
  matchesParamType,
  parseParamText,
} from '../../utils/customLayers';

const LAYER_COLOR = '#94a3b8';

const baseField =
  'px-2 py-1 rounded text-xs font-mono bg-canvas-bg border border-panel-border ' +
  'text-zinc-200 focus:border-accent focus:outline-none';
const fieldClass = `w-full ${baseField}`;

export default function LayerPanel() {
  const editStack = useGraphStore((s) => s.editStack);
  const customLayers = useGraphStore((s) => s.customLayers);
  const nodes = useGraphStore((s) => s.nodes);
  const outputNodeId = useGraphStore((s) => s.settings.outputNodeId);
  const updateLayerMeta = useGraphStore((s) => s.updateLayerMeta);
  const renameLayer = useGraphStore((s) => s.renameLayer);
  const renameLayerParam = useGraphStore((s) => s.renameLayerParam);
  const closeLayer = useGraphStore((s) => s.closeLayer);
  const addToast = useUIStore((s) => s.addToast);
  const selectNode = useUIStore((s) => s.selectNode);
  const requestFitView = useUIStore((s) => s.requestFitView);

  const frame = editStack[editStack.length - 1];
  const def = frame ? customLayers[frame.layer] : undefined;
  if (!frame || !def) return null;
  const name = frame.layer;
  const params = def.params;
  const ports = nodes.filter((n) => n.type === 'Input').map((n) => n.id);

  const mainNodes = editStack[0].parentNodes;
  const usages = layerUsages(name, mainNodes, useGraphStore.getState().getDocumentLayers());

  const setParams = (next: Record<string, MLnodeParamSpec>) => updateLayerMeta(name, { params: next });

  const updateSpec = (key: string, spec: MLnodeParamSpec) => setParams({ ...params, [key]: spec });

  const renameParam = (oldKey: string, raw: string) => {
    const key = raw.trim();
    if (key === oldKey) return;
    if (!PARAM_NAME_RE.test(key) || PYTHON_KEYWORDS.has(key)) {
      addToast(`"${key}" is not a valid param name (letters, digits, underscores; not a Python keyword).`, 'error');
      return;
    }
    if (key in params) {
      addToast(`Param "${key}" already exists.`, 'error');
      return;
    }
    const count = renameLayerParam(name, oldKey, key);
    if (count > 0) addToast(`Renamed param and updated ${count} reference(s) to "$${key}".`, 'success');
  };

  const removeParam = (key: string) => {
    const { [key]: _removed, ...rest } = params;
    setParams(rest);
  };

  const addParam = () => {
    let key = 'param';
    let i = 1;
    while (key in params) key = `param${++i}`;
    setParams({ ...params, [key]: { type: 'int' } });
  };

  const setRequired = (key: string, spec: MLnodeParamSpec, required: boolean) => {
    if (required) {
      const { default: _d, ...rest } = spec;
      updateSpec(key, rest);
    } else {
      updateSpec(key, { ...spec, default: null });
    }
  };

  const done = () => {
    closeLayer();
    selectNode(null);
    requestFitView();
  };

  return (
    <div className="w-72 h-full overflow-y-auto border-l border-panel-border bg-panel-bg">
      {/* Header */}
      <div className="px-4 py-3 border-b border-panel-border">
        <div className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: LAYER_COLOR }}>
          ◆ JSON Layer
        </div>
        <DraftInput
          value={name}
          onCommit={(text) => {
            const error = renameLayer(name, text);
            if (error) addToast(error, 'error');
          }}
          className={`${fieldClass} text-sm`}
          title="Layer name — renaming updates every node that uses it"
        />
        <DraftInput
          value={def.description ?? ''}
          onCommit={(text) => updateLayerMeta(name, { description: text })}
          placeholder="Description (optional)"
          className={`${fieldClass} mt-2 font-sans`}
        />
        <button
          onClick={done}
          className="mt-3 flex items-center gap-1.5 px-2 py-1 rounded text-xs bg-slate-600 text-white hover:bg-slate-500"
        >
          <CornerLeftUp size={12} />
          Done editing
        </button>
      </div>

      {/* Ports */}
      <div className="px-4 py-3 border-b border-panel-border text-xs">
        <div className="font-semibold text-zinc-500 uppercase tracking-wider mb-2">Ports</div>
        <div className="text-zinc-400">
          <span className="text-zinc-500">inputs:</span>{' '}
          {ports.length > 0 ? (
            ports.map((p) => (
              <span key={p} className="font-mono text-green-400 mr-1.5">{p}</span>
            ))
          ) : (
            <span className="text-red-400">none — add an Input node</span>
          )}
        </div>
        <div className="text-zinc-400 mt-1">
          <span className="text-zinc-500">output:</span>{' '}
          {outputNodeId ? (
            <span className="font-mono text-yellow-400">{outputNodeId}</span>
          ) : (
            <span className="text-red-400">none — right-click a node</span>
          )}
        </div>
        <p className="text-zinc-500 mt-2 leading-relaxed">
          Each Input node is a port; its node ID is the port name. With several ports, edges into
          this layer bind by port.
        </p>
      </div>

      {/* Params */}
      <div className="px-4 py-3 border-b border-panel-border">
        <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Params</div>
        <p className="text-xs text-zinc-500 mb-3 leading-relaxed">
          Use them in node parameters as <code className="text-zinc-300">$name</code> or{' '}
          <code className="text-zinc-300">{'${expr}'}</code>, e.g.{' '}
          <code className="text-zinc-300">{'${dim * 4}'}</code>.
        </p>

        {Object.entries(params).map(([key, spec]) => {
          const required = isRequired(spec);
          const badDefault =
            !required && spec.default !== null && !matchesParamType(spec.type, spec.default);
          return (
            <div key={key} className="mb-3 p-2 rounded border border-panel-border bg-canvas-bg/40">
              <div className="flex gap-1.5 items-center">
                <DraftInput
                  value={key}
                  onCommit={(text) => renameParam(key, text)}
                  className={`${baseField} min-w-0 flex-1`}
                  title="Param name"
                />
                <select
                  value={spec.type ?? 'any'}
                  onChange={(e) => updateSpec(key, { ...spec, type: e.target.value as ParamType })}
                  className={`${baseField} w-20 flex-shrink-0`}
                  title="Param type"
                >
                  {PARAM_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <button
                  onClick={() => removeParam(key)}
                  className="text-zinc-500 hover:text-red-400 flex-shrink-0"
                  title="Remove param"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <label className="flex items-center gap-1.5 mt-2 text-xs text-zinc-400">
                <input
                  type="checkbox"
                  checked={required}
                  onChange={(e) => setRequired(key, spec, e.target.checked)}
                />
                required
              </label>
              {!required && (
                <DraftInput
                  value={spec.default === null ? '' : formatParamValue(spec.default)}
                  onCommit={(text) =>
                    updateSpec(key, { ...spec, default: text.trim() === '' ? null : parseParamText(text, spec.type) })
                  }
                  placeholder="default (empty = null)"
                  className={`${fieldClass} mt-1.5 ${badDefault ? 'border-red-500' : ''}`}
                  title={badDefault ? `Default does not match type ${spec.type}` : 'Default value'}
                />
              )}
              <DraftInput
                value={spec.description ?? ''}
                onCommit={(text) => {
                  const { description: _d, ...rest } = spec;
                  updateSpec(key, text.trim() ? { ...rest, description: text } : rest);
                }}
                placeholder="description (optional)"
                className={`${fieldClass} mt-1.5 font-sans`}
              />
            </div>
          );
        })}

        <button
          onClick={addParam}
          className="flex items-center gap-1 text-xs text-accent hover:text-accent-light transition-colors"
        >
          <Plus size={12} />
          Add param
        </button>
      </div>

      {/* Usages */}
      <div className="px-4 py-3 text-xs">
        <div className="font-semibold text-zinc-500 uppercase tracking-wider mb-2">Used by</div>
        {usages.length > 0 ? (
          <div className="font-mono text-zinc-400 leading-relaxed">{usages.join(', ')}</div>
        ) : (
          <div className="text-zinc-500">Not used yet — drag it from the library onto the model.</div>
        )}
      </div>
    </div>
  );
}
