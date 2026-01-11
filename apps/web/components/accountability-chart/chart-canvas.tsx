"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  useReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  type NodeChange,
  type EdgeChange,
  type Connection,
  type OnNodesChange,
  type OnEdgesChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { SeatNode } from "./seat-node";
import { ChartControls } from "./chart-controls";
import { useChartLayout, calculateLayout } from "./use-chart-layout";
import { useChartPersistence, useReparentSeat } from "./use-chart-persistence";
import {
  type Seat,
  type SeatNode as SeatNodeType,
  type ChartEdge,
  type LayoutMode,
  type PositionUpdate,
  getCardDimensions,
  seatsToNodes,
  seatsToEdges,
  flattenSeats,
} from "./types";

// Register custom node types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodeTypes: any = {
  seat: SeatNode,
};

interface ChartCanvasInnerProps {
  seats: Seat[];
  onSeatClick: (seat: Seat) => void;
  onAddChild: (seat: Seat) => void;
  onReparent?: (seatId: string, newParentId: string | null) => Promise<void>;
}

/**
 * Inner canvas component (requires ReactFlowProvider wrapper)
 */
function ChartCanvasInner({
  seats,
  onSeatClick,
  onAddChild,
  onReparent,
}: ChartCanvasInnerProps) {
  const reactFlowInstance = useReactFlow();
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("auto");
  const [showMinimap, setShowMinimap] = useState(true);

  // Flatten seats and calculate dimensions
  const flatSeats = useMemo(() => flattenSeats(seats), [seats]);
  const dimensions = useMemo(
    () => getCardDimensions(flatSeats.length),
    [flatSeats.length]
  );

  // Layout hook
  const { getLayoutedElements } = useChartLayout(dimensions);

  // Persistence hooks
  const { savePositions, isSaving, lastSavedAt, pendingUpdates } =
    useChartPersistence({
      debounceMs: 500,
      onError: (error) => console.error("Position save error:", error),
    });
  const { reparentSeat, isReparenting } = useReparentSeat();

  // Handle drag-to-reparent
  const handleDrop = useCallback(
    async (draggedId: string, targetId: string) => {
      if (onReparent) {
        await onReparent(draggedId, targetId);
      } else {
        const success = await reparentSeat(draggedId, targetId);
        if (success) {
          // The parent component should refresh seats after reparenting
        }
      }
    },
    [onReparent, reparentSeat]
  );

  // Convert seats to nodes and edges
  const initialNodes = useMemo(
    () => seatsToNodes(flatSeats, dimensions, onSeatClick, onAddChild, handleDrop),
    [flatSeats, dimensions, onSeatClick, onAddChild, handleDrop]
  );

  const initialEdges = useMemo(() => seatsToEdges(flatSeats), [flatSeats]);

  // Apply initial layout
  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(() => {
    // Check if any seats have saved positions
    const hasPositions = flatSeats.some(
      (s) => s.position_x !== null && s.position_y !== null
    );

    if (hasPositions && layoutMode === "manual") {
      // Use saved positions
      return { nodes: initialNodes, edges: initialEdges };
    }

    // Apply auto layout
    return calculateLayout(initialNodes, initialEdges, dimensions);
  }, [initialNodes, initialEdges, dimensions, flatSeats, layoutMode]);

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState<SeatNodeType>(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<ChartEdge>(layoutedEdges);

  // Update nodes when seats change
  useEffect(() => {
    const hasPositions = flatSeats.some(
      (s) => s.position_x !== null && s.position_y !== null
    );

    if (hasPositions && layoutMode === "manual") {
      setNodes(initialNodes);
    } else {
      const { nodes: newNodes } = calculateLayout(
        initialNodes,
        initialEdges,
        dimensions
      );
      setNodes(newNodes);
    }
    setEdges(initialEdges);
  }, [
    flatSeats,
    initialNodes,
    initialEdges,
    dimensions,
    layoutMode,
    setNodes,
    setEdges,
  ]);

  // Handle node position changes (for persistence in manual mode)
  const handleNodesChange: OnNodesChange<SeatNodeType> = useCallback(
    (changes: NodeChange<SeatNodeType>[]) => {
      onNodesChange(changes);

      // In manual mode, save position changes
      if (layoutMode === "manual") {
        const positionChanges = changes.filter(
          (change): change is NodeChange<SeatNodeType> & { type: "position"; dragging: false } =>
            change.type === "position" &&
            "dragging" in change &&
            change.dragging === false &&
            "position" in change &&
            change.position !== undefined
        );

        if (positionChanges.length > 0) {
          const updates: PositionUpdate[] = positionChanges.map((change) => ({
            id: change.id,
            position_x: change.position!.x,
            position_y: change.position!.y,
          }));
          savePositions(updates);
        }
      }
    },
    [onNodesChange, layoutMode, savePositions]
  );

  // Handle edge changes
  const handleEdgesChange: OnEdgesChange<ChartEdge> = useCallback(
    (changes: EdgeChange<ChartEdge>[]) => {
      onEdgesChange(changes);
    },
    [onEdgesChange]
  );

  // Re-layout handler
  const handleAutoLayout = useCallback(() => {
    const { nodes: newNodes, edges: newEdges } = getLayoutedElements(
      nodes as SeatNodeType[],
      edges as ChartEdge[]
    );
    setNodes(newNodes);
    setEdges(newEdges);

    // If in manual mode, save the new positions
    if (layoutMode === "manual") {
      const updates: PositionUpdate[] = newNodes.map((node) => ({
        id: node.id,
        position_x: node.position.x,
        position_y: node.position.y,
      }));
      savePositions(updates);
    }

    // Fit view after layout
    setTimeout(() => {
      reactFlowInstance.fitView({ padding: 0.2 });
    }, 50);
  }, [
    nodes,
    edges,
    getLayoutedElements,
    setNodes,
    setEdges,
    layoutMode,
    savePositions,
    reactFlowInstance,
  ]);

  // Fit view handler
  const handleFitView = useCallback(() => {
    reactFlowInstance.fitView({ padding: 0.2, duration: 300 });
  }, [reactFlowInstance]);

  // Layout mode change
  const handleLayoutModeChange = useCallback(
    (mode: LayoutMode) => {
      setLayoutMode(mode);
      if (mode === "auto") {
        handleAutoLayout();
      }
    },
    [handleAutoLayout]
  );

  // Initial fit view
  useEffect(() => {
    const timer = setTimeout(() => {
      reactFlowInstance.fitView({ padding: 0.2 });
    }, 100);
    return () => clearTimeout(timer);
  }, [reactFlowInstance]);

  return (
    <div className="w-full h-full relative">
      <ChartControls
        layoutMode={layoutMode}
        onLayoutModeChange={handleLayoutModeChange}
        onAutoLayout={handleAutoLayout}
        onFitView={handleFitView}
        showMinimap={showMinimap}
        onMinimapToggle={setShowMinimap}
        isSaving={isSaving}
        pendingUpdates={pendingUpdates}
        lastSavedAt={lastSavedAt}
      />

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: "smoothstep",
          animated: false,
        }}
        proOptions={{ hideAttribution: true }}
        className="bg-muted/30"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <Controls
          showZoom={true}
          showFitView={false}
          showInteractive={false}
          position="bottom-right"
        />
        {showMinimap && (
          <MiniMap
            nodeStrokeWidth={3}
            zoomable
            pannable
            position="bottom-left"
            className="!bg-background/80 border rounded-lg"
          />
        )}
      </ReactFlow>
    </div>
  );
}

interface ChartCanvasProps {
  seats: Seat[];
  onSeatClick: (seat: Seat) => void;
  onAddChild: (seat: Seat) => void;
  onReparent?: (seatId: string, newParentId: string | null) => Promise<void>;
}

/**
 * ChartCanvas - Main accountability chart component using React Flow
 *
 * Features:
 * - Auto-scaling cards based on seat count
 * - Drag-to-reposition (manual mode)
 * - Drag-to-reparent
 * - Auto-layout with dagre
 * - Position persistence
 * - Minimap and controls
 */
export function ChartCanvas(props: ChartCanvasProps) {
  return (
    <ReactFlowProvider>
      <ChartCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
