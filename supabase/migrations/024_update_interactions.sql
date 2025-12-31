-- Migration: 024_update_interactions.sql
-- Update read state, acknowledgments, archive, and issue conversion tracking
-- Follows patterns from 021_comments.sql (mentions system)

-- ============================================
-- UPDATE READ STATE (per user, per update)
-- ============================================
CREATE TABLE update_read_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  update_id UUID NOT NULL REFERENCES updates(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Read vs Acknowledged are separate actions
  -- read_at = user viewed/opened the update
  -- acknowledged_at = user explicitly marked "I've got this"
  read_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(update_id, profile_id)
);

-- Indexes for efficient queries
CREATE INDEX idx_update_read_state_profile ON update_read_state(profile_id);
CREATE INDEX idx_update_read_state_profile_unread ON update_read_state(profile_id)
  WHERE read_at IS NULL;
CREATE INDEX idx_update_read_state_update ON update_read_state(update_id);

-- ============================================
-- UPDATE ARCHIVE STATUS
-- ============================================
ALTER TABLE updates
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES profiles(id);

CREATE INDEX IF NOT EXISTS idx_updates_archived ON updates(archived_at) WHERE archived_at IS NULL;

-- ============================================
-- ISSUE CONVERSION TRACKING (one-to-one)
-- ============================================
ALTER TABLE updates
  ADD COLUMN IF NOT EXISTS converted_to_issue_id UUID,
  ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS converted_by UUID REFERENCES profiles(id);

-- Add FK constraint for converted_to_issue_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'updates_converted_to_issue_id_fkey'
  ) THEN
    ALTER TABLE updates
      ADD CONSTRAINT updates_converted_to_issue_id_fkey
      FOREIGN KEY (converted_to_issue_id) REFERENCES issues(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Ensure one-to-one: each update can only be converted once
CREATE UNIQUE INDEX IF NOT EXISTS idx_updates_converted_issue ON updates(converted_to_issue_id)
  WHERE converted_to_issue_id IS NOT NULL;

-- ============================================
-- ISSUES: ADD source_update_id FOR BACK-REFERENCE
-- ============================================
-- (The existing source='update' + source_ref pattern works,
-- but adding explicit FK makes queries cleaner and enforces referential integrity)
ALTER TABLE issues
  ADD COLUMN IF NOT EXISTS source_update_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'issues_source_update_id_fkey'
  ) THEN
    ALTER TABLE issues
      ADD CONSTRAINT issues_source_update_id_fkey
      FOREIGN KEY (source_update_id) REFERENCES updates(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_issues_source_update ON issues(source_update_id)
  WHERE source_update_id IS NOT NULL;

-- ============================================
-- RLS POLICIES FOR update_read_state
-- ============================================
ALTER TABLE update_read_state ENABLE ROW LEVEL SECURITY;

-- Users can view read state for updates in their organization
CREATE POLICY "Users can view org update read state"
ON update_read_state FOR SELECT
USING (
  update_id IN (
    SELECT u.id FROM updates u
    WHERE u.organization_id IN (
      SELECT organization_id FROM profiles
      WHERE clerk_id = auth.uid()::text
    )
  )
);

-- Users can insert their own read state
CREATE POLICY "Users can create own read state"
ON update_read_state FOR INSERT
WITH CHECK (
  profile_id IN (
    SELECT id FROM profiles
    WHERE clerk_id = auth.uid()::text
  )
);

-- Users can update their own read state
CREATE POLICY "Users can update own read state"
ON update_read_state FOR UPDATE
USING (
  profile_id IN (
    SELECT id FROM profiles
    WHERE clerk_id = auth.uid()::text
  )
)
WITH CHECK (
  profile_id IN (
    SELECT id FROM profiles
    WHERE clerk_id = auth.uid()::text
  )
);

-- Users can delete their own read state (e.g., mark as unread)
CREATE POLICY "Users can delete own read state"
ON update_read_state FOR DELETE
USING (
  profile_id IN (
    SELECT id FROM profiles
    WHERE clerk_id = auth.uid()::text
  )
);
