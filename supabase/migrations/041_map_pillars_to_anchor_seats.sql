-- Migration 041: Map Pillars to Anchor Seats
-- Links pillars to their lead seats in the AC for derived membership
-- Uses existing seat_pillars data to determine anchor seats

-- ============================================
-- 1. MAP PILLARS TO ANCHOR SEATS
-- ============================================

-- Find seats where this pillar is marked as PRIMARY
-- That seat becomes the anchor (leader) for the pillar
UPDATE pillars p
SET anchor_seat_id = (
  SELECT sp.seat_id
  FROM seat_pillars sp
  JOIN seats s ON s.id = sp.seat_id
  WHERE sp.pillar_id = p.id
    AND sp.is_primary = true
    AND s.organization_id = p.organization_id
  ORDER BY s.created_at ASC
  LIMIT 1
)
WHERE p.anchor_seat_id IS NULL;

-- Fallback: if no is_primary seat found, use any seat associated with pillar
UPDATE pillars p
SET anchor_seat_id = (
  SELECT sp.seat_id
  FROM seat_pillars sp
  JOIN seats s ON s.id = sp.seat_id
  WHERE sp.pillar_id = p.id
    AND s.organization_id = p.organization_id
  ORDER BY s.created_at ASC
  LIMIT 1
)
WHERE p.anchor_seat_id IS NULL;

-- Second fallback: use legacy pillar_id on seats (deprecated column)
UPDATE pillars p
SET anchor_seat_id = (
  SELECT s.id
  FROM seats s
  WHERE s.pillar_id = p.id
    AND s.organization_id = p.organization_id
    AND s.parent_seat_id IS NOT NULL  -- Not a root seat
  ORDER BY
    CASE WHEN s.eos_role = 'leader' THEN 0 ELSE 1 END,
    s.created_at ASC
  LIMIT 1
)
WHERE p.anchor_seat_id IS NULL;

-- ============================================
-- 2. MIGRATE NON-ELT TEAM DATA TO PILLARS
-- ============================================

-- Rocks with team_id on non-ELT teams: ensure pillar_id is set
-- pillar_id likely already exists, but fill gaps from team's anchor seat
UPDATE rocks r
SET pillar_id = COALESCE(r.pillar_id, (
  SELECT sp.pillar_id
  FROM teams t
  JOIN seats s ON s.id = t.anchor_seat_id
  JOIN seat_pillars sp ON sp.seat_id = s.id AND sp.is_primary = true
  WHERE t.id = r.team_id
  LIMIT 1
))
WHERE r.team_id IS NOT NULL
  AND r.governance_body_id IS NULL  -- Not already mapped to governance body
  AND r.pillar_id IS NULL;

-- Issues with team_id on non-ELT teams: ensure pillar_id is set
UPDATE issues i
SET pillar_id = COALESCE(i.pillar_id, (
  SELECT sp.pillar_id
  FROM teams t
  JOIN seats s ON s.id = t.anchor_seat_id
  JOIN seat_pillars sp ON sp.seat_id = s.id AND sp.is_primary = true
  WHERE t.id = i.team_id
  LIMIT 1
))
WHERE i.team_id IS NOT NULL
  AND i.governance_body_id IS NULL
  AND i.pillar_id IS NULL;

-- L10 meetings with team_id: set pillar_id if not governance body
UPDATE l10_meetings m
SET pillar_id = (
  SELECT sp.pillar_id
  FROM teams t
  JOIN seats s ON s.id = t.anchor_seat_id
  JOIN seat_pillars sp ON sp.seat_id = s.id AND sp.is_primary = true
  WHERE t.id = m.team_id
  LIMIT 1
)
WHERE m.team_id IS NOT NULL
  AND m.governance_body_id IS NULL
  AND m.pillar_id IS NULL;

-- Metrics with team_id: migrate to pillar_id
UPDATE metrics m
SET pillar_id = (
  SELECT sp.pillar_id
  FROM teams t
  JOIN seats s ON s.id = t.anchor_seat_id
  JOIN seat_pillars sp ON sp.seat_id = s.id AND sp.is_primary = true
  WHERE t.id = m.team_id
  LIMIT 1
)
WHERE m.team_id IS NOT NULL
  AND m.pillar_id IS NULL;

-- ============================================
-- 3. ADD DEPRECATION COMMENTS
-- ============================================

COMMENT ON COLUMN rocks.team_id IS 'DEPRECATED: Use pillar_id for pillar rocks, governance_body_id for company rocks, owner_id for individual rocks. Will be removed in migration 045.';

COMMENT ON COLUMN issues.team_id IS 'DEPRECATED: Use pillar_id for pillar issues, governance_body_id for escalated issues. Will be removed in migration 045.';

COMMENT ON COLUMN l10_meetings.team_id IS 'DEPRECATED: Use pillar_id for pillar L10s, governance_body_id for leadership L10s. Will be removed in migration 045.';

COMMENT ON COLUMN metrics.team_id IS 'DEPRECATED: Use pillar_id for pillar metrics, owner_id for individual ownership. Will be removed in migration 045.';

COMMENT ON COLUMN individual_goals.team_id IS 'DEPRECATED: Use owner_id for goal ownership and rock_id for cascade. Will be removed in migration 045.';

COMMENT ON COLUMN todos.team_id IS 'DEPRECATED: Use pillar_id or owner_id. Will be removed in migration 045.';

COMMENT ON COLUMN headlines.team_id IS 'DEPRECATED: Use governance_body_id for ELT headlines, otherwise org-wide. Will be removed in migration 045.';
