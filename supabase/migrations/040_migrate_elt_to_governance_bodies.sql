-- Migration 040: Migrate ELT Teams to Governance Bodies
-- Creates governance bodies from existing ELT-flagged teams and migrates data

-- ============================================
-- 1. CREATE ELT GOVERNANCE BODIES FROM TEAMS
-- ============================================

INSERT INTO governance_bodies (
  organization_id,
  name,
  slug,
  description,
  body_type,
  l10_required,
  is_confidential,
  settings
)
SELECT DISTINCT ON (t.organization_id)
  t.organization_id,
  'Executive Leadership Team',
  'elt',
  'Executive Leadership Team - strategic decision making and company-level accountability',
  'elt',
  true,
  true,
  COALESCE(t.settings, '{}'::jsonb)
FROM teams t
WHERE t.is_elt = true
ON CONFLICT (organization_id, slug) DO NOTHING;

-- ============================================
-- 2. MIGRATE ELT TEAM MEMBERS TO GOVERNANCE BODY
-- ============================================

-- Use the team_memberships view to get ELT members
INSERT INTO governance_body_memberships (
  governance_body_id,
  profile_id,
  is_chair,
  role_title,
  added_at
)
SELECT
  gb.id,
  tm.profile_id,
  tm.is_lead,
  CASE WHEN tm.is_lead THEN 'Chair' ELSE NULL END,
  NOW()
FROM team_memberships tm
JOIN teams t ON t.id = tm.team_id
JOIN governance_bodies gb ON gb.organization_id = t.organization_id AND gb.slug = 'elt'
WHERE t.is_elt = true
ON CONFLICT (governance_body_id, profile_id) DO NOTHING;

-- ============================================
-- 3. MAP EXISTING ELT DATA TO GOVERNANCE BODIES
-- ============================================

-- Map rocks that were on ELT teams to governance_body_id
UPDATE rocks r
SET governance_body_id = gb.id
FROM teams t
JOIN governance_bodies gb ON gb.organization_id = t.organization_id AND gb.slug = 'elt'
WHERE r.team_id = t.id
  AND t.is_elt = true
  AND r.governance_body_id IS NULL;

-- Map issues that were on ELT teams
UPDATE issues i
SET governance_body_id = gb.id
FROM teams t
JOIN governance_bodies gb ON gb.organization_id = t.organization_id AND gb.slug = 'elt'
WHERE i.team_id = t.id
  AND t.is_elt = true
  AND i.governance_body_id IS NULL;

-- Map L10 meetings that were on ELT teams
UPDATE l10_meetings m
SET governance_body_id = gb.id
FROM teams t
JOIN governance_bodies gb ON gb.organization_id = t.organization_id AND gb.slug = 'elt'
WHERE m.team_id = t.id
  AND t.is_elt = true
  AND m.governance_body_id IS NULL;

-- Map confidential headlines that were on ELT teams
UPDATE headlines h
SET governance_body_id = gb.id
FROM teams t
JOIN governance_bodies gb ON gb.organization_id = t.organization_id AND gb.slug = 'elt'
WHERE h.team_id = t.id
  AND t.is_elt = true
  AND COALESCE(h.is_confidential, false) = true
  AND h.governance_body_id IS NULL;

-- ============================================
-- 4. CREATE DEFAULT SLT GOVERNANCE BODIES
-- ============================================

-- Create SLT for orgs that have level 2 teams (pillar leads)
INSERT INTO governance_bodies (
  organization_id,
  name,
  slug,
  description,
  body_type,
  l10_required,
  is_confidential
)
SELECT DISTINCT
  t.organization_id,
  'Senior Leadership Team',
  'slt',
  'Senior Leadership Team - department heads and pillar leads',
  'slt',
  false,
  false
FROM teams t
WHERE t.level = 2
  AND NOT EXISTS (
    SELECT 1 FROM governance_bodies gb
    WHERE gb.organization_id = t.organization_id AND gb.slug = 'slt'
  )
ON CONFLICT (organization_id, slug) DO NOTHING;

-- Populate SLT with level 2 team leads
INSERT INTO governance_body_memberships (
  governance_body_id,
  profile_id,
  is_chair,
  role_title,
  added_at
)
SELECT DISTINCT
  gb.id,
  tm.profile_id,
  false,
  'Pillar Lead',
  NOW()
FROM team_memberships tm
JOIN teams t ON t.id = tm.team_id
JOIN governance_bodies gb ON gb.organization_id = t.organization_id AND gb.slug = 'slt'
WHERE t.level = 2
  AND tm.is_lead = true
ON CONFLICT (governance_body_id, profile_id) DO NOTHING;
