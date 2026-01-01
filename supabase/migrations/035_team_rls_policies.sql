-- Team Cascade & Hierarchy: RLS policies for teams and confidentiality
-- Teams are org-scoped, confidential items only visible to ELT members

-- ============================================
-- TEAMS TABLE RLS
-- ============================================
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- All org members can view teams
CREATE POLICY "Users can view org teams" ON teams
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE clerk_id = auth.uid()::text
    )
  );

-- Admins can manage teams (though teams are auto-synced from AC)
CREATE POLICY "Admins can manage teams" ON teams
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE clerk_id = auth.uid()::text AND access_level = 'admin'
    )
  );

-- ============================================
-- INDIVIDUAL GOALS TABLE RLS
-- ============================================
ALTER TABLE individual_goals ENABLE ROW LEVEL SECURITY;

-- Users can view goals in their teams or descendant teams they lead
CREATE POLICY "Users can view team goals" ON individual_goals
  FOR SELECT USING (
    -- Same org
    organization_id IN (
      SELECT organization_id FROM profiles WHERE clerk_id = auth.uid()::text
    )
  );

-- Goal owners can manage their goals
CREATE POLICY "Goal owners can manage goals" ON individual_goals
  FOR ALL USING (
    owner_id = (SELECT id FROM profiles WHERE clerk_id = auth.uid()::text)
  );

-- Admins can manage all goals
CREATE POLICY "Admins can manage goals" ON individual_goals
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE clerk_id = auth.uid()::text AND access_level = 'admin'
    )
  );

-- ============================================
-- UPDATE ROCKS POLICIES FOR CONFIDENTIALITY
-- ============================================
-- Drop old permissive policy
DROP POLICY IF EXISTS "All users can view rocks" ON rocks;

-- Rocks are org-wide visible, except confidential ones (ELT only)
CREATE POLICY "Users can view rocks" ON rocks
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE clerk_id = auth.uid()::text
    )
    AND (
      -- Non-confidential visible to all org members
      COALESCE(is_confidential, false) = false
      OR
      -- Confidential only visible to ELT team members
      EXISTS (
        SELECT 1 FROM team_memberships tm
        JOIN teams t ON t.id = tm.team_id
        WHERE tm.profile_id = (SELECT id FROM profiles WHERE clerk_id = auth.uid()::text)
        AND t.is_elt = true
        AND t.organization_id IN (SELECT organization_id FROM profiles WHERE clerk_id = auth.uid()::text)
      )
    )
  );

-- ============================================
-- UPDATE ISSUES POLICIES FOR CONFIDENTIALITY
-- ============================================
-- Drop old permissive policy
DROP POLICY IF EXISTS "All users can view issues" ON issues;

-- Issues are org-wide visible, except confidential ones (ELT only)
CREATE POLICY "Users can view issues" ON issues
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE clerk_id = auth.uid()::text
    )
    AND (
      -- Non-confidential visible to all org members
      COALESCE(is_confidential, false) = false
      OR
      -- Confidential only visible to ELT team members
      EXISTS (
        SELECT 1 FROM team_memberships tm
        JOIN teams t ON t.id = tm.team_id
        WHERE tm.profile_id = (SELECT id FROM profiles WHERE clerk_id = auth.uid()::text)
        AND t.is_elt = true
        AND t.organization_id IN (SELECT organization_id FROM profiles WHERE clerk_id = auth.uid()::text)
      )
    )
  );

-- ============================================
-- UPDATE HEADLINES POLICIES FOR CONFIDENTIALITY
-- ============================================
-- Drop old permissive policy
DROP POLICY IF EXISTS "Users can view own org headlines" ON headlines;

-- Headlines are org-wide visible, except confidential ones (ELT only)
CREATE POLICY "Users can view headlines" ON headlines
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE clerk_id = auth.uid()::text
    )
    AND (
      -- Non-confidential visible to all org members
      COALESCE(is_confidential, false) = false
      OR
      -- Confidential only visible to ELT team members
      EXISTS (
        SELECT 1 FROM team_memberships tm
        JOIN teams t ON t.id = tm.team_id
        WHERE tm.profile_id = (SELECT id FROM profiles WHERE clerk_id = auth.uid()::text)
        AND t.is_elt = true
        AND t.organization_id IN (SELECT organization_id FROM profiles WHERE clerk_id = auth.uid()::text)
      )
    )
  );

-- ============================================
-- METRIC VALUES TABLE RLS
-- ============================================
-- Note: metric_values may already have RLS from 002_row_level_security.sql
-- These policies ensure org-level isolation

DROP POLICY IF EXISTS "All users can view metric values" ON metric_values;

CREATE POLICY "Users can view org metric values" ON metric_values
  FOR SELECT USING (
    metric_id IN (
      SELECT id FROM metrics WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE clerk_id = auth.uid()::text
      )
    )
  );

-- ============================================
-- CONFIDENTIALITY VALIDATION TRIGGERS
-- ============================================
-- Since PostgreSQL CHECK constraints can't reference other tables,
-- we use triggers to enforce that only ELT teams can have confidential items

CREATE OR REPLACE FUNCTION validate_confidential_elt_only()
RETURNS TRIGGER AS $$
BEGIN
  -- If marking as confidential, verify team is ELT
  IF NEW.is_confidential = true AND NEW.team_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM teams WHERE id = NEW.team_id AND is_elt = true
    ) THEN
      RAISE EXCEPTION 'Only ELT teams can have confidential items';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to issues
DROP TRIGGER IF EXISTS validate_issue_confidential ON issues;
CREATE TRIGGER validate_issue_confidential
  BEFORE INSERT OR UPDATE OF is_confidential, team_id ON issues
  FOR EACH ROW
  WHEN (NEW.is_confidential = true)
  EXECUTE FUNCTION validate_confidential_elt_only();

-- Apply to headlines
DROP TRIGGER IF EXISTS validate_headline_confidential ON headlines;
CREATE TRIGGER validate_headline_confidential
  BEFORE INSERT OR UPDATE OF is_confidential, team_id ON headlines
  FOR EACH ROW
  WHEN (NEW.is_confidential = true)
  EXECUTE FUNCTION validate_confidential_elt_only();

-- Apply to rocks
DROP TRIGGER IF EXISTS validate_rock_confidential ON rocks;
CREATE TRIGGER validate_rock_confidential
  BEFORE INSERT OR UPDATE OF is_confidential, team_id ON rocks
  FOR EACH ROW
  WHEN (NEW.is_confidential = true)
  EXECUTE FUNCTION validate_confidential_elt_only();
