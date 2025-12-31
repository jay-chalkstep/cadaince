-- Migration 026: L10 Meeting Preview & Prep Feature
-- Adds organization_id to l10_meetings for multi-tenancy
-- Adds issue queuing support for pre-meeting preparation

-- ============================================
-- ADD ORGANIZATION_ID TO L10_MEETINGS
-- ============================================

-- Add organization_id column (nullable first for backfill)
ALTER TABLE l10_meetings
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- Backfill organization_id from the creating user's profile
UPDATE l10_meetings m
SET organization_id = p.organization_id
FROM profiles p
WHERE m.created_by = p.id
  AND m.organization_id IS NULL
  AND p.organization_id IS NOT NULL;

-- Add index for organization queries
CREATE INDEX IF NOT EXISTS l10_meetings_organization_id_idx ON l10_meetings(organization_id);

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "All users can view l10 meetings" ON l10_meetings;
DROP POLICY IF EXISTS "ELT and admins can create l10 meetings" ON l10_meetings;
DROP POLICY IF EXISTS "Creators and admins can update l10 meetings" ON l10_meetings;
DROP POLICY IF EXISTS "Admins can delete l10 meetings" ON l10_meetings;

-- Create new org-scoped policies
CREATE POLICY "Users can view own org l10 meetings"
  ON l10_meetings FOR SELECT
  USING (
    organization_id IS NULL -- Allow viewing legacy meetings without org_id
    OR organization_id = (SELECT organization_id FROM profiles WHERE id = get_current_profile_id())
  );

CREATE POLICY "ELT and admins can create l10 meetings"
  ON l10_meetings FOR INSERT
  WITH CHECK (
    (get_current_access_level() IN ('admin', 'elt') OR (SELECT is_elt FROM profiles WHERE id = get_current_profile_id()))
    AND (organization_id IS NULL OR organization_id = (SELECT organization_id FROM profiles WHERE id = get_current_profile_id()))
  );

CREATE POLICY "Creators and admins can update l10 meetings"
  ON l10_meetings FOR UPDATE
  USING (
    (created_by = get_current_profile_id() OR get_current_access_level() = 'admin')
    AND (organization_id IS NULL OR organization_id = (SELECT organization_id FROM profiles WHERE id = get_current_profile_id()))
  );

CREATE POLICY "Admins can delete l10 meetings"
  ON l10_meetings FOR DELETE
  USING (
    get_current_access_level() = 'admin'
    AND (organization_id IS NULL OR organization_id = (SELECT organization_id FROM profiles WHERE id = get_current_profile_id()))
  );

-- ============================================
-- ADD RATINGS JSONB FOR PER-ATTENDEE RATINGS
-- ============================================

-- Add ratings column for per-attendee ratings (stored as { profileId: rating })
ALTER TABLE l10_meetings
  ADD COLUMN IF NOT EXISTS ratings JSONB;

-- ============================================
-- ADD ISSUE QUEUING SUPPORT
-- ============================================

-- Add column to queue issues for a specific L10 meeting
ALTER TABLE issues
  ADD COLUMN IF NOT EXISTS queued_for_meeting_id UUID REFERENCES l10_meetings(id) ON DELETE SET NULL;

-- Add queue order for prioritization within a meeting's queue
ALTER TABLE issues
  ADD COLUMN IF NOT EXISTS queue_order INTEGER;

-- Index for efficient queue queries
CREATE INDEX IF NOT EXISTS idx_issues_queued_meeting
  ON issues(queued_for_meeting_id)
  WHERE queued_for_meeting_id IS NOT NULL;

-- Index for ordering within queue
CREATE INDEX IF NOT EXISTS idx_issues_queue_order
  ON issues(queued_for_meeting_id, queue_order)
  WHERE queued_for_meeting_id IS NOT NULL;

-- ============================================
-- HELPER FUNCTION: GET MEETING PREVIEW DATA
-- ============================================

CREATE OR REPLACE FUNCTION get_l10_meeting_preview(p_meeting_id UUID, p_organization_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_meeting RECORD;
  v_result JSONB;
BEGIN
  -- Get meeting details
  SELECT * INTO v_meeting
  FROM l10_meetings
  WHERE id = p_meeting_id;

  IF v_meeting IS NULL THEN
    RETURN NULL;
  END IF;

  -- Build preview data
  SELECT jsonb_build_object(
    'queued_issues', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', i.id,
          'title', i.title,
          'description', i.description,
          'priority', i.priority,
          'queue_order', i.queue_order,
          'raised_by', jsonb_build_object(
            'id', p.id,
            'full_name', p.full_name
          ),
          'created_at', i.created_at
        ) ORDER BY i.queue_order NULLS LAST, i.created_at
      ), '[]'::jsonb)
      FROM issues i
      LEFT JOIN profiles p ON p.id = i.raised_by
      WHERE i.queued_for_meeting_id = p_meeting_id
    ),
    'off_track_rocks', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'title', r.title,
          'status', r.status,
          'due_date', r.due_date,
          'owner', jsonb_build_object(
            'id', p.id,
            'full_name', p.full_name
          )
        ) ORDER BY
          CASE r.status WHEN 'off_track' THEN 1 WHEN 'at_risk' THEN 2 ELSE 3 END,
          r.due_date
      ), '[]'::jsonb)
      FROM rocks r
      LEFT JOIN profiles p ON p.id = r.owner_id
      WHERE r.organization_id = p_organization_id
        AND r.status IN ('off_track', 'at_risk')
    ),
    'carryover_todos', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', t.id,
          'title', t.title,
          'due_date', t.due_date,
          'owner', jsonb_build_object(
            'id', p.id,
            'full_name', p.full_name
          )
        ) ORDER BY t.due_date
      ), '[]'::jsonb)
      FROM todos t
      LEFT JOIN profiles p ON p.id = t.owner_id
      WHERE t.organization_id = p_organization_id
        AND t.is_complete = false
        AND t.due_date < v_meeting.scheduled_at::date
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- COMMENT FOR DOCUMENTATION
-- ============================================
COMMENT ON COLUMN l10_meetings.organization_id IS 'Organization this meeting belongs to for multi-tenant isolation';
COMMENT ON COLUMN l10_meetings.ratings IS 'Per-attendee ratings as JSONB object { profileId: rating }';
COMMENT ON COLUMN issues.queued_for_meeting_id IS 'L10 meeting this issue is queued for discussion in';
COMMENT ON COLUMN issues.queue_order IS 'Order of this issue in the meeting queue (lower = higher priority)';
