-- Automations Framework
-- Custom rules for triggering actions based on events

-- Automation rules
CREATE TABLE IF NOT EXISTS integration_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  trigger_event TEXT NOT NULL,
  trigger_conditions JSONB DEFAULT '{}',
  action_type TEXT NOT NULL,
  action_config JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Valid trigger events
COMMENT ON COLUMN integration_automations.trigger_event IS 'One of: l10/meeting.created, l10/meeting.updated, l10/meeting.starting_soon, l10/meeting.completed, issue/created, issue/queued, issue/resolved, rock/status.changed, rock/completed, todo/created, todo/overdue, headline/created, scorecard/below_goal';

-- Valid action types
COMMENT ON COLUMN integration_automations.action_type IS 'One of: slack_channel_message, slack_dm, push_remarkable, webhook';

-- Action execution log
CREATE TABLE IF NOT EXISTS automation_action_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID REFERENCES integration_automations(id) ON DELETE CASCADE,
  event_id UUID REFERENCES integration_events(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_data JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'error', 'skipped')),
  result JSONB,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_automations_org ON integration_automations(organization_id);
CREATE INDEX IF NOT EXISTS idx_automations_trigger ON integration_automations(trigger_event) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_automation_log_automation ON automation_action_log(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_log_status ON automation_action_log(status) WHERE status IN ('pending', 'running');

-- RLS for integration_automations
ALTER TABLE integration_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org automations"
  ON integration_automations FOR SELECT
  USING (
    organization_id = (
      SELECT organization_id FROM profiles WHERE clerk_id = auth.uid()::text
    )
  );

CREATE POLICY "Admins can insert automations"
  ON integration_automations FOR INSERT
  WITH CHECK (
    organization_id = (
      SELECT organization_id FROM profiles
      WHERE clerk_id = auth.uid()::text AND access_level = 'admin'
    )
  );

CREATE POLICY "Admins can update automations"
  ON integration_automations FOR UPDATE
  USING (
    organization_id = (
      SELECT organization_id FROM profiles
      WHERE clerk_id = auth.uid()::text AND access_level = 'admin'
    )
  )
  WITH CHECK (
    organization_id = (
      SELECT organization_id FROM profiles
      WHERE clerk_id = auth.uid()::text AND access_level = 'admin'
    )
  );

CREATE POLICY "Admins can delete automations"
  ON integration_automations FOR DELETE
  USING (
    organization_id = (
      SELECT organization_id FROM profiles
      WHERE clerk_id = auth.uid()::text AND access_level = 'admin'
    )
  );

-- RLS for automation_action_log
ALTER TABLE automation_action_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org automation logs"
  ON automation_action_log FOR SELECT
  USING (
    automation_id IN (
      SELECT id FROM integration_automations
      WHERE organization_id = (
        SELECT organization_id FROM profiles WHERE clerk_id = auth.uid()::text
      )
    )
  );

-- Admins can insert logs (for manual triggers)
CREATE POLICY "System can insert automation logs"
  ON automation_action_log FOR INSERT
  WITH CHECK (true);

-- System can update logs
CREATE POLICY "System can update automation logs"
  ON automation_action_log FOR UPDATE
  USING (true)
  WITH CHECK (true);
