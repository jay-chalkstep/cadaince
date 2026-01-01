-- Team Cascade & Hierarchy: Auto-map existing data to teams
-- Creates teams from existing seats and maps rocks/issues/etc to teams

-- ============================================
-- STEP 1: CREATE TEAMS FROM ACCOUNTABILITY CHART SEATS
-- ============================================
-- Each seat becomes a team (teams are derived from seats, not manually created)

INSERT INTO teams (organization_id, anchor_seat_id, parent_team_id, name, slug, level, is_elt, l10_required)
SELECT DISTINCT ON (s.id)
  s.organization_id,
  s.id AS anchor_seat_id,
  NULL AS parent_team_id, -- Will be updated in step 2
  COALESCE(s.name, p.name, 'Team') AS name,
  LOWER(REGEXP_REPLACE(COALESCE(s.name, p.name, 'team'), '[^a-zA-Z0-9]+', '-', 'g')) || '-' || LEFT(s.id::text, 8) AS slug,
  CASE
    WHEN s.eos_role IN ('visionary', 'integrator') THEN 1
    WHEN s.parent_seat_id IS NULL THEN 1  -- Root seats are level 1
    ELSE 2  -- Will be adjusted in step 3
  END AS level,
  COALESCE(s.eos_role IN ('visionary', 'integrator'), false) AS is_elt,
  true AS l10_required  -- Will be adjusted based on level
FROM seats s
LEFT JOIN pillars p ON p.id = s.pillar_id
WHERE s.organization_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM teams t WHERE t.anchor_seat_id = s.id)
ON CONFLICT (anchor_seat_id) DO NOTHING;

-- ============================================
-- STEP 2: SET PARENT TEAM RELATIONSHIPS
-- ============================================
-- Mirror seat hierarchy in team hierarchy

UPDATE teams child
SET parent_team_id = parent.id
FROM seats child_seat
JOIN seats parent_seat ON parent_seat.id = child_seat.parent_seat_id
JOIN teams parent ON parent.anchor_seat_id = parent_seat.id
WHERE child.anchor_seat_id = child_seat.id
  AND child.parent_team_id IS NULL;

-- ============================================
-- STEP 3: CORRECT TEAM LEVELS BASED ON HIERARCHY DEPTH
-- ============================================
-- Level is determined by distance from root (capped at 4)

WITH RECURSIVE team_depths AS (
  -- Base: root teams (no parent)
  SELECT id, 1 AS depth
  FROM teams
  WHERE parent_team_id IS NULL

  UNION ALL

  -- Recursive: children increment depth
  SELECT t.id, LEAST(td.depth + 1, 4) AS depth
  FROM teams t
  JOIN team_depths td ON t.parent_team_id = td.id
)
UPDATE teams t
SET
  level = td.depth,
  l10_required = td.depth <= 2  -- Required for levels 1-2 (ELT, Pillar)
FROM team_depths td
WHERE t.id = td.id;

-- ============================================
-- STEP 4: MAP EXISTING ROCKS TO TEAMS
-- ============================================
-- Rocks with pillar_id get mapped to the team whose anchor seat is associated with that pillar

UPDATE rocks r
SET team_id = t.id
FROM seats s
JOIN teams t ON t.anchor_seat_id = s.id
WHERE r.pillar_id = s.pillar_id
  AND r.team_id IS NULL
  AND s.pillar_id IS NOT NULL;

-- Rocks without pillar_id go to ELT team (company-level rocks)
UPDATE rocks r
SET team_id = (
  SELECT t.id
  FROM teams t
  WHERE t.organization_id = r.organization_id
    AND t.is_elt = true
  LIMIT 1
)
WHERE r.team_id IS NULL;

-- ============================================
-- STEP 5: MAP EXISTING ISSUES TO TEAMS
-- ============================================
-- Issues with pillar_id get mapped to corresponding team

UPDATE issues i
SET team_id = t.id
FROM seats s
JOIN teams t ON t.anchor_seat_id = s.id
WHERE i.pillar_id = s.pillar_id
  AND i.team_id IS NULL
  AND s.pillar_id IS NOT NULL;

-- Company-level issues go to ELT
UPDATE issues i
SET team_id = (
  SELECT t.id
  FROM teams t
  WHERE t.organization_id = i.organization_id
    AND t.is_elt = true
  LIMIT 1
)
WHERE i.team_id IS NULL
  AND i.issue_level = 'company';

-- Remaining issues without team go to first available team
UPDATE issues i
SET team_id = (
  SELECT t.id
  FROM teams t
  WHERE t.organization_id = i.organization_id
  ORDER BY t.level ASC
  LIMIT 1
)
WHERE i.team_id IS NULL;

-- ============================================
-- STEP 6: MAP EXISTING L10 MEETINGS TO TEAMS
-- ============================================
-- L10 meetings without team go to ELT (l10_meetings doesn't have pillar_id)

UPDATE l10_meetings m
SET team_id = (
  SELECT t.id
  FROM teams t
  WHERE t.organization_id = m.organization_id
    AND t.is_elt = true
  LIMIT 1
)
WHERE m.team_id IS NULL;

-- ============================================
-- STEP 7: MAP METRICS TO TEAMS (OPTIONAL)
-- ============================================
-- Metrics with owner can be mapped based on owner's primary team

UPDATE metrics m
SET team_id = (
  SELECT tm.team_id
  FROM team_memberships tm
  WHERE tm.profile_id = m.owner_id
    AND tm.is_lead = true
  LIMIT 1
)
WHERE m.team_id IS NULL AND m.owner_id IS NOT NULL;

-- Fallback: use any team membership
UPDATE metrics m
SET team_id = (
  SELECT tm.team_id
  FROM team_memberships tm
  WHERE tm.profile_id = m.owner_id
  LIMIT 1
)
WHERE m.team_id IS NULL AND m.owner_id IS NOT NULL;
