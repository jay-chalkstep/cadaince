-- Aicomplice Database Schema
-- Migration 017: Todos Visibility (Private vs Team)

-- ============================================
-- 1. ADD VISIBILITY COLUMN
-- ============================================

-- Add visibility column: 'private' (only owner) or 'team' (visible in L10s)
ALTER TABLE todos ADD COLUMN IF NOT EXISTS visibility TEXT
  CHECK (visibility IN ('private', 'team'))
  DEFAULT 'team';

-- Add organization_id to todos (was missing - critical for multi-tenancy)
ALTER TABLE todos ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- Add is_complete column if not exists (may have been added by migration 010)
ALTER TABLE todos ADD COLUMN IF NOT EXISTS is_complete BOOLEAN DEFAULT false;

-- ============================================
-- 2. BACKFILL ORGANIZATION_ID
-- ============================================

-- Backfill organization_id from owner's profile
UPDATE todos
SET organization_id = (
  SELECT organization_id FROM profiles WHERE profiles.id = todos.owner_id
)
WHERE organization_id IS NULL;

-- Make organization_id NOT NULL after backfill
ALTER TABLE todos ALTER COLUMN organization_id SET NOT NULL;

-- ============================================
-- 3. INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_todos_visibility ON todos(owner_id, visibility);
CREATE INDEX IF NOT EXISTS idx_todos_organization ON todos(organization_id);
CREATE INDEX IF NOT EXISTS idx_todos_meeting ON todos(meeting_id);

-- ============================================
-- 4. ROW LEVEL SECURITY
-- ============================================

-- Drop existing RLS policies if they exist
DROP POLICY IF EXISTS "Users can view own todos" ON todos;
DROP POLICY IF EXISTS "Users can manage own todos" ON todos;

-- Enable RLS
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

-- Users can view their own todos OR team todos in their org
CREATE POLICY "Users can view accessible todos"
ON todos FOR SELECT
USING (
  organization_id = get_current_organization_id()
  AND (
    -- Can always see your own todos
    owner_id = get_current_profile_id()
    -- Can see team todos from anyone in org
    OR visibility = 'team'
  )
);

-- Users can create todos in their org
CREATE POLICY "Users can create todos in org"
ON todos FOR INSERT
WITH CHECK (
  organization_id = get_current_organization_id()
);

-- Users can update their own todos
CREATE POLICY "Users can update own todos"
ON todos FOR UPDATE
USING (
  organization_id = get_current_organization_id()
  AND owner_id = get_current_profile_id()
);

-- Users can delete their own todos
CREATE POLICY "Users can delete own todos"
ON todos FOR DELETE
USING (
  organization_id = get_current_organization_id()
  AND owner_id = get_current_profile_id()
);

-- Admins can manage all todos in org
CREATE POLICY "Admins can manage all org todos"
ON todos FOR ALL
USING (
  organization_id = get_current_organization_id()
  AND get_current_access_level() = 'admin'
);
