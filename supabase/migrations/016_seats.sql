-- Aicomplice Database Schema
-- Migration 016: Accountability Chart (Seats & Assignments)

-- ============================================
-- 1. SEATS TABLE
-- ============================================

-- Seats represent roles, not people (a seat can be empty or have multiple people)
CREATE TABLE IF NOT EXISTS seats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Seat definition
  name TEXT NOT NULL,                              -- "VP of Sales", "Integrator"
  pillar_id UUID REFERENCES pillars(id) ON DELETE SET NULL, -- Which functional area
  parent_seat_id UUID REFERENCES seats(id) ON DELETE SET NULL, -- Reports to (for hierarchy)

  -- EOS seat components (roles/responsibilities)
  roles TEXT[] DEFAULT '{}',                       -- Array of role responsibilities

  -- GWC indicators (Gets it, Wants it, Capacity)
  core_values_match BOOLEAN DEFAULT true,
  gets_it BOOLEAN DEFAULT true,
  wants_it BOOLEAN DEFAULT true,
  capacity_to_do BOOLEAN DEFAULT true,

  -- Display/positioning
  position_x INTEGER DEFAULT 0,                    -- For drag positioning
  position_y INTEGER DEFAULT 0,
  color TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_seats_organization ON seats(organization_id);
CREATE INDEX IF NOT EXISTS idx_seats_parent ON seats(parent_seat_id);
CREATE INDEX IF NOT EXISTS idx_seats_pillar ON seats(pillar_id);

-- Updated at trigger
CREATE TRIGGER update_seats_updated_at
  BEFORE UPDATE ON seats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 2. SEAT ASSIGNMENTS TABLE
-- ============================================

-- Junction table: who fills which seat(s)
CREATE TABLE IF NOT EXISTS seat_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seat_id UUID NOT NULL REFERENCES seats(id) ON DELETE CASCADE,
  team_member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT true,                 -- Primary vs backup/shared
  assigned_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(seat_id, team_member_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_seat_assignments_seat ON seat_assignments(seat_id);
CREATE INDEX IF NOT EXISTS idx_seat_assignments_member ON seat_assignments(team_member_id);

-- ============================================
-- 3. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE seat_assignments ENABLE ROW LEVEL SECURITY;

-- Seats: Users can view own org seats
CREATE POLICY "Users can view own org seats"
ON seats FOR SELECT
USING (organization_id = get_current_organization_id());

-- Seats: Admins and ELT can manage seats
CREATE POLICY "Admins and ELT can manage seats"
ON seats FOR ALL
USING (
  organization_id = get_current_organization_id()
  AND get_current_access_level() IN ('admin', 'elt')
);

-- Seat Assignments: Users can view seat assignments in their org
CREATE POLICY "Users can view own org seat assignments"
ON seat_assignments FOR SELECT
USING (
  seat_id IN (
    SELECT id FROM seats WHERE organization_id = get_current_organization_id()
  )
);

-- Seat Assignments: Admins and ELT can manage assignments
CREATE POLICY "Admins and ELT can manage seat assignments"
ON seat_assignments FOR ALL
USING (
  seat_id IN (
    SELECT id FROM seats WHERE organization_id = get_current_organization_id()
  )
  AND get_current_access_level() IN ('admin', 'elt')
);

-- ============================================
-- 4. HELPER FUNCTIONS
-- ============================================

-- Get seat hierarchy (all ancestors up to root)
CREATE OR REPLACE FUNCTION get_seat_ancestors(p_seat_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  parent_seat_id UUID,
  depth INTEGER
) AS $$
  WITH RECURSIVE ancestors AS (
    -- Base case: the seat itself
    SELECT s.id, s.name, s.parent_seat_id, 0 as depth
    FROM seats s
    WHERE s.id = p_seat_id

    UNION ALL

    -- Recursive case: parent seats
    SELECT s.id, s.name, s.parent_seat_id, a.depth + 1
    FROM seats s
    JOIN ancestors a ON s.id = a.parent_seat_id
  )
  SELECT * FROM ancestors
  ORDER BY depth DESC;
$$ LANGUAGE SQL SECURITY DEFINER;

-- Get seat descendants (all children down to leaf nodes)
CREATE OR REPLACE FUNCTION get_seat_descendants(p_seat_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  parent_seat_id UUID,
  depth INTEGER
) AS $$
  WITH RECURSIVE descendants AS (
    -- Base case: direct children
    SELECT s.id, s.name, s.parent_seat_id, 1 as depth
    FROM seats s
    WHERE s.parent_seat_id = p_seat_id

    UNION ALL

    -- Recursive case: children of children
    SELECT s.id, s.name, s.parent_seat_id, d.depth + 1
    FROM seats s
    JOIN descendants d ON s.parent_seat_id = d.id
  )
  SELECT * FROM descendants
  ORDER BY depth, name;
$$ LANGUAGE SQL SECURITY DEFINER;

-- Get full org chart for an organization (hierarchical)
CREATE OR REPLACE FUNCTION get_org_chart(p_organization_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  parent_seat_id UUID,
  pillar_id UUID,
  pillar_name TEXT,
  roles TEXT[],
  gets_it BOOLEAN,
  wants_it BOOLEAN,
  capacity_to_do BOOLEAN,
  core_values_match BOOLEAN,
  color TEXT,
  position_x INTEGER,
  position_y INTEGER,
  assignees JSONB,
  depth INTEGER
) AS $$
  WITH RECURSIVE org_tree AS (
    -- Base case: root seats (no parent)
    SELECT
      s.id,
      s.name,
      s.parent_seat_id,
      s.pillar_id,
      p.name as pillar_name,
      s.roles,
      s.gets_it,
      s.wants_it,
      s.capacity_to_do,
      s.core_values_match,
      s.color,
      s.position_x,
      s.position_y,
      0 as depth
    FROM seats s
    LEFT JOIN pillars p ON s.pillar_id = p.id
    WHERE s.organization_id = p_organization_id
      AND s.parent_seat_id IS NULL

    UNION ALL

    -- Recursive case: child seats
    SELECT
      s.id,
      s.name,
      s.parent_seat_id,
      s.pillar_id,
      p.name as pillar_name,
      s.roles,
      s.gets_it,
      s.wants_it,
      s.capacity_to_do,
      s.core_values_match,
      s.color,
      s.position_x,
      s.position_y,
      ot.depth + 1
    FROM seats s
    LEFT JOIN pillars p ON s.pillar_id = p.id
    JOIN org_tree ot ON s.parent_seat_id = ot.id
  )
  SELECT
    ot.id,
    ot.name,
    ot.parent_seat_id,
    ot.pillar_id,
    ot.pillar_name,
    ot.roles,
    ot.gets_it,
    ot.wants_it,
    ot.capacity_to_do,
    ot.core_values_match,
    ot.color,
    ot.position_x,
    ot.position_y,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', pr.id,
            'full_name', pr.full_name,
            'avatar_url', pr.avatar_url,
            'is_primary', sa.is_primary
          )
        )
        FROM seat_assignments sa
        JOIN profiles pr ON sa.team_member_id = pr.id
        WHERE sa.seat_id = ot.id
      ),
      '[]'::jsonb
    ) as assignees,
    ot.depth
  FROM org_tree ot
  ORDER BY ot.depth, ot.name;
$$ LANGUAGE SQL SECURITY DEFINER;
