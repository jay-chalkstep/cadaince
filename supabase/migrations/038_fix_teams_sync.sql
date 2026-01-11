-- Fix Teams Sync: Create teams from existing seats and add auto-create trigger
-- This migration fixes the issue where teams weren't created because migration 036
-- ran before any seats existed.

-- ============================================
-- STEP 1: CREATE TEAMS FROM EXISTING SEATS
-- ============================================

INSERT INTO teams (organization_id, anchor_seat_id, parent_team_id, name, slug, level, is_elt, l10_required)
SELECT DISTINCT ON (s.id)
  s.organization_id,
  s.id AS anchor_seat_id,
  NULL AS parent_team_id,
  COALESCE(s.name, p.name, 'Team') AS name,
  LOWER(REGEXP_REPLACE(COALESCE(s.name, p.name, 'team'), '[^a-zA-Z0-9]+', '-', 'g')) || '-' || LEFT(s.id::text, 8) AS slug,
  CASE
    WHEN s.eos_role IN ('visionary', 'integrator') THEN 1
    WHEN s.parent_seat_id IS NULL THEN 1
    ELSE 2
  END AS level,
  COALESCE(s.eos_role IN ('visionary', 'integrator'), false) AS is_elt,
  true AS l10_required
FROM seats s
LEFT JOIN pillars p ON p.id = s.pillar_id
WHERE s.organization_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM teams t WHERE t.anchor_seat_id = s.id)
ON CONFLICT (anchor_seat_id) DO NOTHING;

-- ============================================
-- STEP 2: SET PARENT TEAM RELATIONSHIPS
-- ============================================

UPDATE teams child
SET parent_team_id = parent.id
FROM seats child_seat
JOIN seats parent_seat ON parent_seat.id = child_seat.parent_seat_id
JOIN teams parent ON parent.anchor_seat_id = parent_seat.id
WHERE child.anchor_seat_id = child_seat.id
  AND child.parent_team_id IS NULL;

-- ============================================
-- STEP 3: CORRECT TEAM LEVELS BASED ON HIERARCHY
-- ============================================

WITH RECURSIVE team_depths AS (
  SELECT id, 1 AS depth FROM teams WHERE parent_team_id IS NULL
  UNION ALL
  SELECT t.id, LEAST(td.depth + 1, 4) AS depth
  FROM teams t JOIN team_depths td ON t.parent_team_id = td.id
)
UPDATE teams t
SET level = td.depth, l10_required = td.depth <= 2
FROM team_depths td
WHERE t.id = td.id;

-- ============================================
-- STEP 4: ADD TRIGGER FOR FUTURE SEATS
-- ============================================
-- This ensures new seats automatically create corresponding teams

CREATE OR REPLACE FUNCTION create_team_for_seat()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO teams (organization_id, anchor_seat_id, name, slug, level, is_elt, l10_required)
  VALUES (
    NEW.organization_id,
    NEW.id,
    NEW.name,
    LOWER(REGEXP_REPLACE(COALESCE(NEW.name, 'team'), '[^a-zA-Z0-9]+', '-', 'g')) || '-' || LEFT(NEW.id::text, 8),
    CASE WHEN NEW.eos_role IN ('visionary', 'integrator') THEN 1 ELSE 2 END,
    COALESCE(NEW.eos_role IN ('visionary', 'integrator'), false),
    true
  )
  ON CONFLICT (anchor_seat_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop if exists to avoid errors on re-run
DROP TRIGGER IF EXISTS auto_create_team_for_seat ON seats;

CREATE TRIGGER auto_create_team_for_seat
AFTER INSERT ON seats
FOR EACH ROW
EXECUTE FUNCTION create_team_for_seat();

-- ============================================
-- STEP 5: ADD TRIGGER TO UPDATE TEAM HIERARCHY
-- ============================================
-- When a seat's parent changes, update the team's parent

CREATE OR REPLACE FUNCTION update_team_parent_on_seat_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Update team's parent when seat's parent changes
  IF NEW.parent_seat_id IS DISTINCT FROM OLD.parent_seat_id THEN
    UPDATE teams child
    SET parent_team_id = (
      SELECT t.id FROM teams t WHERE t.anchor_seat_id = NEW.parent_seat_id
    )
    WHERE child.anchor_seat_id = NEW.id;
  END IF;

  -- Update team name when seat name changes
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    UPDATE teams
    SET name = NEW.name,
        slug = LOWER(REGEXP_REPLACE(COALESCE(NEW.name, 'team'), '[^a-zA-Z0-9]+', '-', 'g')) || '-' || LEFT(NEW.id::text, 8)
    WHERE anchor_seat_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_team_on_seat_change ON seats;

CREATE TRIGGER update_team_on_seat_change
AFTER UPDATE ON seats
FOR EACH ROW
EXECUTE FUNCTION update_team_parent_on_seat_change();

-- ============================================
-- STEP 6: ADD TRIGGER TO DELETE TEAM WHEN SEAT DELETED
-- ============================================

CREATE OR REPLACE FUNCTION delete_team_for_seat()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM teams WHERE anchor_seat_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_delete_team_for_seat ON seats;

CREATE TRIGGER auto_delete_team_for_seat
BEFORE DELETE ON seats
FOR EACH ROW
EXECUTE FUNCTION delete_team_for_seat();
