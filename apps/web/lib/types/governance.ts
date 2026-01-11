/**
 * Governance Bodies and Pillars Types
 *
 * These types support the new architecture where:
 * - Pillars: Functional areas with membership derived from AC anchor seats
 * - Governance Bodies: Curated leadership groups (ELT, SLT, custom)
 */

// ============================================
// GOVERNANCE BODIES
// ============================================

export type GovernanceBodyType = "elt" | "slt" | "custom";

export interface GovernanceBody {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  description: string | null;
  body_type: GovernanceBodyType;
  l10_required: boolean;
  is_confidential: boolean;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  // Populated by API
  members?: GovernanceBodyMember[];
  member_count?: number;
}

export interface GovernanceBodyMember {
  id: string;
  governance_body_id: string;
  profile_id: string;
  is_chair: boolean;
  role_title: string | null;
  added_at: string;
  added_by: string | null;
  // Populated by API
  profile?: {
    id: string;
    full_name: string;
    email: string;
    avatar_url: string | null;
    title: string | null;
    access_level: string;
  };
}

// ============================================
// PILLARS (Enhanced)
// ============================================

export interface Pillar {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  sort_order: number;
  leader_id: string | null;
  anchor_seat_id: string | null;
  created_at: string;
  // Populated by API
  leader?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
  anchor_seat?: {
    id: string;
    name: string;
    eos_role: string | null;
  };
}

export interface PillarWithMembers extends Pillar {
  member_count: number;
  computed_members?: PillarMembership[];
  members?: LegacyPillarMember[]; // From profiles.pillar_id
}

export interface PillarMembership {
  pillar_id: string;
  profile_id: string;
  is_lead: boolean;
  organization_id?: string;
  // Populated by API
  profile?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    title: string | null;
  };
}

export interface LegacyPillarMember {
  id: string;
  full_name: string;
  avatar_url: string | null;
  title: string | null;
  role: string;
  access_level: string;
  is_pillar_lead: boolean;
}

// ============================================
// ROCK OWNERSHIP
// ============================================

export type RockLevel = "company" | "pillar" | "individual";

export interface RockOwnership {
  rock_level: RockLevel;
  // Company rocks are owned by governance bodies
  governance_body_id?: string;
  governance_body?: GovernanceBody;
  // Pillar and individual rocks are scoped to pillars
  pillar_id?: string;
  pillar?: Pillar;
  // Individual rocks are owned by a person
  owner_id?: string;
  // Cascade hierarchy
  parent_rock_id?: string;
}

// ============================================
// L10 MEETING OWNERSHIP
// ============================================

export interface L10Ownership {
  // Leadership L10s are owned by governance bodies
  governance_body_id?: string;
  governance_body?: GovernanceBody;
  // Pillar L10s are owned by pillars
  pillar_id?: string;
  pillar?: Pillar;
}

// ============================================
// ISSUE OWNERSHIP
// ============================================

export type IssueLevel = "individual" | "pillar" | "company";

export interface IssueOwnership {
  issue_level: IssueLevel;
  pillar_id?: string;
  pillar?: Pillar;
  // Escalated issues may be assigned to governance bodies
  governance_body_id?: string;
  governance_body?: GovernanceBody;
}
