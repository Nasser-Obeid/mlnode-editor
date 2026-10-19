/** App — root component composing toolbar, sidebar, canvas, config panel. */

import React, { useCallback, useEffect } from 'react';
import TopToolbar from './components/toolbar/TopToolbar';
import NodeLibrary from './components/sidebar/NodeLibrary';
import ModelCanvas from './components/canvas/ModelCanvas';
import NodeConfigPanel from './components/sidebar/NodeConfigPanel';
import LayerPanel from './components/sidebar/LayerPanel';
import Toasts from './components/dialogs/Toasts';
import { useUIStore } from './stores/uiStore';
import { useGraphStore } from './stores/graphStore';
import { exportMLnode } from './utils/exportImport';
import { downloadText } from './utils/download';

export default function App() {
  const selectedNodeId = useUIStore((s) => s.selectedNodeId);
  const addToast = useUIStore((s) => s.addToast);
  const editingLayer = useGraphStore((s) => s.editStack.length > 0);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        // Save without validating, so work in progress can be kept. Includes
        // all custom layers, even while one is open for editing.
        e.preventDefault();
        const doc = useGraphStore.getState().getDocument();
        const json = exportMLnode(doc.nodes, doc.edges, doc.settings, doc.customLayers);
        downloadText(`${doc.settings.metadata.name || 'model'}.mlnode.json`, json);
        addToast('Saved', 'success');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [addToast]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden" style={{ background: '#0e0e12' }}>
      <TopToolbar />
      <div className="flex flex-1 overflow-hidden">
        <NodeLibrary />
        <ModelCanvas />
        {selectedNodeId ? <NodeConfigPanel /> : editingLayer ? <LayerPanel /> : null}
      </div>
      <Toasts />
    </div>
  );
}
