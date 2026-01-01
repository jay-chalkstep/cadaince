-- Team Cascade & Hierarchy: Enhanced issue escalation
-- Issues can be escalated to parent teams, creating linked copies

-- Add original team tracking for escalated issues
ALTER TABLE issues ADD COLUMN IF NOT EXISTS original_team_id UUID REFERENCES teams(id);
CREATE INDEX IF NOT EXISTS idx_issues_original_team ON issues(original_team_id);

-- Function to escalate an issue to parent team
-- Creates a copy of the issue in the parent team and links them bidirectionally
CREATE OR REPLACE FUNCTION escalate_issue(
  p_issue_id UUID,
  p_escalated_by UUID
)
RETURNS UUID AS $$
DECLARE
  v_issue RECORD;
  v_parent_team_id UUID;
  v_new_issue_id UUID;
BEGIN
  -- Get the issue
  SELECT * INTO v_issue FROM issues WHERE id = p_issue_id;

  IF v_issue IS NULL THEN
    RAISE EXCEPTION 'Issue not found';
  END IF;

  -- Check if already escalated
  IF v_issue.escalated_to_issue_id IS NOT NULL THEN
    RAISE EXCEPTION 'Issue has already been escalated';
  END IF;

  -- Get parent team
  SELECT parent_team_id INTO v_parent_team_id
  FROM teams WHERE id = v_issue.team_id;

  IF v_parent_team_id IS NULL THEN
    RAISE EXCEPTION 'Cannot escalate: no parent team exists';
  END IF;

  -- Create escalated copy in parent team
  INSERT INTO issues (
    organization_id,
    team_id,
    title,
    description,
    priority,
    status,
    issue_level,
    created_by,
    escalated_from_id,
    escalated_at,
    escalated_by_id,
    original_team_id
  )
  VALUES (
    v_issue.organization_id,
    v_parent_team_id,
    v_issue.title,
    v_issue.description,
    v_issue.priority,
    'open',
    CASE
      WHEN v_issue.issue_level = 'individual' THEN 'pillar'
      WHEN v_issue.issue_level = 'pillar' THEN 'company'
      ELSE v_issue.issue_level
    END,
    v_issue.created_by,
    p_issue_id,
    NOW(),
    p_escalated_by,
    v_issue.team_id
  )
  RETURNING id INTO v_new_issue_id;

  -- Update original issue to link to escalated copy and mark as escalated
  UPDATE issues
  SET escalated_to_issue_id = v_new_issue_id,
      status = 'escalated'
  WHERE id = p_issue_id;

  RETURN v_new_issue_id;
END;
$$ LANGUAGE plpgsql;
