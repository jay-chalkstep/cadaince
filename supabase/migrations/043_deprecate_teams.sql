-- Migration 043: Deprecate Teams Table
-- Mark team_id columns as deprecated, remove triggers, prepare for removal
-- The teams table is being replaced by pillars (derived) + governance_bodies (curated)

-- ============================================
-- 1. REMOVE TEAM AUTO-SYNC TRIGGERS
-- ============================================

-- These triggers automatically synced seats → teams, no longer needed
DROP TRIGGER IF EXISTS auto_create_team_for_seat ON seats;
DROP TRIGGER IF EXISTS update_team_on_seat_change ON seats;
DROP TRIGGER IF EXISTS auto_delete_team_for_seat ON seats;

-- Drop the trigger functions
DROP FUNCTION IF EXISTS create_team_for_seat();
DROP FUNCTION IF EXISTS update_team_parent_on_seat_change();
DROP FUNCTION IF EXISTS delete_team_for_seat();

-- ============================================
-- 2. CREATE COMPATIBILITY VIEWS
-- ============================================
-- These allow old code to continue working during transition

CREATE OR REPLACE VIEW teams_compat AS
SELECT
  p.id,
  p.organization_id,
  p.anchor_seat_id,
  NULL::uuid AS parent_team_id,
  p.name,
  p.slug,
  2 AS level,  -- Pillars are level 2 (department level)
  false AS is_elt,
  true AS l10_required,
  '{}'::jsonb AS settings,
  p.created_at,
  p.created_at AS updated_at
FROM pillars p
WHERE p.anchor_seat_id IS NOT NULL

UNION ALL

SELECT
  gb.id,
  gb.organization_id,
  NULL::uuid AS anchor_seat_id,
  NULL::uuid AS parent_team_id,
  gb.name,
  gb.slug,
  1 AS level,  -- Governance bodies are level 1 (ELT level)
  gb.body_type = 'elt' AS is_elt,
  gb.l10_required,
  gb.settings,
  gb.created_at,
  gb.updated_at
FROM governance_bodies gb;

-- Compatibility membership view
CREATE OR REPLACE VIEW team_memberships_compat AS
SELECT
  pm.pillar_id AS team_id,
  pm.organization_id,
  pm.profile_id,
  pm.is_lead
FROM pillar_memberships pm

UNION ALL

SELECT
  gbm.governance_body_id AS team_id,
  gb.organization_id,
  gbm.profile_id,
  gbm.is_chair AS is_lead
FROM governance_body_memberships gbm
JOIN governance_bodies gb ON gb.id = gbm.governance_body_id;

GRANT SELECT ON teams_compat TO authenticated;
GRANT SELECT ON team_memberships_compat TO authenticated;

-- ============================================
-- 3. REMOVE TEAM HELPER FUNCTIONS
-- ============================================

DROP FUNCTION IF EXISTS get_team_ancestors(UUID);
DROP FUNCTION IF EXISTS get_team_descendants(UUID);

-- ============================================
-- 4. ADD DEPRECATION TABLE/VIEW COMMENTS
-- ============================================

COMMENT ON TABLE teams IS 'DEPRECATED: Use pillars for functional grouping and governance_bodies for leadership groups. Will be dropped in migration 045.';
COMMENT ON VIEW team_memberships IS 'DEPRECATED: Use pillar_memberships or governance_body_memberships. Will be dropped in migration 045.';

-- Note: Column deprecation comments were added in migration 041
