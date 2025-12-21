-- Aicomplice Database Schema
-- Migration 015: Org Structure, Rock Cascade, Quarters & Issue Escalation

-- ============================================
-- 1. ORG STRUCTURE ENHANCEMENTS
-- ============================================

-- Add eos_seat to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS eos_seat TEXT;

-- Multi-pillar membership (replaces single pillar_id)
CREATE TABLE IF NOT EXISTS team_member_pillars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  team_member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pillar_id UUID NOT NULL REFERENCES pillars(id) ON DELETE CASCADE,

  is_primary BOOLEAN DEFAULT FALSE,
  is_lead BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(team_member_id, pillar_id)
);

CREATE INDEX IF NOT EXISTS idx_tmp_organization ON team_member_pillars(organization_id);
CREATE INDEX IF NOT EXISTS idx_tmp_team_member ON team_member_pillars(team_member_id);
CREATE INDEX IF NOT EXISTS idx_tmp_pillar ON team_member_pillars(pillar_id);
CREATE INDEX IF NOT EXISTS idx_tmp_is_lead ON team_member_pillars(is_lead) WHERE is_lead = true;

-- RLS for team_member_pillars
ALTER TABLE team_member_pillars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org pillar memberships"
ON team_member_pillars FOR SELECT
USING (organization_id = get_current_organization_id());

CREATE POLICY "Admins can manage pillar memberships"
ON team_member_pillars FOR ALL
USING (organization_id = get_current_organization_id() AND get_current_access_level() = 'admin');

-- ============================================
-- 2. QUARTERS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS quarters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),

  year INTEGER NOT NULL,
  quarter INTEGER NOT NULL CHECK (quarter BETWEEN 1 AND 4),

  start_date DATE NOT NULL,
  end_date DATE NOT NULL,

  planning_status TEXT DEFAULT 'upcoming' CHECK (planning_status IN (
    'upcoming', 'planning', 'active', 'completed', 'reviewed'
  )),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, year, quarter)
);

CREATE INDEX IF NOT EXISTS idx_quarters_organization ON quarters(organization_id);
CREATE INDEX IF NOT EXISTS idx_quarters_status ON quarters(planning_status);
CREATE INDEX IF NOT EXISTS idx_quarters_dates ON quarters(start_date, end_date);

ALTER TABLE quarters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org quarters"
ON quarters FOR SELECT
USING (organization_id = get_current_organization_id());

CREATE POLICY "ELT can manage quarters"
ON quarters FOR ALL
USING (
  organization_id = get_current_organization_id()
  AND get_current_access_level() IN ('admin', 'elt')
);

CREATE TRIGGER update_quarters_updated_at
  BEFORE UPDATE ON quarters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 3. ROCK CASCADE EXTENSIONS
-- ============================================

-- Add cascade fields to rocks
ALTER TABLE rocks ADD COLUMN IF NOT EXISTS rock_level TEXT
  CHECK (rock_level IN ('company', 'pillar', 'individual'))
  DEFAULT 'company';
ALTER TABLE rocks ADD COLUMN IF NOT EXISTS parent_rock_id UUID REFERENCES rocks(id);
ALTER TABLE rocks ADD COLUMN IF NOT EXISTS pillar_id UUID REFERENCES pillars(id);
ALTER TABLE rocks ADD COLUMN IF NOT EXISTS quarter_id UUID REFERENCES quarters(id);

-- Update existing rocks to have rock_level = 'company' if null
UPDATE rocks SET rock_level = 'company' WHERE rock_level IS NULL;

CREATE INDEX IF NOT EXISTS idx_rocks_level ON rocks(rock_level);
CREATE INDEX IF NOT EXISTS idx_rocks_parent ON rocks(parent_rock_id);
CREATE INDEX IF NOT EXISTS idx_rocks_pillar ON rocks(pillar_id);
CREATE INDEX IF NOT EXISTS idx_rocks_quarter ON rocks(quarter_id);

-- ============================================
-- 4. ISSUE ESCALATION EXTENSIONS
-- ============================================

-- Add owner_id and created_by to issues if not exists
ALTER TABLE issues ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES profiles(id);
ALTER TABLE issues ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id);
ALTER TABLE issues ADD COLUMN IF NOT EXISTS linked_rock_id UUID REFERENCES rocks(id);

-- Add escalation fields to issues
ALTER TABLE issues ADD COLUMN IF NOT EXISTS issue_level TEXT
  CHECK (issue_level IN ('individual', 'pillar', 'company'))
  DEFAULT 'company';
ALTER TABLE issues ADD COLUMN IF NOT EXISTS pillar_id UUID REFERENCES pillars(id);
ALTER TABLE issues ADD COLUMN IF NOT EXISTS originated_in_meeting_id UUID;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS escalated_from_id UUID REFERENCES issues(id);
ALTER TABLE issues ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS escalated_by_id UUID REFERENCES profiles(id);
ALTER TABLE issues ADD COLUMN IF NOT EXISTS resolved_in_meeting_id UUID;

CREATE INDEX IF NOT EXISTS idx_issues_level ON issues(issue_level);
CREATE INDEX IF NOT EXISTS idx_issues_pillar ON issues(pillar_id);
CREATE INDEX IF NOT EXISTS idx_issues_owner ON issues(owner_id);
CREATE INDEX IF NOT EXISTS idx_issues_escalated_from ON issues(escalated_from_id);

-- ============================================
-- 5. ANALYTICS VIEWS
-- ============================================

-- Company rock analytics with cascade metrics
CREATE OR REPLACE VIEW company_rock_analytics AS
SELECT
  cr.id,
  cr.title,
  cr.status,
  cr.owner_id,
  cr.quarter_id,
  cr.organization_id,
  cr.due_date,
  cr.description,

  -- Pillar rock counts
  COUNT(DISTINCT pr.id) as pillar_rock_count,
  COUNT(DISTINCT pr.id) FILTER (WHERE pr.status = 'on_track') as pillar_rocks_on_track,
  COUNT(DISTINCT pr.id) FILTER (WHERE pr.status = 'off_track') as pillar_rocks_off_track,
  COUNT(DISTINCT pr.id) FILTER (WHERE pr.status = 'at_risk') as pillar_rocks_at_risk,
  COUNT(DISTINCT pr.id) FILTER (WHERE pr.status = 'complete') as pillar_rocks_complete,

  -- Individual rock counts
  COUNT(DISTINCT ir.id) as individual_rock_count,
  COUNT(DISTINCT ir.id) FILTER (WHERE ir.status = 'on_track') as individual_rocks_on_track,
  COUNT(DISTINCT ir.id) FILTER (WHERE ir.status = 'off_track') as individual_rocks_off_track,
  COUNT(DISTINCT ir.id) FILTER (WHERE ir.status = 'at_risk') as individual_rocks_at_risk,
  COUNT(DISTINCT ir.id) FILTER (WHERE ir.status = 'complete') as individual_rocks_complete,

  -- Team coverage
  COUNT(DISTINCT ir.owner_id) as team_members_with_rocks,
  COUNT(DISTINCT pr.pillar_id) as pillars_involved,
  ARRAY_AGG(DISTINCT p.name) FILTER (WHERE p.name IS NOT NULL) as pillar_names

FROM rocks cr
LEFT JOIN rocks pr ON pr.parent_rock_id = cr.id AND pr.rock_level = 'pillar'
LEFT JOIN rocks ir ON ir.parent_rock_id = pr.id AND ir.rock_level = 'individual'
LEFT JOIN pillars p ON pr.pillar_id = p.id
WHERE cr.rock_level = 'company'
GROUP BY cr.id, cr.title, cr.status, cr.owner_id, cr.quarter_id, cr.organization_id, cr.due_date, cr.description;

-- Team rock coverage per company rock
CREATE OR REPLACE VIEW company_rock_team_coverage AS
WITH org_team_counts AS (
  SELECT organization_id, COUNT(*) as total
  FROM profiles
  WHERE status = 'active' AND access_level IN ('admin', 'elt', 'slt')
  GROUP BY organization_id
)
SELECT
  cr.id as company_rock_id,
  cr.title as company_rock_title,
  cr.organization_id,
  cr.quarter_id,
  otc.total as total_team_members,
  COUNT(DISTINCT ir.owner_id) as members_supporting,
  ROUND(
    100.0 * COUNT(DISTINCT ir.owner_id) / NULLIF(otc.total, 0),
    1
  ) as support_percentage
FROM rocks cr
JOIN org_team_counts otc ON otc.organization_id = cr.organization_id
LEFT JOIN rocks pr ON pr.parent_rock_id = cr.id AND pr.rock_level = 'pillar'
LEFT JOIN rocks ir ON ir.parent_rock_id = pr.id AND ir.rock_level = 'individual'
WHERE cr.rock_level = 'company'
GROUP BY cr.id, cr.title, cr.organization_id, cr.quarter_id, otc.total;

-- Pillar health view
CREATE OR REPLACE VIEW pillar_health AS
SELECT
  p.id as pillar_id,
  p.name as pillar_name,
  p.organization_id,
  p.color,

  -- Team size
  COUNT(DISTINCT tmp.team_member_id) as team_size,
  COUNT(DISTINCT tmp.team_member_id) FILTER (WHERE tmp.is_lead) as lead_count,

  -- Rock counts
  COUNT(DISTINCT r.id) FILTER (WHERE r.rock_level = 'pillar') as pillar_rocks,
  COUNT(DISTINCT r.id) FILTER (WHERE r.rock_level = 'individual') as individual_rocks,
  COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'on_track') as rocks_on_track,
  COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'off_track') as rocks_off_track,
  COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'at_risk') as rocks_at_risk,
  COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'complete') as rocks_complete,

  -- Issue counts
  COUNT(DISTINCT i.id) as total_issues,
  COUNT(DISTINCT i.id) FILTER (WHERE i.status IN ('detected', 'prioritized')) as open_issues

FROM pillars p
LEFT JOIN team_member_pillars tmp ON tmp.pillar_id = p.id
LEFT JOIN rocks r ON r.pillar_id = p.id
LEFT JOIN issues i ON i.pillar_id = p.id
GROUP BY p.id, p.name, p.organization_id, p.color;

-- ============================================
-- 6. HELPER FUNCTIONS
-- ============================================

-- Get rock ancestors (parent chain up to company rock)
CREATE OR REPLACE FUNCTION get_rock_ancestors(p_rock_id UUID)
RETURNS TABLE (
  id UUID,
  title TEXT,
  rock_level TEXT,
  parent_rock_id UUID,
  depth INTEGER
) AS $$
  WITH RECURSIVE ancestors AS (
    -- Base case: the rock itself
    SELECT r.id, r.title, r.rock_level, r.parent_rock_id, 0 as depth
    FROM rocks r
    WHERE r.id = p_rock_id

    UNION ALL

    -- Recursive case: parent rocks
    SELECT r.id, r.title, r.rock_level, r.parent_rock_id, a.depth + 1
    FROM rocks r
    JOIN ancestors a ON r.id = a.parent_rock_id
  )
  SELECT * FROM ancestors
  ORDER BY depth DESC;
$$ LANGUAGE SQL SECURITY DEFINER;

-- Get rock descendants (all children down to individual)
CREATE OR REPLACE FUNCTION get_rock_descendants(p_rock_id UUID)
RETURNS TABLE (
  id UUID,
  title TEXT,
  rock_level TEXT,
  status TEXT,
  owner_id UUID,
  parent_rock_id UUID,
  depth INTEGER
) AS $$
  WITH RECURSIVE descendants AS (
    -- Base case: direct children
    SELECT r.id, r.title, r.rock_level, r.status, r.owner_id, r.parent_rock_id, 1 as depth
    FROM rocks r
    WHERE r.parent_rock_id = p_rock_id

    UNION ALL

    -- Recursive case: children of children
    SELECT r.id, r.title, r.rock_level, r.status, r.owner_id, r.parent_rock_id, d.depth + 1
    FROM rocks r
    JOIN descendants d ON r.parent_rock_id = d.id
  )
  SELECT * FROM descendants
  ORDER BY depth, title;
$$ LANGUAGE SQL SECURITY DEFINER;

-- Get current quarter for an organization
CREATE OR REPLACE FUNCTION get_current_quarter(p_organization_id UUID)
RETURNS quarters AS $$
  SELECT * FROM quarters
  WHERE organization_id = p_organization_id
  AND planning_status = 'active'
  ORDER BY year DESC, quarter DESC
  LIMIT 1
$$ LANGUAGE SQL SECURITY DEFINER;

-- Calculate cascade health for a company rock
CREATE OR REPLACE FUNCTION calculate_cascade_health(p_rock_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'company_rock', jsonb_build_object(
      'id', cr.id,
      'title', cr.title,
      'status', cr.status
    ),
    'pillar_rocks', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', pr.id,
        'title', pr.title,
        'status', pr.status,
        'pillar_name', pil.name,
        'individual_count', (
          SELECT COUNT(*) FROM rocks ir
          WHERE ir.parent_rock_id = pr.id AND ir.rock_level = 'individual'
        )
      )), '[]'::jsonb)
      FROM rocks pr
      LEFT JOIN pillars pil ON pr.pillar_id = pil.id
      WHERE pr.parent_rock_id = cr.id AND pr.rock_level = 'pillar'
    ),
    'stats', jsonb_build_object(
      'total_pillar_rocks', (SELECT COUNT(*) FROM rocks WHERE parent_rock_id = cr.id AND rock_level = 'pillar'),
      'total_individual_rocks', (
        SELECT COUNT(*) FROM rocks ir
        WHERE ir.rock_level = 'individual'
        AND ir.parent_rock_id IN (SELECT id FROM rocks WHERE parent_rock_id = cr.id AND rock_level = 'pillar')
      ),
      'on_track_percentage', (
        SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'on_track') / NULLIF(COUNT(*), 0), 1)
        FROM rocks
        WHERE parent_rock_id = cr.id OR parent_rock_id IN (SELECT id FROM rocks WHERE parent_rock_id = cr.id)
      )
    )
  ) INTO v_result
  FROM rocks cr
  WHERE cr.id = p_rock_id AND cr.rock_level = 'company';

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
