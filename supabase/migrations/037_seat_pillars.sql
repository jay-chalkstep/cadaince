-- Aicomplice Database Schema
-- Migration 037: Multi-Pillar Support for Seats
-- Enables seats to belong to multiple pillars (e.g., COO in Executive + Operations)

-- ============================================
-- 1. SEAT_PILLARS JUNCTION TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS seat_pillars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seat_id UUID NOT NULL REFERENCES seats(id) ON DELETE CASCADE,
  pillar_id UUID NOT NULL REFERENCES pillars(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(seat_id, pillar_id)
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_seat_pillars_seat ON seat_pillars(seat_id);
CREATE INDEX IF NOT EXISTS idx_seat_pillars_pillar ON seat_pillars(pillar_id);
CREATE INDEX IF NOT EXISTS idx_seat_pillars_primary ON seat_pillars(seat_id) WHERE is_primary = true;

-- ============================================
-- 2. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE seat_pillars ENABLE ROW LEVEL SECURITY;

-- Users can view seat pillars for their organization
CREATE POLICY "Users can view own org seat pillars"
ON seat_pillars FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM seats s
    WHERE s.id = seat_pillars.seat_id
    AND s.organization_id = get_current_organization_id()
  )
);

-- Admins and ELT can manage seat pillars
CREATE POLICY "Admins and ELT can manage seat pillars"
ON seat_pillars FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM seats s
    WHERE s.id = seat_pillars.seat_id
    AND s.organization_id = get_current_organization_id()
  )
  AND get_current_access_level() IN ('admin', 'elt')
);

-- ============================================
-- 3. MIGRATE EXISTING DATA
-- ============================================

-- Migrate existing pillar_id data to the junction table
-- Existing pillar associations become primary pillars
INSERT INTO seat_pillars (seat_id, pillar_id, is_primary)
SELECT id, pillar_id, true
FROM seats
WHERE pillar_id IS NOT NULL
ON CONFLICT (seat_id, pillar_id) DO NOTHING;

-- ============================================
-- 4. HELPER FUNCTION
-- ============================================

-- Function to ensure only one primary pillar per seat
CREATE OR REPLACE FUNCTION ensure_single_primary_pillar()
RETURNS TRIGGER AS $$
BEGIN
  -- If setting a pillar as primary, unset any existing primary for this seat
  IF NEW.is_primary = true THEN
    UPDATE seat_pillars
    SET is_primary = false
    WHERE seat_id = NEW.seat_id
      AND id != NEW.id
      AND is_primary = true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to maintain single primary pillar constraint
CREATE TRIGGER ensure_single_primary_pillar_trigger
  BEFORE INSERT OR UPDATE ON seat_pillars
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_primary_pillar();

-- ============================================
-- 5. UPDATE GET_ORG_CHART FUNCTION
-- ============================================

-- Drop existing function first (return type changed to include pillars)
DROP FUNCTION IF EXISTS get_org_chart(UUID);

-- Update the get_org_chart function to include all pillars
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
  pillars JSONB,
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
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', pil.id,
            'name', pil.name,
            'color', pil.color,
            'is_primary', sp.is_primary
          )
          ORDER BY sp.is_primary DESC, pil.name ASC
        )
        FROM seat_pillars sp
        JOIN pillars pil ON sp.pillar_id = pil.id
        WHERE sp.seat_id = ot.id
      ),
      '[]'::jsonb
    ) as pillars,
    ot.depth
  FROM org_tree ot
  ORDER BY ot.depth, ot.name;
$$ LANGUAGE SQL SECURITY DEFINER;

-- ============================================
-- 6. DEPRECATION NOTE
-- ============================================

-- Mark legacy column as deprecated (keep for backward compat)
COMMENT ON COLUMN seats.pillar_id IS 'DEPRECATED: Use seat_pillars junction table for multi-pillar support. This column is maintained for backward compatibility.';
