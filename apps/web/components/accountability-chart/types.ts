import type { Node, Edge } from "@xyflow/react";

/**
 * Team member assignment to a seat
 */
export interface Assignment {
  id: string;
  is_primary: boolean;
  assignment_type?: "holder" | "co-holder" | "backup" | "fractional" | "dotted-line";
  team_member: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    email: string;
    title: string | null;
  };
}

/**
 * Seat function definition
 */
export interface SeatFunction {
  id: string;
  name: string;
  description: string | null;
  category: string;
  icon: string | null;
  is_eos_default: boolean;
  is_custom: boolean;
}

/**
 * Function assignment to a seat
 */
export interface FunctionAssignment {
  id: string;
  assignment_type: "primary" | "shared" | "supporting";
  sort_order: number;
  function: SeatFunction;
}

/**
 * Pillar association for a seat (supports multi-pillar)
 */
export interface SeatPillar {
  id: string;
  name: string;
  color: string | null;
  is_primary: boolean;
}

/**
 * Seat data structure from the API
 */
export interface Seat {
  id: string;
  name: string;
  parent_seat_id: string | null;
  /** @deprecated Use pillars array instead */
  pillar_id: string | null;
  /** @deprecated Use pillars array instead - kept for backward compat */
  pillar: {
    id: string;
    name: string;
    color: string | null;
  } | null;
  /** Multi-pillar support - array of all pillars this seat belongs to */
  pillars: SeatPillar[];
  roles: string[];
  seat_type?: "single" | "unit";
  eos_role?: "visionary" | "integrator" | "leader" | null;
  display_as_unit?: boolean;
  gets_it: boolean;
  wants_it: boolean;
  capacity_to_do: boolean;
  core_values_match: boolean;
  color: string | null;
  position_x: number | null;
  position_y: number | null;
  assignments: Assignment[];
  function_assignments?: FunctionAssignment[];
  children?: Seat[];
}

/**
 * Layout mode for the chart
 */
export type LayoutMode = "auto" | "manual";

/**
 * Card size configuration based on seat count
 */
export interface CardDimensions {
  width: number;
  height: number;
}

/**
 * Get card dimensions based on total seat count
 * - Spacious (≤10 seats): 280x160
 * - Standard (11-25 seats): 240x140
 * - Compact (26-50 seats): 200x120
 */
export function getCardDimensions(totalSeats: number): CardDimensions {
  if (totalSeats <= 10) {
    return { width: 280, height: 160 };
  }
  if (totalSeats <= 25) {
    return { width: 240, height: 140 };
  }
  return { width: 200, height: 120 };
}

/**
 * Custom data attached to seat nodes
 */
export interface SeatNodeData extends Record<string, unknown> {
  seat: Seat;
  dimensions: CardDimensions;
  onSeatClick: (seat: Seat) => void;
  onAddChild: (seat: Seat) => void;
}

/**
 * React Flow node type for seats
 */
export type SeatNode = Node<SeatNodeData, "seat">;

/**
 * Edge type for connections
 */
export type ChartEdgeType = "solid" | "dotted";

/**
 * Custom data attached to edges
 */
export interface ChartEdgeData extends Record<string, unknown> {
  type: ChartEdgeType;
}

/**
 * React Flow edge type for chart connections
 */
export type ChartEdge = Edge<ChartEdgeData>;

/**
 * Position update for persistence
 */
export interface PositionUpdate {
  id: string;
  position_x: number;
  position_y: number;
}

/**
 * Chart state for context
 */
export interface ChartState {
  layoutMode: LayoutMode;
  isDragging: boolean;
  selectedSeatId: string | null;
}

/**
 * Assignment type labels for display
 */
export const ASSIGNMENT_TYPE_LABELS: Record<string, string> = {
  holder: "",
  "co-holder": "Co-Holder",
  backup: "Backup",
  fractional: "Fractional",
  "dotted-line": "Dotted Line",
};

/**
 * EOS role labels for badges
 */
export const EOS_ROLE_LABELS: Record<string, string> = {
  visionary: "V",
  integrator: "I",
  leader: "L",
};

/**
 * Helper to get initials from a name
 */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Convert seats array to React Flow nodes
 */
export function seatsToNodes(
  seats: Seat[],
  dimensions: CardDimensions,
  onSeatClick: (seat: Seat) => void,
  onAddChild: (seat: Seat) => void
): SeatNode[] {
  return seats.map((seat) => ({
    id: seat.id,
    type: "seat",
    position: {
      x: seat.position_x ?? 0,
      y: seat.position_y ?? 0,
    },
    data: {
      seat,
      dimensions,
      onSeatClick,
      onAddChild,
    },
    draggable: true,
  }));
}

/**
 * Convert seats array to React Flow edges
 */
export function seatsToEdges(seats: Seat[]): ChartEdge[] {
  const edges: ChartEdge[] = [];

  for (const seat of seats) {
    if (seat.parent_seat_id) {
      edges.push({
        id: `${seat.parent_seat_id}-${seat.id}`,
        source: seat.parent_seat_id,
        target: seat.id,
        sourceHandle: "bottom",
        targetHandle: "top",
        type: "smoothstep",
        style: {
          stroke: "#94a3b8", // Subtle gray (slate-400)
          strokeWidth: 2,
        },
        data: { type: "solid" },
        animated: false,
      });
    }

    // Add dotted-line edges for dotted-line assignments
    for (const assignment of seat.assignments) {
      if (assignment.assignment_type === "dotted-line") {
        // For dotted-line relationships, we'd need the source seat ID
        // This would require additional data in the assignment
        // For now, we'll handle this in future iterations
      }
    }
  }

  return edges;
}

/**
 * Flatten nested seat hierarchy to array
 */
export function flattenSeats(seats: Seat[]): Seat[] {
  const result: Seat[] = [];

  function traverse(seatList: Seat[]) {
    for (const seat of seatList) {
      result.push(seat);
      if (seat.children && seat.children.length > 0) {
        traverse(seat.children);
      }
    }
  }

  traverse(seats);
  return result;
}
