/** ModelCanvas — the main ReactFlow wrapper with keyboard shortcuts. */

import React, { useCallback, useEffect, useRef, DragEvent } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  ReactFlowInstance,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { nodeTypes } from './nodeTypes';
import { useGraphStore } from '../../stores/graphStore';
import { useUIStore } from '../../stores/uiStore';

export default function ModelCanvas() {
  const rfRef = useRef<ReactFlowInstance | null>(null);
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const onNodesChange = useGraphStore((s) => s.onNodesChange);
  const onEdgesChange = useGraphStore((s) => s.onEdgesChange);
  const onConnect = useGraphStore((s) => s.onConnect);
  const addNode = useGraphStore((s) => s.addNode);
  const deleteSelected = useGraphStore((s) => s.deleteSelected);
  const setOutputNode = useGraphStore((s) => s.setOutputNode);
  const undo = useGraphStore((s) => s.undo);
  const redo = useGraphStore((s) => s.redo);
  const openLayer = useGraphStore((s) => s.openLayer);
  const selectNode = useUIStore((s) => s.selectNode);
  const addToast = useUIStore((s) => s.addToast);
  const requestFitView = useUIStore((s) => s.requestFitView);
  const fitViewNonce = useUIStore((s) => s.fitViewNonce);

  // Re-fit the viewport when import/tidy/opening a layer reshapes the graph.
  // Wait until ReactFlow has measured the new nodes: fitting earlier sees no
  // node sizes and jumps to max zoom.
  useEffect(() => {
    if (fitViewNonce === 0) return;
    let frame = 0;
    let tries = 0;
    const tryFit = () => {
      const rf = rfRef.current;
      if (!rf) return;
      const measured = rf.getNodes().every((n) => n.width && n.height);
      if (measured || ++tries > 30) {
        rf.fitView({ padding: 0.15, duration: 300 });
      } else {
        frame = requestAnimationFrame(tryFit);
      }
    };
    frame = requestAnimationFrame(tryFit);
    return () => cancelAnimationFrame(frame);
  }, [fitViewNonce]);

  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      if (!rfRef.current) return;
      const pos = rfRef.current.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });

      // A JSON custom layer dragged from the library's Custom Layers section
      const layer = e.dataTransfer.getData('application/mlnode-layer');
      if (layer) {
        const editing = useGraphStore.getState().editStack;
        if (editing.some((f) => f.layer === layer)) {
          addToast(`Layer ${layer} cannot use itself.`, 'error');
          return;
        }
        addNode('custom', pos, { label: layer, layer, params: {} });
        return;
      }

      const type = e.dataTransfer.getData('application/mlnode-type');
      if (!type) return;
      addNode(type, pos);
    },
    [addNode, addToast]
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelected();
      }
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
        if (e.key === 'z' && e.shiftKey) { e.preventDefault(); redo(); }
        if (e.key === 'Z') { e.preventDefault(); redo(); }
      }
    },
    [deleteSelected, undo, redo]
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: any) => {
      selectNode(node.id);
    },
    [selectNode]
  );

  const onNodeContextMenu = useCallback(
    (e: React.MouseEvent, node: any) => {
      e.preventDefault();
      setOutputNode(node.id);
    },
    [setOutputNode]
  );

  // Double-click a JSON layer node to open its sub-graph.
  const onNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: any) => {
      if (node.type !== 'custom' || !node.data?.layer) return;
      const error = openLayer(node.data.layer);
      if (error) {
        addToast(error, 'error');
        return;
      }
      selectNode(null);
      requestFitView();
    },
    [openLayer, addToast, selectNode, requestFitView]
  );

  const onPaneClick = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

  return (
    <div
      className="flex-1 h-full"
      onKeyDown={onKeyDown}
      tabIndex={0}
      style={{ outline: 'none' }}
    >
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={(rf) => { rfRef.current = rf; }}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onNodeClick={onNodeClick}
          onNodeDoubleClick={onNodeDoubleClick}
          onNodeContextMenu={onNodeContextMenu}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          deleteKeyCode={null}
          style={{ background: '#0e0e12' }}
          defaultEdgeOptions={{
            style: { stroke: '#52525b', strokeWidth: 2 },
            type: 'smoothstep',
          }}
        >
          <Background color="#1a1a22" gap={20} size={1} />
          <Controls
            style={{
              background: '#141418',
              border: '1px solid #27272f',
              borderRadius: 8,
            }}
          />
          <MiniMap
            style={{
              background: '#141418',
              border: '1px solid #27272f',
              borderRadius: 8,
            }}
            nodeColor={(n) => {
              if (n.type === 'Input') return '#22c55e';
              if (n.type === 'custom') return '#94a3b8';
              return '#3b82f6';
            }}
            maskColor="rgba(0,0,0,0.7)"
          />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
}
