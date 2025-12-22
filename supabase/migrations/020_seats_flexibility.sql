-- Migration: 020_seats_flexibility.sql
-- Purpose: Extend rigid EOS hierarchy to support modern org structures
-- Part A: Functions Library
-- Part B: Seat Flexibility (units, co-holders, dotted-lines)

-- =====================
-- PART A: FUNCTIONS LIBRARY
-- =====================

-- Functions are assignable responsibilities (not tied to seat types)
CREATE TABLE seat_functions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  name TEXT NOT NULL,                    -- "Culture", "P&L", "20 Ideas"
  description TEXT,

  -- Categorization (for filtering/grouping, not enforcement)
  category TEXT,                         -- "visionary", "integrator", "operations", etc.

  -- Origin tracking
  is_eos_default BOOLEAN DEFAULT false,  -- From standard EOS list
  is_custom BOOLEAN DEFAULT false,       -- Created by this org

  -- Visibility (EOS defaults can be hidden but not deleted)
  is_hidden BOOLEAN DEFAULT false,

  -- Display
  icon TEXT,                             -- Optional icon identifier
  sort_order INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_seat_functions_org ON seat_functions(organization_id);
CREATE INDEX idx_seat_functions_category ON seat_functions(organization_id, category);

-- RLS for seat_functions
ALTER TABLE seat_functions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org functions"
ON seat_functions FOR SELECT
USING (
  organization_id = get_current_organization_id()
);

CREATE POLICY "Admins and ELT can manage functions"
ON seat_functions FOR ALL
USING (
  get_current_access_level() IN ('admin', 'elt')
);

-- Junction: which functions are assigned to which seats
CREATE TABLE seat_function_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seat_id UUID NOT NULL REFERENCES seats(id) ON DELETE CASCADE,
  function_id UUID NOT NULL REFERENCES seat_functions(id) ON DELETE CASCADE,

  -- How this seat relates to this function
  assignment_type TEXT CHECK (assignment_type IN ('primary', 'shared', 'supporting'))
    DEFAULT 'primary',

  sort_order INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(seat_id, function_id)
);

CREATE INDEX idx_function_assignments_seat ON seat_function_assignments(seat_id);
CREATE INDEX idx_function_assignments_function ON seat_function_assignments(function_id);

-- RLS for seat_function_assignments (inherits from seat ownership)
ALTER TABLE seat_function_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org function assignments"
ON seat_function_assignments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM seats s
    WHERE s.id = seat_function_assignments.seat_id
    AND s.organization_id = get_current_organization_id()
  )
);

CREATE POLICY "Admins and ELT can manage function assignments"
ON seat_function_assignments FOR ALL
USING (
  get_current_access_level() IN ('admin', 'elt')
);

-- Trigger for updated_at on seat_functions
CREATE TRIGGER update_seat_functions_updated_at
  BEFORE UPDATE ON seat_functions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================
-- PART B: SEAT FLEXIBILITY
-- =====================

-- 1. Add seat_type to distinguish units from single seats
ALTER TABLE seats ADD COLUMN IF NOT EXISTS seat_type TEXT
  CHECK (seat_type IN ('single', 'unit'))
  DEFAULT 'single';

-- 2. Add optional EOS role tags (not structural, just metadata)
ALTER TABLE seats ADD COLUMN IF NOT EXISTS eos_role TEXT
  CHECK (eos_role IN ('visionary', 'integrator', 'leader'));

-- 3. Add display preferences for units
ALTER TABLE seats ADD COLUMN IF NOT EXISTS display_as_unit BOOLEAN DEFAULT false;

-- 4. Enhance seat_assignments for co-leadership
ALTER TABLE seat_assignments ADD COLUMN IF NOT EXISTS assignment_type TEXT
  CHECK (assignment_type IN ('holder', 'co-holder', 'backup', 'fractional', 'dotted-line'))
  DEFAULT 'holder';

-- 5. Add dotted-line relationships (reports to multiple seats)
CREATE TABLE IF NOT EXISTS seat_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  from_seat_id UUID NOT NULL REFERENCES seats(id) ON DELETE CASCADE,
  to_seat_id UUID NOT NULL REFERENCES seats(id) ON DELETE CASCADE,
  relationship_type TEXT CHECK (relationship_type IN ('dotted-line', 'advisory', 'collaboration')) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(from_seat_id, to_seat_id, relationship_type)
);

CREATE INDEX idx_seat_relationships_org ON seat_relationships(organization_id);
CREATE INDEX idx_seat_relationships_from ON seat_relationships(from_seat_id);
CREATE INDEX idx_seat_relationships_to ON seat_relationships(to_seat_id);

-- RLS for seat_relationships
ALTER TABLE seat_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org relationships"
ON seat_relationships FOR SELECT
USING (
  organization_id = get_current_organization_id()
);

CREATE POLICY "Admins and ELT can manage relationships"
ON seat_relationships FOR ALL
USING (
  get_current_access_level() IN ('admin', 'elt')
);

-- =====================
-- SEED EOS DEFAULT FUNCTIONS
-- =====================

-- Create a function to seed defaults for a specific organization
CREATE OR REPLACE FUNCTION seed_eos_default_functions(org_id UUID)
RETURNS void AS $$
BEGIN
  -- Visionary functions
  INSERT INTO seat_functions (organization_id, name, category, is_eos_default, description, sort_order)
  VALUES
    (org_id, '20 Ideas', 'visionary', true, 'Generate new ideas and possibilities', 1),
    (org_id, 'Creativity/Problem Solving', 'visionary', true, 'Creative solutions to big challenges', 2),
    (org_id, 'Big Relationships', 'visionary', true, 'Key external relationships and partnerships', 3),
    (org_id, 'Culture', 'visionary', true, 'Define and protect company culture', 4),
    (org_id, 'Research & Development', 'visionary', true, 'Future product and market direction', 5)
  ON CONFLICT DO NOTHING;

  -- Integrator functions
  INSERT INTO seat_functions (organization_id, name, category, is_eos_default, description, sort_order)
  VALUES
    (org_id, 'Lead, Manage, Accountability', 'integrator', true, 'LMA for direct reports', 10),
    (org_id, 'Profit & Loss', 'integrator', true, 'Business plan and financial performance', 11),
    (org_id, 'Remove Obstacles', 'integrator', true, 'Clear barriers for the team', 12),
    (org_id, 'Special Projects', 'integrator', true, 'Cross-functional initiatives', 13),
    (org_id, 'Core Processes', 'integrator', true, 'Document and maintain the Way', 14)
  ON CONFLICT DO NOTHING;

  -- Growth functions
  INSERT INTO seat_functions (organization_id, name, category, is_eos_default, description, sort_order)
  VALUES
    (org_id, 'Sales/Revenue Goal', 'growth', true, 'Hit revenue targets', 20),
    (org_id, 'Selling', 'growth', true, 'Direct sales execution', 21),
    (org_id, 'Marketing', 'growth', true, 'Demand generation and brand', 22)
  ON CONFLICT DO NOTHING;

  -- Customer functions
  INSERT INTO seat_functions (organization_id, name, category, is_eos_default, description, sort_order)
  VALUES
    (org_id, 'Customer Service', 'customer', true, 'Customer support and satisfaction', 30)
  ON CONFLICT DO NOTHING;

  -- Operations functions
  INSERT INTO seat_functions (organization_id, name, category, is_eos_default, description, sort_order)
  VALUES
    (org_id, 'Process Management', 'operations', true, 'Operational process ownership', 40),
    (org_id, 'Making the Product', 'operations', true, 'Product/service delivery', 41)
  ON CONFLICT DO NOTHING;

  -- Finance functions
  INSERT INTO seat_functions (organization_id, name, category, is_eos_default, description, sort_order)
  VALUES
    (org_id, 'AR/AP', 'finance', true, 'Accounts receivable and payable', 50),
    (org_id, 'Budgeting', 'finance', true, 'Financial planning and budgets', 51),
    (org_id, 'Reporting', 'finance', true, 'Financial and operational reporting', 52),
    (org_id, 'HR/Admin', 'finance', true, 'Human resources and administration', 53),
    (org_id, 'IT', 'finance', true, 'Technology infrastructure', 54)
  ON CONFLICT DO NOTHING;

  -- Modern additions (not traditional EOS)
  INSERT INTO seat_functions (organization_id, name, category, is_eos_default, description, sort_order)
  VALUES
    (org_id, 'Product Strategy', 'product', true, 'Product vision and roadmap', 60),
    (org_id, 'Engineering', 'product', true, 'Technical execution and architecture', 61),
    (org_id, 'Design', 'product', true, 'User experience and design systems', 62),
    (org_id, 'Data & Analytics', 'operations', true, 'Data infrastructure and insights', 63),
    (org_id, 'Compliance', 'operations', true, 'Regulatory and compliance management', 64)
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Seed EOS defaults for all existing organizations
DO $$
DECLARE
  org RECORD;
BEGIN
  FOR org IN SELECT id FROM organizations LOOP
    PERFORM seed_eos_default_functions(org.id);
  END LOOP;
END $$;

-- Trigger to seed defaults for new organizations
CREATE OR REPLACE FUNCTION trigger_seed_eos_functions()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM seed_eos_default_functions(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_organization_created_seed_functions
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION trigger_seed_eos_functions();

-- =====================
-- HELPER VIEWS
-- =====================

-- View to get seats with their assigned functions
CREATE OR REPLACE VIEW seats_with_functions AS
SELECT
  s.*,
  COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', sf.id,
        'name', sf.name,
        'category', sf.category,
        'description', sf.description,
        'assignment_type', sfa.assignment_type,
        'sort_order', sfa.sort_order
      ) ORDER BY sfa.sort_order, sf.name
    ) FILTER (WHERE sf.id IS NOT NULL),
    '[]'::jsonb
  ) AS functions
FROM seats s
LEFT JOIN seat_function_assignments sfa ON s.id = sfa.seat_id
LEFT JOIN seat_functions sf ON sfa.function_id = sf.id AND sf.is_hidden = false
GROUP BY s.id;

-- Update the existing get_org_chart function to include new fields
CREATE OR REPLACE FUNCTION get_org_chart(p_organization_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  parent_seat_id UUID,
  pillar_id UUID,
  pillar_name TEXT,
  pillar_color TEXT,
  roles TEXT[],
  seat_type TEXT,
  eos_role TEXT,
  display_as_unit BOOLEAN,
  gets_it BOOLEAN,
  wants_it BOOLEAN,
  capacity_to_do BOOLEAN,
  core_values_match BOOLEAN,
  color TEXT,
  position_x INTEGER,
  position_y INTEGER,
  assignees JSONB,
  functions JSONB,
  level INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE seat_tree AS (
    -- Root seats (no parent)
    SELECT
      s.id,
      s.name,
      s.parent_seat_id,
      s.pillar_id,
      s.roles,
      s.seat_type,
      s.eos_role,
      s.display_as_unit,
      s.gets_it,
      s.wants_it,
      s.capacity_to_do,
      s.core_values_match,
      s.color,
      s.position_x,
      s.position_y,
      0 as level
    FROM seats s
    WHERE s.organization_id = p_organization_id
      AND s.parent_seat_id IS NULL

    UNION ALL

    -- Child seats
    SELECT
      s.id,
      s.name,
      s.parent_seat_id,
      s.pillar_id,
      s.roles,
      s.seat_type,
      s.eos_role,
      s.display_as_unit,
      s.gets_it,
      s.wants_it,
      s.capacity_to_do,
      s.core_values_match,
      s.color,
      s.position_x,
      s.position_y,
      st.level + 1
    FROM seats s
    INNER JOIN seat_tree st ON s.parent_seat_id = st.id
    WHERE s.organization_id = p_organization_id
  )
  SELECT
    st.id,
    st.name,
    st.parent_seat_id,
    st.pillar_id,
    p.name as pillar_name,
    p.color as pillar_color,
    st.roles,
    st.seat_type,
    st.eos_role,
    st.display_as_unit,
    st.gets_it,
    st.wants_it,
    st.capacity_to_do,
    st.core_values_match,
    st.color,
    st.position_x,
    st.position_y,
    COALESCE(
      jsonb_agg(
        DISTINCT jsonb_build_object(
          'id', sa.id,
          'team_member_id', pr.id,
          'full_name', pr.full_name,
          'email', pr.email,
          'avatar_url', pr.avatar_url,
          'title', pr.title,
          'is_primary', sa.is_primary,
          'assignment_type', sa.assignment_type
        )
      ) FILTER (WHERE sa.id IS NOT NULL),
      '[]'::jsonb
    ) as assignees,
    COALESCE(
      jsonb_agg(
        DISTINCT jsonb_build_object(
          'id', sf.id,
          'name', sf.name,
          'category', sf.category,
          'description', sf.description,
          'assignment_type', sfa.assignment_type,
          'sort_order', sfa.sort_order
        )
      ) FILTER (WHERE sf.id IS NOT NULL AND sf.is_hidden = false),
      '[]'::jsonb
    ) as functions,
    st.level
  FROM seat_tree st
  LEFT JOIN pillars p ON st.pillar_id = p.id
  LEFT JOIN seat_assignments sa ON st.id = sa.seat_id
  LEFT JOIN profiles pr ON sa.team_member_id = pr.id
  LEFT JOIN seat_function_assignments sfa ON st.id = sfa.seat_id
  LEFT JOIN seat_functions sf ON sfa.function_id = sf.id
  GROUP BY st.id, st.name, st.parent_seat_id, st.pillar_id, p.name, p.color,
           st.roles, st.seat_type, st.eos_role, st.display_as_unit,
           st.gets_it, st.wants_it, st.capacity_to_do, st.core_values_match,
           st.color, st.position_x, st.position_y, st.level
  ORDER BY st.level, st.name;
END;
$$ LANGUAGE plpgsql;
