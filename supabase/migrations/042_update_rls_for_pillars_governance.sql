-- Migration 042: Update RLS Policies for Pillars + Governance Bodies
-- Transition from team-based to pillar/governance-body-based access

-- ============================================
-- 1. UPDATE ROCKS RLS - USE GOVERNANCE BODY
-- ============================================

DROP POLICY IF EXISTS "Users can view rocks" ON rocks;

-- Rocks are org-wide visible, except confidential ones (governance body members only)
CREATE POLICY "Users can view rocks" ON rocks
  FOR SELECT USING (
    organization_id = get_current_organization_id()
    AND (
      -- Non-confidential: visible to all org members
      COALESCE(is_confidential, false) = false
      OR
      -- Confidential: visible to governance body members
      EXISTS (
        SELECT 1 FROM governance_body_memberships gbm
        WHERE gbm.governance_body_id = rocks.governance_body_id
          AND gbm.profile_id = get_current_profile_id()
      )
      OR
      -- Owner can always see their own rocks
      owner_id = get_current_profile_id()
      OR
      -- Admins can see all
      get_current_access_level() = 'admin'
    )
  );

-- ============================================
-- 2. UPDATE ISSUES RLS - USE GOVERNANCE BODY
-- ============================================

DROP POLICY IF EXISTS "Users can view issues" ON issues;

-- Issues are org-wide visible, except confidential ones (governance body members only)
CREATE POLICY "Users can view issues" ON issues
  FOR SELECT USING (
    organization_id = get_current_organization_id()
    AND (
      -- Non-confidential: visible to all org members
      COALESCE(is_confidential, false) = false
      OR
      -- Confidential: visible to governance body members
      EXISTS (
        SELECT 1 FROM governance_body_memberships gbm
        WHERE gbm.governance_body_id = issues.governance_body_id
          AND gbm.profile_id = get_current_profile_id()
      )
      OR
      -- Raised by current user
      raised_by = get_current_profile_id()
      OR
      -- Assigned to current user
      owner_id = get_current_profile_id()
      OR
      -- Admins can see all
      get_current_access_level() = 'admin'
    )
  );

-- ============================================
-- 3. UPDATE HEADLINES RLS - USE GOVERNANCE BODY
-- ============================================

DROP POLICY IF EXISTS "Users can view headlines" ON headlines;

-- Headlines are org-wide visible, except confidential ones (governance body members only)
CREATE POLICY "Users can view headlines" ON headlines
  FOR SELECT USING (
    organization_id = get_current_organization_id()
    AND (
      -- Non-confidential: visible to all org members
      COALESCE(is_confidential, false) = false
      OR
      -- Confidential: visible to governance body members
      EXISTS (
        SELECT 1 FROM governance_body_memberships gbm
        WHERE gbm.governance_body_id = headlines.governance_body_id
          AND gbm.profile_id = get_current_profile_id()
      )
      OR
      -- Creator can see their own
      created_by = get_current_profile_id()
      OR
      -- Admins can see all
      get_current_access_level() = 'admin'
    )
  );

-- ============================================
-- 4. L10 MEETINGS ACCESS - PILLAR OR GOVERNANCE BODY
-- ============================================

DROP POLICY IF EXISTS "Users can view own org l10 meetings" ON l10_meetings;

CREATE POLICY "Users can view l10 meetings" ON l10_meetings
  FOR SELECT USING (
    -- Same org (with legacy null handling)
    (organization_id IS NULL OR organization_id = get_current_organization_id())
    AND (
      -- Public meeting (no governance body)
      governance_body_id IS NULL
      OR
      -- Member of governance body
      EXISTS (
        SELECT 1 FROM governance_body_memberships gbm
        WHERE gbm.governance_body_id = l10_meetings.governance_body_id
          AND gbm.profile_id = get_current_profile_id()
      )
      OR
      -- Member of pillar (via pillar_memberships view)
      EXISTS (
        SELECT 1 FROM pillar_memberships pm
        WHERE pm.pillar_id = l10_meetings.pillar_id
          AND pm.profile_id = get_current_profile_id()
      )
      OR
      -- Creator
      created_by = get_current_profile_id()
      OR
      -- Admin
      get_current_access_level() = 'admin'
    )
  );

-- ============================================
-- 5. CONFIDENTIAL VALIDATION - USE GOVERNANCE BODIES
-- ============================================

-- Replace old team-based validation with governance body validation
DROP TRIGGER IF EXISTS validate_issue_confidential ON issues;
DROP TRIGGER IF EXISTS validate_headline_confidential ON headlines;
DROP TRIGGER IF EXISTS validate_rock_confidential ON rocks;
DROP FUNCTION IF EXISTS validate_confidential_elt_only();

CREATE OR REPLACE FUNCTION validate_confidential_governance_body()
RETURNS TRIGGER AS $$
BEGIN
  -- If marking as confidential, require a governance body
  IF NEW.is_confidential = true THEN
    IF NEW.governance_body_id IS NULL THEN
      RAISE EXCEPTION 'Confidential items must be assigned to a governance body';
    END IF;

    -- Verify the governance body supports confidential items
    IF NOT EXISTS (
      SELECT 1 FROM governance_bodies
      WHERE id = NEW.governance_body_id
        AND is_confidential = true
    ) THEN
      RAISE EXCEPTION 'Governance body does not support confidential items';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to issues
CREATE TRIGGER validate_issue_confidential
  BEFORE INSERT OR UPDATE OF is_confidential, governance_body_id ON issues
  FOR EACH ROW
  WHEN (NEW.is_confidential = true)
  EXECUTE FUNCTION validate_confidential_governance_body();

-- Apply to headlines
CREATE TRIGGER validate_headline_confidential
  BEFORE INSERT OR UPDATE OF is_confidential, governance_body_id ON headlines
  FOR EACH ROW
  WHEN (NEW.is_confidential = true)
  EXECUTE FUNCTION validate_confidential_governance_body();

-- Apply to rocks
CREATE TRIGGER validate_rock_confidential
  BEFORE INSERT OR UPDATE OF is_confidential, governance_body_id ON rocks
  FOR EACH ROW
  WHEN (NEW.is_confidential = true)
  EXECUTE FUNCTION validate_confidential_governance_body();
