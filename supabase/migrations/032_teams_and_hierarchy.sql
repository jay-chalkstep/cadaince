-- Team Cascade & Hierarchy: Core teams table and hierarchy support
-- Teams are derived from Accountability Chart seats, not manually created

-- Teams table (derived from Accountability Chart seats)
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  anchor_seat_id UUID REFERENCES seats(id) NOT NULL UNIQUE,
  parent_team_id UUID REFERENCES teams(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 4),
  is_elt BOOLEAN DEFAULT false,
  l10_required BOOLEAN NOT NULL DEFAULT true,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, slug)
);

CREATE INDEX idx_teams_organization ON teams(organization_id);
CREATE INDEX idx_teams_parent ON teams(parent_team_id);
CREATE INDEX idx_teams_anchor_seat ON teams(anchor_seat_id);
CREATE INDEX idx_teams_level ON teams(organization_id, level);

-- Team membership computed view (from seat hierarchy)
-- This computes team membership by walking down from each team's anchor seat
-- Note: seat_assignments uses team_member_id which references profiles(id)
CREATE OR REPLACE VIEW team_memberships AS
WITH RECURSIVE seat_descendants AS (
  -- Base: direct seat assignments for team's anchor seat
  SELECT
    t.id AS team_id,
    t.organization_id,
    sa.team_member_id AS profile_id,
    t.anchor_seat_id AS root_seat_id,
    sa.seat_id,
    true AS is_lead,
    0 AS depth
  FROM teams t
  JOIN seat_assignments sa ON sa.seat_id = t.anchor_seat_id

  UNION ALL

  -- Recursive: descendants of anchor seat
  SELECT
    sd.team_id,
    sd.organization_id,
    sa.team_member_id AS profile_id,
    sd.root_seat_id,
    s.id AS seat_id,
    false AS is_lead,
    sd.depth + 1
  FROM seat_descendants sd
  JOIN seats s ON s.parent_seat_id = sd.seat_id
  JOIN seat_assignments sa ON sa.seat_id = s.id
  WHERE sd.depth < 10  -- Prevent infinite recursion
)
SELECT DISTINCT
  team_id,
  organization_id,
  profile_id,
  is_lead
FROM seat_descendants;

-- Add team_id and cascade fields to existing tables
ALTER TABLE rocks ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id);
ALTER TABLE rocks ADD COLUMN IF NOT EXISTS parent_rock_id UUID REFERENCES rocks(id);
ALTER TABLE rocks ADD COLUMN IF NOT EXISTS is_confidential BOOLEAN DEFAULT false;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id);
ALTER TABLE issues ADD COLUMN IF NOT EXISTS is_confidential BOOLEAN DEFAULT false;
ALTER TABLE todos ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id);
ALTER TABLE headlines ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id);
ALTER TABLE headlines ADD COLUMN IF NOT EXISTS is_confidential BOOLEAN DEFAULT false;
ALTER TABLE l10_meetings ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id);

-- Indexes for team scoping and rock cascade
CREATE INDEX IF NOT EXISTS idx_rocks_team ON rocks(team_id);
CREATE INDEX IF NOT EXISTS idx_rocks_parent ON rocks(parent_rock_id);
CREATE INDEX IF NOT EXISTS idx_issues_team ON issues(team_id);
CREATE INDEX IF NOT EXISTS idx_todos_team ON todos(team_id);
CREATE INDEX IF NOT EXISTS idx_headlines_team ON headlines(team_id);
CREATE INDEX IF NOT EXISTS idx_l10_meetings_team ON l10_meetings(team_id);

-- Individual goals (Level 4, below rocks)
CREATE TABLE individual_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  team_id UUID REFERENCES teams(id) NOT NULL,
  rock_id UUID REFERENCES rocks(id),
  owner_id UUID REFERENCES profiles(id) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  target_value NUMERIC,
  current_value NUMERIC,
  unit TEXT,
  due_date DATE,
  status TEXT DEFAULT 'on_track' CHECK (status IN ('on_track', 'off_track', 'complete')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_individual_goals_team ON individual_goals(team_id);
CREATE INDEX idx_individual_goals_owner ON individual_goals(owner_id);
CREATE INDEX idx_individual_goals_rock ON individual_goals(rock_id);
CREATE INDEX idx_individual_goals_organization ON individual_goals(organization_id);

-- Team hierarchy helper function: get all ancestors of a team
CREATE OR REPLACE FUNCTION get_team_ancestors(p_team_id UUID)
RETURNS TABLE(team_id UUID, level INTEGER, distance INTEGER) AS $$
WITH RECURSIVE ancestors AS (
  SELECT id, parent_team_id, level, 0 AS distance
  FROM teams WHERE id = p_team_id

  UNION ALL

  SELECT t.id, t.parent_team_id, t.level, a.distance + 1
  FROM teams t
  JOIN ancestors a ON t.id = a.parent_team_id
)
SELECT id AS team_id, level, distance FROM ancestors;
$$ LANGUAGE SQL STABLE;

-- Team hierarchy helper function: get all descendants of a team
CREATE OR REPLACE FUNCTION get_team_descendants(p_team_id UUID)
RETURNS TABLE(team_id UUID, level INTEGER, distance INTEGER) AS $$
WITH RECURSIVE descendants AS (
  SELECT id, level, 0 AS distance
  FROM teams WHERE id = p_team_id

  UNION ALL

  SELECT t.id, t.level, d.distance + 1
  FROM teams t
  JOIN descendants d ON t.parent_team_id = d.id
  WHERE d.distance < 10
)
SELECT id AS team_id, level, distance FROM descendants;
$$ LANGUAGE SQL STABLE;
