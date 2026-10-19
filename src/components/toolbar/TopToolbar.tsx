/** TopToolbar — export, import, validate, model settings, layer breadcrumb. */

import React, { useRef } from 'react';
import { Download, Upload, ShieldCheck, Undo2, Redo2, Wand2, ChevronRight, CornerLeftUp } from 'lucide-react';
import { useGraphStore } from '../../stores/graphStore';
import { useUIStore } from '../../stores/uiStore';
import { exportMLnode, importMLnode } from '../../utils/exportImport';
import { validateCurrentView, validateDocument } from '../../utils/documentValidation';
import { downloadText } from '../../utils/download';

/** Validate the whole document, then download it. Shared with Ctrl+S. */
export function exportDocument(addToast: (m: string, t?: 'info' | 'error' | 'success') => void): boolean {
  const state = useGraphStore.getState();
  const result = validateDocument(state);
  if (!result.valid) {
    result.errors.forEach((e) => addToast(e.message, 'error'));
    return false;
  }
  result.warnings.forEach((w) => addToast(w.message, 'info'));
  const doc = state.getDocument();
  const json = exportMLnode(doc.nodes, doc.edges, doc.settings, doc.customLayers);
  downloadText(`${doc.settings.metadata.name || 'model'}.mlnode.json`, json);
  addToast('Exported successfully', 'success');
  return true;
}

export default function TopToolbar() {
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const settings = useGraphStore((s) => s.settings);
  const editStack = useGraphStore((s) => s.editStack);
  const setSettings = useGraphStore((s) => s.setSettings);
  const setGraph = useGraphStore((s) => s.setGraph);
  const mergeLayers = useGraphStore((s) => s.mergeLayers);
  const closeLayer = useGraphStore((s) => s.closeLayer);
  const tidyLayout = useGraphStore((s) => s.tidyLayout);
  const undo = useGraphStore((s) => s.undo);
  const redo = useGraphStore((s) => s.redo);
  const addToast = useUIStore((s) => s.addToast);
  const selectNode = useUIStore((s) => s.selectNode);
  const requestFitView = useUIStore((s) => s.requestFitView);
  const fileRef = useRef<HTMLInputElement>(null);
  const editing = editStack.length > 0;

  const handleImport = () => {
    fileRef.current?.click();
  };

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const result = importMLnode(ev.target?.result as string);
        if (result.kind === 'library') {
          const { added, skipped } = mergeLayers(result.customLayers);
          if (added.length > 0) addToast(`Added layer(s): ${added.join(', ')}`, 'success');
          if (skipped.length > 0) addToast(`Skipped existing layer(s): ${skipped.join(', ')}`, 'info');
          if (added.length === 0 && skipped.length === 0) addToast('The library has no layers', 'info');
          return;
        }
        setGraph(result.nodes, result.edges, result.settings, result.customLayers);
        selectNode(null);
        requestFitView();
        addToast('Imported successfully', 'success');
      } catch (err: any) {
        addToast(`Import failed: ${formatError(err)}`, 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleTidy = () => {
    tidyLayout();
    requestFitView();
    addToast('Layout tidied', 'success');
  };

  const handleValidate = () => {
    const result = validateCurrentView(useGraphStore.getState());
    if (result.valid) {
      const what = editing ? `Layer ${editStack[editStack.length - 1].layer}` : 'Graph';
      addToast(`${what} is valid (${nodes.length} nodes, ${edges.length} edges)`, 'success');
    } else {
      result.errors.forEach((e) => addToast(e.message, 'error'));
    }
    result.warnings.forEach((w) => addToast(w.message, 'info'));
  };

  /** Close layers until `depth` frames remain (0 = back to the model). */
  const closeTo = (depth: number) => {
    while (useGraphStore.getState().editStack.length > depth) closeLayer();
    selectNode(null);
    requestFitView();
  };

  return (
    <div
      className="flex items-center gap-2 px-4 py-2 border-b border-panel-border bg-panel-bg"
      style={{ height: 48 }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 mr-4">
        <div
          className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold"
          style={{ background: '#6d5cff', color: '#fff' }}
        >
          M
        </div>
        <span className="text-sm font-semibold text-zinc-200 tracking-wide">MLnode</span>
      </div>

      {editing ? (
        /* Breadcrumb while editing a JSON layer */
        <div className="flex items-center gap-1 text-sm min-w-0">
          <button
            onClick={() => closeTo(0)}
            className="text-zinc-400 hover:text-zinc-200 truncate max-w-[10rem]"
            title="Back to the model"
          >
            {settings.metadata.name || 'Model'}
          </button>
          {editStack.map((frame, i) => (
            <React.Fragment key={frame.layer}>
              <ChevronRight size={14} className="text-zinc-600 flex-shrink-0" />
              <button
                onClick={() => closeTo(i + 1)}
                className={`truncate max-w-[10rem] ${
                  i === editStack.length - 1 ? 'text-slate-200 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title={`Layer ${frame.layer}`}
              >
                ◆ {frame.layer}
              </button>
            </React.Fragment>
          ))}
          <button
            onClick={() => closeTo(editStack.length - 1)}
            className="ml-2 flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-600 text-white hover:bg-slate-500"
            title="Save the layer and go back up"
          >
            <CornerLeftUp size={12} />
            Done
          </button>
        </div>
      ) : (
        <>
          {/* Model name */}
          <input
            type="text"
            value={settings.metadata.name ?? ''}
            onChange={(e) => setSettings({ metadata: { ...settings.metadata, name: e.target.value } })}
            className="px-2 py-0.5 rounded text-sm bg-transparent border border-transparent
                       hover:border-panel-border focus:border-accent text-zinc-300 focus:outline-none
                       transition-colors w-44 font-medium"
            placeholder="Model name"
          />

          {/* Input shape */}
          <div className="flex items-center gap-1.5 ml-2 px-2 py-0.5 rounded border border-panel-border bg-canvas-bg">
            <span className="text-xs text-green-400 font-semibold">shape</span>
            <input
              type="text"
              value={JSON.stringify(settings.inputShape)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  if (Array.isArray(parsed)) setSettings({ inputShape: parsed });
                } catch {}
              }}
              className="px-1 py-0 rounded text-xs font-mono bg-transparent border-none
                         text-zinc-300 focus:outline-none w-36"
              title="Edit input shape — click an Input node for a detailed editor"
            />
          </div>
        </>
      )}

      <div className="flex-1" />

      {/* Undo/Redo */}
      <ToolbarButton icon={<Undo2 size={14} />} label="Undo" onClick={undo} />
      <ToolbarButton icon={<Redo2 size={14} />} label="Redo" onClick={redo} />

      <div className="w-px h-5 bg-panel-border mx-1" />

      {/* Actions */}
      <ToolbarButton icon={<Wand2 size={14} />} label="Tidy" onClick={handleTidy} />
      <ToolbarButton icon={<ShieldCheck size={14} />} label="Validate" onClick={handleValidate} />
      <ToolbarButton icon={<Upload size={14} />} label="Import" onClick={handleImport} />
      <ToolbarButton icon={<Download size={14} />} label="Export" onClick={() => exportDocument(addToast)} accent />

      <input ref={fileRef} type="file" accept=".json,.mlnode.json" onChange={onFileSelected} className="hidden" />
    </div>
  );
}

/** Zod errors carry a JSON list of issues; show their messages instead. */
function formatError(err: any): string {
  if (Array.isArray(err?.issues)) {
    return err.issues
      .map((i: any) => (i.path?.length ? `${i.path.join('.')}: ${i.message}` : i.message))
      .join('; ');
  }
  return err?.message ?? String(err);
}

function ToolbarButton({
  icon,
  label,
  onClick,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
        accent
          ? 'bg-accent text-white hover:bg-accent-light'
          : 'bg-panel-hover text-zinc-400 hover:text-zinc-200'
      }`}
      title={label}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
