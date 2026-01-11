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
  ConnectionLineType,
  ConnectionMode,
  type NodeChange,
  type EdgeChange,
  type Connection,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toast } from "sonner";

import { SeatNode } from "./seat-node";
import { ChartControls } from "./chart-controls";
import { useChartLayout, calculateLayout } from "./use-chart-layout";
import { useChartPersistence, useReparentSeat } from "./use-chart-persistence";
import { ReparentDialog, type PendingReparent } from "./reparent-dialog";
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
  const [pendingReparent, setPendingReparent] = useState<PendingReparent | null>(null);

  // Flatten seats and calculate dimensions
  const flatSeats = useMemo(() => flattenSeats(seats), [seats]);
  const dimensions = useMemo(
    () => getCardDimensions(flatSeats.length),
    [flatSeats.length]
  );

  // Create a lookup map for seat names
  const seatLookup = useMemo(() => {
    const map = new Map<string, Seat>();
    for (const seat of flatSeats) {
      map.set(seat.id, seat);
    }
    return map;
  }, [flatSeats]);

  // Layout hook
  const { getLayoutedElements } = useChartLayout(dimensions);

  // Persistence hooks
  const { savePositions, isSaving, lastSavedAt, pendingUpdates } =
    useChartPersistence({
      debounceMs: 500,
      onError: (error) => console.error("Position save error:", error),
    });
  const { reparentSeat, isReparenting } = useReparentSeat();

  // Helper to check if a seat is a descendant of another
  const isDescendantOf = useCallback(
    (seatId: string, potentialAncestorId: string): boolean => {
      let current = seatLookup.get(seatId);
      while (current) {
        if (current.parent_seat_id === potentialAncestorId) {
          return true;
        }
        current = current.parent_seat_id
          ? seatLookup.get(current.parent_seat_id)
          : undefined;
      }
      return false;
    },
    [seatLookup]
  );

  // Handle connection from React Flow (drag from source handle to target handle)
  // Visio-style: Drag FROM parent's bottom handle TO child = source becomes parent of target
  const handleConnect: OnConnect = useCallback(
    (connection: Connection) => {
      // connection.source = the seat you dragged FROM (will become the parent)
      // connection.target = the seat you dropped ON (will become the child)
      if (!connection.source || !connection.target) return;

      const newParentSeat = seatLookup.get(connection.source);
      const childSeat = seatLookup.get(connection.target);

      if (!newParentSeat || !childSeat) return;

      // Don't allow connecting to self
      if (connection.source === connection.target) return;

      // Don't allow if source is already the parent of target
      if (childSeat.parent_seat_id === connection.source) {
        toast.info("Already reports to this seat");
        return;
      }

      // Check for circular reference: new parent cannot be a descendant of the child
      // (otherwise we'd create: child -> ... -> newParent -> child)
      if (isDescendantOf(connection.source, connection.target)) {
        toast.error("Invalid hierarchy", {
          description: "This would create a circular reporting structure.",
        });
        return;
      }

      // Show confirmation dialog
      // sourceId = the seat being reparented (the child)
      // targetId = the new parent
      setPendingReparent({
        sourceId: connection.target,
        sourceName: childSeat.name,
        targetId: connection.source,
        targetName: newParentSeat.name,
      });
    },
    [seatLookup, isDescendantOf]
  );

  // Confirm the reparent action
  const handleConfirmReparent = useCallback(async () => {
    if (!pendingReparent) return;

    try {
      if (onReparent) {
        await onReparent(pendingReparent.sourceId, pendingReparent.targetId);
      } else {
        const success = await reparentSeat(pendingReparent.sourceId, pendingReparent.targetId);
        if (!success) {
          throw new Error("Failed to update reporting relationship");
        }
      }

      toast.success("Reporting updated", {
        description: `${pendingReparent.sourceName} now reports to ${pendingReparent.targetName}`,
      });
    } catch (error) {
      toast.error("Failed to update", {
        description: "Could not change the reporting relationship. Please try again.",
      });
    } finally {
      setPendingReparent(null);
    }
  }, [pendingReparent, onReparent, reparentSeat]);

  // Cancel the reparent action
  const handleCancelReparent = useCallback(() => {
    setPendingReparent(null);
  }, []);

  // Convert seats to nodes and edges
  const initialNodes = useMemo(
    () => seatsToNodes(flatSeats, dimensions, onSeatClick, onAddChild),
    [flatSeats, dimensions, onSeatClick, onAddChild]
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
        onConnect={handleConnect}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        connectionLineStyle={{ stroke: "hsl(var(--primary))", strokeWidth: 2 }}
        connectionLineType={ConnectionLineType.Step}
        defaultEdgeOptions={{
          type: "step",
          animated: false,
          style: {
            stroke: "hsl(var(--border))",
            strokeWidth: 2,
          },
        }}
        connectionMode={ConnectionMode.Strict}
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

      <ReparentDialog
        pendingReparent={pendingReparent}
        onConfirm={handleConfirmReparent}
        onCancel={handleCancelReparent}
      />
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
