/** NodeLibrary — draggable sidebar palette grouped by category. */

import React, { useState, DragEvent } from 'react';
import { ChevronRight, ChevronDown, Pencil, Trash2, Plus, Group, Download } from 'lucide-react';
import { NODE_CATEGORIES, type NodeCategory } from '../../constants/nodeCategories';
import { useGraphStore } from '../../stores/graphStore';
import { useUIStore } from '../../stores/uiStore';
import { newLayerTemplate, uniqueLayerName } from '../../utils/customLayers';
import { exportLayerLibrary } from '../../utils/exportImport';
import { downloadText } from '../../utils/download';

const LAYER_COLOR = '#94a3b8';

export default function NodeLibrary() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    'I/O': true,
    'Linear & Conv': true,
    'Activation': true,
  });

  const toggle = (name: string) => {
    setExpanded((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const onDragStart = (e: DragEvent, type: string) => {
    e.dataTransfer.setData('application/mlnode-type', type);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="w-52 h-full overflow-y-auto border-r border-panel-border bg-panel-bg select-none">
      <div className="px-3 py-3">
        <h2
          className="text-xs font-semibold tracking-widest uppercase"
          style={{ color: '#71717a' }}
        >
          Node Library
        </h2>
      </div>

      <CustomLayersGroup
        isExpanded={expanded['Custom Layers'] ?? true}
        onToggle={() => toggle('Custom Layers')}
      />

      {NODE_CATEGORIES.map((cat) => (
        <CategoryGroup
          key={cat.name}
          category={cat}
          isExpanded={expanded[cat.name] ?? false}
          onToggle={() => toggle(cat.name)}
          onDragStart={onDragStart}
        />
      ))}
    </div>
  );
}

/** The document's JSON custom layers: drag to use, pencil to edit. */
function CustomLayersGroup({ isExpanded, onToggle }: { isExpanded: boolean; onToggle: () => void }) {
  const customLayers = useGraphStore((s) => s.customLayers);
  const editStack = useGraphStore((s) => s.editStack);
  const addLayer = useGraphStore((s) => s.addLayer);
  const deleteLayer = useGraphStore((s) => s.deleteLayer);
  const openLayer = useGraphStore((s) => s.openLayer);
  const createLayerFromSelection = useGraphStore((s) => s.createLayerFromSelection);
  const getDocumentLayers = useGraphStore((s) => s.getDocumentLayers);
  const addToast = useUIStore((s) => s.addToast);
  const selectNode = useUIStore((s) => s.selectNode);
  const requestFitView = useUIStore((s) => s.requestFitView);
  const names = Object.keys(customLayers);
  const openNames = new Set(editStack.map((f) => f.layer));

  const report = (error: string | null, success?: string) => {
    if (error) addToast(error, 'error');
    else if (success) addToast(success, 'success');
  };

  const open = (name: string) => {
    const error = openLayer(name);
    report(error);
    if (!error) {
      selectNode(null);
      requestFitView();
    }
  };

  const askName = (suggestion: string): string | null => {
    const name = prompt('Layer name:', uniqueLayerName(suggestion, customLayers))?.trim();
    if (!name) return null;
    if (customLayers[name]) {
      addToast(`A layer "${name}" already exists.`, 'error');
      return null;
    }
    return name;
  };

  const handleNew = () => {
    const name = askName('MyLayer');
    if (!name) return;
    addLayer(name, newLayerTemplate());
    open(name);
  };

  const handleFromSelection = () => {
    const name = askName('MyLayer');
    if (!name) return;
    report(createLayerFromSelection(name), `Created layer ${name} from the selection`);
    selectNode(null);
  };

  const handleExport = () => {
    downloadText('layers.json', exportLayerLibrary(getDocumentLayers()));
    addToast('Exported layer library — load it with LayerRegistry.register_library()', 'success');
  };

  return (
    <div className="mb-2 pb-1 border-b border-panel-border">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-1 px-3 py-1.5 text-xs font-medium hover:bg-panel-hover transition-colors"
        style={{ color: LAYER_COLOR }}
      >
        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        ◆ Custom Layers
        <span className="ml-auto text-zinc-600">{names.length || ''}</span>
      </button>

      {isExpanded && (
        <div className="pl-4 pr-2 pb-1">
          {names.map((name) => (
            <div
              key={name}
              draggable={!openNames.has(name)}
              onDragStart={(e) => {
                e.dataTransfer.setData('application/mlnode-layer', name);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDoubleClick={() => open(name)}
              className={`group flex items-center gap-2 px-2 py-1 rounded text-xs hover:bg-panel-hover transition-colors ${
                openNames.has(name) ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
              }`}
              style={{ color: openNames.has(name) ? LAYER_COLOR : '#d4d4d8' }}
              title={customLayers[name].description || 'Drag onto the canvas; double-click to edit'}
            >
              <span className="w-2 h-2 rotate-45 flex-shrink-0" style={{ background: LAYER_COLOR }} />
              <span className="truncate flex-1">{name}</span>
              <button
                onClick={() => open(name)}
                className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-zinc-200"
                title="Edit layer"
              >
                <Pencil size={11} />
              </button>
              <button
                onClick={() => report(deleteLayer(name), `Deleted layer ${name}`)}
                className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400"
                title="Delete layer"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
          {names.length === 0 && (
            <p className="px-2 py-1 text-xs text-zinc-500 leading-relaxed">
              Reusable layers defined in JSON. Create one, or select nodes and group them.
            </p>
          )}
          <div className="flex flex-wrap gap-x-3 gap-y-1 px-2 pt-1.5">
            <LibraryAction icon={<Plus size={11} />} label="New" onClick={handleNew} />
            <LibraryAction icon={<Group size={11} />} label="From selection" onClick={handleFromSelection} />
            {names.length > 0 && (
              <LibraryAction icon={<Download size={11} />} label="Save library" onClick={handleExport} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function LibraryAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 text-xs text-accent hover:text-accent-light transition-colors"
    >
      {icon}
      {label}
    </button>
  );
}

function CategoryGroup({
  category,
  isExpanded,
  onToggle,
  onDragStart,
}: {
  category: NodeCategory;
  isExpanded: boolean;
  onToggle: () => void;
  onDragStart: (e: DragEvent, type: string) => void;
}) {
  return (
    <div className="mb-1">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-1 px-3 py-1.5 text-xs font-medium hover:bg-panel-hover transition-colors"
        style={{ color: category.color }}
      >
        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {category.name}
      </button>

      {isExpanded && (
        <div className="pl-4 pr-2 pb-1">
          {category.types.map(({ type, label }) => (
            <div
              key={type}
              draggable
              onDragStart={(e) => onDragStart(e, type)}
              className="flex items-center gap-2 px-2 py-1 rounded cursor-grab text-xs
                         hover:bg-panel-hover active:cursor-grabbing transition-colors"
              style={{ color: '#d4d4d8' }}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: category.color }}
              />
              {label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
