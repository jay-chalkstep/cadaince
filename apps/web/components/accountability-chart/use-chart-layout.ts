"use client";

import { useCallback, useMemo } from "react";
import dagre from "dagre";
import type { Node, Edge } from "@xyflow/react";
import type { CardDimensions, SeatNode, ChartEdge } from "./types";

interface LayoutOptions {
  direction?: "TB" | "BT" | "LR" | "RL";
  rankSep?: number;
  nodeSep?: number;
}

interface UseChartLayoutResult {
  getLayoutedElements: (
    nodes: SeatNode[],
    edges: ChartEdge[],
    options?: LayoutOptions
  ) => { nodes: SeatNode[]; edges: ChartEdge[] };
}

/**
 * useChartLayout - Hook for applying dagre hierarchical layout to React Flow nodes
 *
 * Uses dagre for automatic tree layout with configurable:
 * - Direction (top-to-bottom, left-to-right, etc.)
 * - Node separation (horizontal spacing)
 * - Rank separation (vertical spacing between levels)
 */
export function useChartLayout(dimensions: CardDimensions): UseChartLayoutResult {
  const getLayoutedElements = useCallback(
    (
      nodes: SeatNode[],
      edges: ChartEdge[],
      options: LayoutOptions = {}
    ): { nodes: SeatNode[]; edges: ChartEdge[] } => {
      const {
        direction = "TB",
        rankSep = 80,
        nodeSep = 40,
      } = options;

      // Create a new dagre graph
      const dagreGraph = new dagre.graphlib.Graph();
      dagreGraph.setDefaultEdgeLabel(() => ({}));

      // Configure the graph
      dagreGraph.setGraph({
        rankdir: direction,
        ranksep: rankSep,
        nodesep: nodeSep,
        marginx: 50,
        marginy: 50,
      });

      // Add nodes to dagre
      nodes.forEach((node) => {
        dagreGraph.setNode(node.id, {
          width: dimensions.width,
          height: dimensions.height,
        });
      });

      // Add edges to dagre
      edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
      });

      // Check for cycles before applying layout (prevents dagre from crashing)
      try {
        const cycles = dagre.graphlib.alg.findCycles(dagreGraph);
        if (cycles.length > 0) {
          console.error(
            "Circular reference detected in seat hierarchy, skipping layout",
            cycles
          );
          return { nodes, edges };
        }
      } catch (e) {
        console.error("Error checking for cycles:", e);
      }

      // Apply layout
      dagre.layout(dagreGraph);

      // Apply positions back to nodes
      const layoutedNodes = nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        if (!nodeWithPosition) {
          return node;
        }

        return {
          ...node,
          position: {
            // dagre centers nodes, so we offset by half width/height
            x: nodeWithPosition.x - dimensions.width / 2,
            y: nodeWithPosition.y - dimensions.height / 2,
          },
        };
      });

      return { nodes: layoutedNodes, edges };
    },
    [dimensions]
  );

  return { getLayoutedElements };
}

/**
 * Calculate layout for seats and edges without React state
 * Useful for initial layout or server-side calculation
 */
export function calculateLayout(
  nodes: SeatNode[],
  edges: ChartEdge[],
  dimensions: CardDimensions,
  options: LayoutOptions = {}
): { nodes: SeatNode[]; edges: ChartEdge[] } {
  const {
    direction = "TB",
    rankSep = 80,
    nodeSep = 40,
  } = options;

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  dagreGraph.setGraph({
    rankdir: direction,
    ranksep: rankSep,
    nodesep: nodeSep,
    marginx: 50,
    marginy: 50,
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, {
      width: dimensions.width,
      height: dimensions.height,
    });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // Check for cycles before applying layout (prevents dagre from crashing)
  try {
    const cycles = dagre.graphlib.alg.findCycles(dagreGraph);
    if (cycles.length > 0) {
      console.error(
        "Circular reference detected in seat hierarchy, skipping layout",
        cycles
      );
      return { nodes, edges };
    }
  } catch (e) {
    console.error("Error checking for cycles:", e);
  }

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    if (!nodeWithPosition) {
      return node;
    }

    return {
      ...node,
      position: {
        x: nodeWithPosition.x - dimensions.width / 2,
        y: nodeWithPosition.y - dimensions.height / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

/**
 * Get the bounding box of all nodes for fit-to-view calculations
 */
export function getNodesBounds(nodes: Node[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
} {
  if (nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  nodes.forEach((node) => {
    const nodeWidth = (node.measured?.width ?? node.width ?? 200) as number;
    const nodeHeight = (node.measured?.height ?? node.height ?? 100) as number;

    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + nodeWidth);
    maxY = Math.max(maxY, node.position.y + nodeHeight);
  });

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}
