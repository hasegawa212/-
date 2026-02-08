import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import WorkflowNode, { type WorkflowNodeData, NODE_WIDTH } from './WorkflowNode';

// ---- Types ----

export interface WorkflowEdge {
  id: string;
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
}

export interface CanvasProps {
  nodes: WorkflowNodeData[];
  edges: WorkflowEdge[];
  onNodesChange: (nodes: WorkflowNodeData[]) => void;
  onEdgesChange: (edges: WorkflowEdge[]) => void;
  onNodeSelect: (nodeId: string | null) => void;
  selectedNodeId: string | null;
}

interface DragState {
  type: 'none' | 'pan' | 'move-node' | 'connect';
  startX: number;
  startY: number;
  nodeId?: string;
  origNodeX?: number;
  origNodeY?: number;
  origPanX?: number;
  origPanY?: number;
  // for connect
  sourceNodeId?: string;
  sourcePortId?: string;
  currentX?: number;
  currentY?: number;
}

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 3;
const GRID_SIZE = 20;
const NODE_HEIGHT_ESTIMATE = 90;
const MINIMAP_WIDTH = 180;
const MINIMAP_HEIGHT = 120;

export default function Canvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onNodeSelect,
  selectedNodeId,
}: CanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [dragState, setDragState] = useState<DragState>({ type: 'none', startX: 0, startY: 0 });
  const [containerSize, setContainerSize] = useState({ width: 1200, height: 800 });

  // Track container size
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Convert screen coordinates to canvas coordinates
  const screenToCanvas = useCallback(
    (screenX: number, screenY: number) => {
      const svg = svgRef.current;
      if (!svg) return { x: screenX, y: screenY };
      const rect = svg.getBoundingClientRect();
      return {
        x: (screenX - rect.left) / zoom - panX / zoom,
        y: (screenY - rect.top) / zoom - panY / zoom,
      };
    },
    [panX, panY, zoom]
  );

  // ---- Wheel zoom ----
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = -e.deltaY * 0.001;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom + delta * zoom));

      // Zoom towards cursor position
      const svg = svgRef.current;
      if (svg) {
        const rect = svg.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const scaleChange = newZoom / zoom;
        setPanX((prev) => mouseX - scaleChange * (mouseX - prev));
        setPanY((prev) => mouseY - scaleChange * (mouseY - prev));
      }

      setZoom(newZoom);
    },
    [zoom]
  );

  // ---- Mouse handlers ----
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;

      const target = e.target as HTMLElement;

      // Check if clicking a drag handle (node header) -- for node move
      const dragHandle = target.closest('[data-drag-handle]');
      const nodeEl = target.closest('[data-node-id]');

      if (dragHandle && nodeEl) {
        const nodeId = nodeEl.getAttribute('data-node-id')!;
        const node = nodes.find((n) => n.id === nodeId);
        if (node) {
          onNodeSelect(nodeId);
          setDragState({
            type: 'move-node',
            startX: e.clientX,
            startY: e.clientY,
            nodeId,
            origNodeX: node.position.x,
            origNodeY: node.position.y,
          });
          return;
        }
      }

      // Click on a node body (select but don't drag)
      if (nodeEl && !dragHandle) {
        const nodeId = nodeEl.getAttribute('data-node-id')!;
        onNodeSelect(nodeId);
        return;
      }

      // Click on empty canvas -- start panning, deselect
      onNodeSelect(null);
      setDragState({
        type: 'pan',
        startX: e.clientX,
        startY: e.clientY,
        origPanX: panX,
        origPanY: panY,
      });
    },
    [nodes, panX, panY, onNodeSelect]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (dragState.type === 'none') return;

      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;

      if (dragState.type === 'pan') {
        setPanX((dragState.origPanX ?? 0) + dx);
        setPanY((dragState.origPanY ?? 0) + dy);
      } else if (dragState.type === 'move-node' && dragState.nodeId) {
        const newX = (dragState.origNodeX ?? 0) + dx / zoom;
        const newY = (dragState.origNodeY ?? 0) + dy / zoom;
        const updated = nodes.map((n) =>
          n.id === dragState.nodeId
            ? { ...n, position: { x: Math.round(newX / GRID_SIZE) * GRID_SIZE, y: Math.round(newY / GRID_SIZE) * GRID_SIZE } }
            : n
        );
        onNodesChange(updated);
      } else if (dragState.type === 'connect') {
        setDragState((prev) => ({ ...prev, currentX: e.clientX, currentY: e.clientY }));
      }
    },
    [dragState, zoom, nodes, onNodesChange]
  );

  const handleMouseUp = useCallback(() => {
    setDragState({ type: 'none', startX: 0, startY: 0 });
  }, []);

  // ---- Connection drawing ----
  const handleStartConnect = useCallback(
    (nodeId: string, portId: string, _portType: 'output', event: React.MouseEvent) => {
      event.stopPropagation();
      setDragState({
        type: 'connect',
        startX: event.clientX,
        startY: event.clientY,
        sourceNodeId: nodeId,
        sourcePortId: portId,
        currentX: event.clientX,
        currentY: event.clientY,
      });
    },
    []
  );

  const handleEndConnect = useCallback(
    (targetNodeId: string, _targetPortId: string, _portType: 'input') => {
      if (dragState.type !== 'connect' || !dragState.sourceNodeId) return;
      if (dragState.sourceNodeId === targetNodeId) return; // No self-connections

      // Check for duplicate edge
      const exists = edges.some(
        (e) =>
          e.sourceNodeId === dragState.sourceNodeId &&
          e.sourcePortId === dragState.sourcePortId &&
          e.targetNodeId === targetNodeId
      );
      if (!exists) {
        const newEdge: WorkflowEdge = {
          id: `edge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          sourceNodeId: dragState.sourceNodeId,
          sourcePortId: dragState.sourcePortId ?? 'output',
          targetNodeId,
          targetPortId: 'input',
        };
        onEdgesChange([...edges, newEdge]);
      }

      setDragState({ type: 'none', startX: 0, startY: 0 });
    },
    [dragState, edges, onEdgesChange]
  );

  // ---- Delete key ----
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Don't delete if user is typing in an input
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) {
          return;
        }

        if (selectedNodeId) {
          // Delete selected node and connected edges
          onNodesChange(nodes.filter((n) => n.id !== selectedNodeId));
          onEdgesChange(edges.filter((e) => e.sourceNodeId !== selectedNodeId && e.targetNodeId !== selectedNodeId));
          onNodeSelect(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, nodes, edges, onNodesChange, onEdgesChange, onNodeSelect]);

  // ---- Edge path computation ----
  const getNodePortPosition = useCallback(
    (nodeId: string, portId: string, side: 'left' | 'right'): { x: number; y: number } => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return { x: 0, y: 0 };

      if (side === 'left') {
        // Input port: left center
        return {
          x: node.position.x,
          y: node.position.y + NODE_HEIGHT_ESTIMATE / 2,
        };
      }

      // Output port(s): right side
      if (node.type === 'logic_if') {
        const portIndex = portId === 'true' ? 0 : 1;
        const yOffset = portIndex === 0 ? 0.3 : 0.7;
        return {
          x: node.position.x + NODE_WIDTH,
          y: node.position.y + NODE_HEIGHT_ESTIMATE * yOffset,
        };
      }

      return {
        x: node.position.x + NODE_WIDTH,
        y: node.position.y + NODE_HEIGHT_ESTIMATE / 2,
      };
    },
    [nodes]
  );

  const edgePaths = useMemo(() => {
    return edges.map((edge) => {
      const start = getNodePortPosition(edge.sourceNodeId, edge.sourcePortId, 'right');
      const end = getNodePortPosition(edge.targetNodeId, edge.targetPortId, 'left');

      const dx = Math.abs(end.x - start.x);
      const cpOffset = Math.max(50, dx * 0.4);

      const path = `M ${start.x} ${start.y} C ${start.x + cpOffset} ${start.y}, ${end.x - cpOffset} ${end.y}, ${end.x} ${end.y}`;

      return { ...edge, path, start, end };
    });
  }, [edges, getNodePortPosition]);

  // ---- In-progress connection line ----
  const connectLine = useMemo(() => {
    if (dragState.type !== 'connect' || !dragState.sourceNodeId || dragState.currentX == null) {
      return null;
    }
    const start = getNodePortPosition(dragState.sourceNodeId, dragState.sourcePortId ?? 'output', 'right');
    const canvasEnd = screenToCanvas(dragState.currentX, dragState.currentY);

    const dx = Math.abs(canvasEnd.x - start.x);
    const cpOffset = Math.max(50, dx * 0.4);

    const path = `M ${start.x} ${start.y} C ${start.x + cpOffset} ${start.y}, ${canvasEnd.x - cpOffset} ${canvasEnd.y}, ${canvasEnd.x} ${canvasEnd.y}`;
    return path;
  }, [dragState, getNodePortPosition, screenToCanvas]);

  // ---- Minimap calculations ----
  const minimapData = useMemo(() => {
    if (nodes.length === 0) return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.position.x);
      minY = Math.min(minY, n.position.y);
      maxX = Math.max(maxX, n.position.x + NODE_WIDTH);
      maxY = Math.max(maxY, n.position.y + NODE_HEIGHT_ESTIMATE);
    }

    const padding = 100;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    const worldW = maxX - minX;
    const worldH = maxY - minY;
    const scale = Math.min(MINIMAP_WIDTH / worldW, MINIMAP_HEIGHT / worldH);

    return {
      minX, minY, worldW, worldH, scale,
      rects: nodes.map((n) => ({
        id: n.id,
        x: (n.position.x - minX) * scale,
        y: (n.position.y - minY) * scale,
        w: NODE_WIDTH * scale,
        h: NODE_HEIGHT_ESTIMATE * scale,
        selected: n.id === selectedNodeId,
      })),
      // Viewport rectangle
      vpX: (-panX / zoom - minX) * scale,
      vpY: (-panY / zoom - minY) * scale,
      vpW: (containerSize.width / zoom) * scale,
      vpH: (containerSize.height / zoom) * scale,
    };
  }, [nodes, selectedNodeId, panX, panY, zoom, containerSize]);

  // ---- Drop handler for palette drag ----
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const nodeType = e.dataTransfer.getData('application/workflow-node-type');
      if (!nodeType) return;

      const canvasPos = screenToCanvas(e.clientX, e.clientY);
      const snappedX = Math.round(canvasPos.x / GRID_SIZE) * GRID_SIZE;
      const snappedY = Math.round(canvasPos.y / GRID_SIZE) * GRID_SIZE;

      const newNode: WorkflowNodeData = {
        id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: nodeType,
        position: { x: snappedX, y: snappedY },
        config: {},
      };

      onNodesChange([...nodes, newNode]);
      onNodeSelect(newNode.id);
    },
    [screenToCanvas, nodes, onNodesChange, onNodeSelect]
  );

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-gray-50 dark:bg-gray-950"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <svg
        ref={svgRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{ touchAction: 'none' }}
      >
        {/* Grid pattern */}
        <defs>
          <pattern
            id="grid-dots"
            x={panX % (GRID_SIZE * zoom)}
            y={panY % (GRID_SIZE * zoom)}
            width={GRID_SIZE * zoom}
            height={GRID_SIZE * zoom}
            patternUnits="userSpaceOnUse"
          >
            <circle
              cx={GRID_SIZE * zoom / 2}
              cy={GRID_SIZE * zoom / 2}
              r={1}
              className="fill-gray-300 dark:fill-gray-700"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-dots)" />

        {/* Transform group for pan & zoom */}
        <g transform={`translate(${panX}, ${panY}) scale(${zoom})`}>
          {/* Render edges */}
          {edgePaths.map((ep) => (
            <g key={ep.id}>
              {/* Hit area (wider invisible path for easier clicking) */}
              <path
                d={ep.path}
                fill="none"
                stroke="transparent"
                strokeWidth={12}
                className="cursor-pointer"
                onClick={() => {
                  // Delete edge on click
                  onEdgesChange(edges.filter((e) => e.id !== ep.id));
                }}
              />
              <path
                d={ep.path}
                fill="none"
                className="stroke-gray-400 dark:stroke-gray-500"
                strokeWidth={2}
                strokeLinecap="round"
              />
              {/* Arrow at target */}
              <circle
                cx={ep.end.x}
                cy={ep.end.y}
                r={3}
                className="fill-gray-400 dark:fill-gray-500"
              />
            </g>
          ))}

          {/* In-progress connection line */}
          {connectLine && (
            <path
              d={connectLine}
              fill="none"
              className="stroke-blue-400"
              strokeWidth={2}
              strokeDasharray="6 3"
              strokeLinecap="round"
              pointerEvents="none"
            />
          )}

          {/* Render nodes as foreignObjects */}
          {nodes.map((node) => (
            <foreignObject
              key={node.id}
              x={node.position.x}
              y={node.position.y}
              width={NODE_WIDTH}
              height={NODE_HEIGHT_ESTIMATE + 40}
              overflow="visible"
            >
              <WorkflowNode
                node={node}
                isSelected={node.id === selectedNodeId}
                onStartConnect={handleStartConnect}
                onEndConnect={handleEndConnect}
              />
            </foreignObject>
          ))}
        </g>
      </svg>

      {/* Zoom controls */}
      <div className="absolute top-3 right-3 flex items-center gap-1 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 px-1 py-1">
        <button
          onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - 0.1))}
          className="w-7 h-7 flex items-center justify-center text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          title="Zoom out"
        >
          -
        </button>
        <span className="text-xs text-gray-500 dark:text-gray-400 w-10 text-center select-none">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + 0.1))}
          className="w-7 h-7 flex items-center justify-center text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          title="Zoom in"
        >
          +
        </button>
        <div className="w-px h-5 bg-gray-200 dark:bg-gray-600 mx-1" />
        <button
          onClick={() => { setZoom(1); setPanX(0); setPanY(0); }}
          className="w-7 h-7 flex items-center justify-center text-[10px] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          title="Reset view"
        >
          1:1
        </button>
      </div>

      {/* Minimap */}
      {minimapData && (
        <div className="absolute bottom-3 right-3 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-1.5">
          <svg width={MINIMAP_WIDTH} height={MINIMAP_HEIGHT}>
            {/* Background */}
            <rect
              width={MINIMAP_WIDTH}
              height={MINIMAP_HEIGHT}
              rx={4}
              className="fill-gray-100 dark:fill-gray-900"
            />
            {/* Viewport rectangle */}
            <rect
              x={Math.max(0, minimapData.vpX)}
              y={Math.max(0, minimapData.vpY)}
              width={Math.min(MINIMAP_WIDTH, minimapData.vpW)}
              height={Math.min(MINIMAP_HEIGHT, minimapData.vpH)}
              rx={2}
              className="fill-blue-100/30 dark:fill-blue-900/30 stroke-blue-400"
              strokeWidth={1}
            />
            {/* Node rectangles */}
            {minimapData.rects.map((r) => (
              <rect
                key={r.id}
                x={r.x}
                y={r.y}
                width={Math.max(2, r.w)}
                height={Math.max(2, r.h)}
                rx={1}
                className={r.selected ? 'fill-blue-500' : 'fill-gray-400 dark:fill-gray-500'}
              />
            ))}
          </svg>
        </div>
      )}
    </div>
  );
}
