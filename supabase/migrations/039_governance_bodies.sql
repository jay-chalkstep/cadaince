-- Migration 039: Governance Bodies
-- Creates curated leadership groups (ELT, SLT) separate from AC-derived pillars
-- Phase 1: Additive changes only - no breaking changes

-- ============================================
-- 1. GOVERNANCE BODIES TABLE
-- ============================================

CREATE TABLE governance_bodies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Identity
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,

  -- Type
  body_type TEXT NOT NULL CHECK (body_type IN ('elt', 'slt', 'custom')),

  -- Settings
  l10_required BOOLEAN DEFAULT true,
  is_confidential BOOLEAN DEFAULT false,
  settings JSONB DEFAULT '{}',

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, slug)
);

CREATE INDEX idx_governance_bodies_org ON governance_bodies(organization_id);
CREATE INDEX idx_governance_bodies_type ON governance_bodies(body_type);

-- ============================================
-- 2. GOVERNANCE BODY MEMBERSHIPS (Curated)
-- ============================================

CREATE TABLE governance_body_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  governance_body_id UUID NOT NULL REFERENCES governance_bodies(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Role within the body
  is_chair BOOLEAN DEFAULT false,
  role_title TEXT,

  -- Metadata
  added_at TIMESTAMPTZ DEFAULT NOW(),
  added_by UUID REFERENCES profiles(id),

  UNIQUE(governance_body_id, profile_id)
);

CREATE INDEX idx_gb_memberships_body ON governance_body_memberships(governance_body_id);
CREATE INDEX idx_gb_memberships_profile ON governance_body_memberships(profile_id);

-- ============================================
-- 3. ENHANCE PILLARS TABLE
-- ============================================

-- Add anchor_seat_id to derive leadership/membership from AC
ALTER TABLE pillars ADD COLUMN IF NOT EXISTS anchor_seat_id UUID REFERENCES seats(id) ON DELETE SET NULL;

-- Add index for anchor seat lookups
CREATE INDEX IF NOT EXISTS idx_pillars_anchor_seat ON pillars(anchor_seat_id);

-- ============================================
-- 4. ADD GOVERNANCE_BODY_ID TO EXISTING TABLES
-- ============================================

-- Rocks: company rocks owned by governance bodies
ALTER TABLE rocks ADD COLUMN IF NOT EXISTS governance_body_id UUID REFERENCES governance_bodies(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_rocks_governance_body ON rocks(governance_body_id);

-- Issues: can be escalated to governance bodies
ALTER TABLE issues ADD COLUMN IF NOT EXISTS governance_body_id UUID REFERENCES governance_bodies(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_issues_governance_body ON issues(governance_body_id);

-- L10 Meetings: can be owned by governance body OR pillar
ALTER TABLE l10_meetings ADD COLUMN IF NOT EXISTS governance_body_id UUID REFERENCES governance_bodies(id) ON DELETE SET NULL;
ALTER TABLE l10_meetings ADD COLUMN IF NOT EXISTS pillar_id UUID REFERENCES pillars(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_l10_meetings_governance_body ON l10_meetings(governance_body_id);
CREATE INDEX IF NOT EXISTS idx_l10_meetings_pillar ON l10_meetings(pillar_id);

-- Headlines: confidential headlines belong to governance bodies
ALTER TABLE headlines ADD COLUMN IF NOT EXISTS governance_body_id UUID REFERENCES governance_bodies(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_headlines_governance_body ON headlines(governance_body_id);

-- Metrics: add pillar_id for pillar-level metrics
ALTER TABLE metrics ADD COLUMN IF NOT EXISTS pillar_id UUID REFERENCES pillars(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_metrics_pillar ON metrics(pillar_id);

-- ============================================
-- 5. PILLAR MEMBERSHIPS VIEW (Derived from AC)
-- ============================================

-- This view computes pillar membership by walking down from anchor seat
CREATE OR REPLACE VIEW pillar_memberships AS
WITH RECURSIVE pillar_seat_descendants AS (
  -- Base: direct seat assignments for pillar's anchor seat
  SELECT
    p.id AS pillar_id,
    p.organization_id,
    sa.team_member_id AS profile_id,
    p.anchor_seat_id AS root_seat_id,
    sa.seat_id,
    true AS is_lead,
    0 AS depth
  FROM pillars p
  JOIN seat_assignments sa ON sa.seat_id = p.anchor_seat_id
  WHERE p.anchor_seat_id IS NOT NULL

  UNION ALL

  -- Recursive: descendants of anchor seat (people under the pillar lead)
  SELECT
    psd.pillar_id,
    psd.organization_id,
    sa.team_member_id AS profile_id,
    psd.root_seat_id,
    s.id AS seat_id,
    false AS is_lead,
    psd.depth + 1
  FROM pillar_seat_descendants psd
  JOIN seats s ON s.parent_seat_id = psd.seat_id
  JOIN seat_assignments sa ON sa.seat_id = s.id
  WHERE psd.depth < 10  -- Prevent infinite recursion
)
SELECT DISTINCT
  pillar_id,
  organization_id,
  profile_id,
  is_lead
FROM pillar_seat_descendants;

-- Grant access to view
GRANT SELECT ON pillar_memberships TO authenticated;

-- ============================================
-- 6. RLS FOR GOVERNANCE BODIES
-- ============================================

ALTER TABLE governance_bodies ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance_body_memberships ENABLE ROW LEVEL SECURITY;

-- Users can view governance bodies in their org
CREATE POLICY "Users can view own org governance bodies"
ON governance_bodies FOR SELECT
USING (organization_id = get_current_organization_id());

-- Admins and ELT can manage governance bodies
CREATE POLICY "Admins and ELT can manage governance bodies"
ON governance_bodies FOR ALL
USING (
  organization_id = get_current_organization_id()
  AND get_current_access_level() IN ('admin', 'elt')
);

-- Users can view memberships in their org
CREATE POLICY "Users can view governance body memberships"
ON governance_body_memberships FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM governance_bodies gb
    WHERE gb.id = governance_body_memberships.governance_body_id
    AND gb.organization_id = get_current_organization_id()
  )
);

-- Admins and ELT can manage memberships
CREATE POLICY "Admins and ELT can manage governance body memberships"
ON governance_body_memberships FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM governance_bodies gb
    WHERE gb.id = governance_body_memberships.governance_body_id
    AND gb.organization_id = get_current_organization_id()
  )
  AND get_current_access_level() IN ('admin', 'elt')
);

-- ============================================
-- 7. UPDATED_AT TRIGGER
-- ============================================

CREATE TRIGGER update_governance_bodies_updated_at
  BEFORE UPDATE ON governance_bodies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
