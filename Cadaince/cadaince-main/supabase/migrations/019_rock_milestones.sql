-- Aicomplice Database Schema
-- Migration 019: Rock Milestones

-- ============================================
-- 1. ROCK MILESTONES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS rock_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rock_id UUID NOT NULL REFERENCES rocks(id) ON DELETE CASCADE,

  -- Milestone details
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,

  -- Status
  status TEXT CHECK (status IN ('not_started', 'in_progress', 'complete', 'blocked'))
    DEFAULT 'not_started',
  completed_at TIMESTAMPTZ,

  -- Ordering
  sort_order INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. ADD MILESTONE COUNTS TO ROCKS
-- ============================================

-- Add cached counts to rocks table for quick progress display
ALTER TABLE rocks ADD COLUMN IF NOT EXISTS milestone_count INTEGER DEFAULT 0;
ALTER TABLE rocks ADD COLUMN IF NOT EXISTS milestones_complete INTEGER DEFAULT 0;

-- ============================================
-- 3. INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_milestones_rock ON rock_milestones(rock_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_milestones_status ON rock_milestones(status);
CREATE INDEX IF NOT EXISTS idx_milestones_due_date ON rock_milestones(due_date);

-- ============================================
-- 4. TRIGGERS
-- ============================================

-- Update rock milestone counts when milestones change
CREATE OR REPLACE FUNCTION update_rock_milestone_counts()
RETURNS TRIGGER AS $$
DECLARE
  v_rock_id UUID;
BEGIN
  -- Get the rock_id
  IF TG_OP = 'DELETE' THEN
    v_rock_id := OLD.rock_id;
  ELSE
    v_rock_id := NEW.rock_id;
  END IF;

  -- Update the counts on the parent rock
  UPDATE rocks
  SET
    milestone_count = (
      SELECT COUNT(*) FROM rock_milestones WHERE rock_id = v_rock_id
    ),
    milestones_complete = (
      SELECT COUNT(*) FROM rock_milestones WHERE rock_id = v_rock_id AND status = 'complete'
    )
  WHERE id = v_rock_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_rock_milestone_counts
  AFTER INSERT OR UPDATE OR DELETE ON rock_milestones
  FOR EACH ROW EXECUTE FUNCTION update_rock_milestone_counts();

-- Updated at trigger for milestones
CREATE TRIGGER update_rock_milestones_updated_at
  BEFORE UPDATE ON rock_milestones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 5. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE rock_milestones ENABLE ROW LEVEL SECURITY;

-- Users can view milestones for rocks in their org
CREATE POLICY "Users can view own org rock milestones"
ON rock_milestones FOR SELECT
USING (
  rock_id IN (
    SELECT id FROM rocks WHERE organization_id = get_current_organization_id()
  )
);

-- Rock owners can manage milestones
CREATE POLICY "Rock owners can manage milestones"
ON rock_milestones FOR ALL
USING (
  rock_id IN (
    SELECT id FROM rocks
    WHERE organization_id = get_current_organization_id()
      AND owner_id = get_current_profile_id()
  )
);

-- ELT can manage all milestones
CREATE POLICY "ELT can manage all org milestones"
ON rock_milestones FOR ALL
USING (
  rock_id IN (
    SELECT id FROM rocks WHERE organization_id = get_current_organization_id()
  )
  AND get_current_access_level() IN ('admin', 'elt')
);

-- ============================================
-- 6. HELPER FUNCTIONS
-- ============================================

-- Get milestones for a rock with progress info
CREATE OR REPLACE FUNCTION get_rock_milestones(p_rock_id UUID)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  due_date DATE,
  status TEXT,
  completed_at TIMESTAMPTZ,
  sort_order INTEGER,
  is_overdue BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    rm.id,
    rm.title,
    rm.description,
    rm.due_date,
    rm.status,
    rm.completed_at,
    rm.sort_order,
    (rm.due_date < CURRENT_DATE AND rm.status != 'complete') as is_overdue,
    rm.created_at,
    rm.updated_at
  FROM rock_milestones rm
  WHERE rm.rock_id = p_rock_id
  ORDER BY rm.sort_order, rm.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reorder milestones
CREATE OR REPLACE FUNCTION reorder_milestones(
  p_rock_id UUID,
  p_milestone_ids UUID[]
)
RETURNS VOID AS $$
DECLARE
  v_order INTEGER := 0;
  v_milestone_id UUID;
BEGIN
  FOREACH v_milestone_id IN ARRAY p_milestone_ids
  LOOP
    UPDATE rock_milestones
    SET sort_order = v_order
    WHERE id = v_milestone_id AND rock_id = p_rock_id;
    v_order := v_order + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Calculate milestone progress percentage
CREATE OR REPLACE FUNCTION get_milestone_progress(p_rock_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_total INTEGER;
  v_complete INTEGER;
  v_in_progress INTEGER;
  v_blocked INTEGER;
  v_not_started INTEGER;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'complete'),
    COUNT(*) FILTER (WHERE status = 'in_progress'),
    COUNT(*) FILTER (WHERE status = 'blocked'),
    COUNT(*) FILTER (WHERE status = 'not_started')
  INTO v_total, v_complete, v_in_progress, v_blocked, v_not_started
  FROM rock_milestones
  WHERE rock_id = p_rock_id;

  RETURN jsonb_build_object(
    'total', v_total,
    'complete', v_complete,
    'in_progress', v_in_progress,
    'blocked', v_blocked,
    'not_started', v_not_started,
    'percentage', CASE WHEN v_total > 0 THEN ROUND(100.0 * v_complete / v_total) ELSE 0 END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
