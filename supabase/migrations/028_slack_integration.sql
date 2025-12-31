-- Slack Integration Tables
-- Migration 028: Slack workspace connections, user mappings, and notification settings

-- Slack workspace connection (organization level)
CREATE TABLE IF NOT EXISTS slack_workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL UNIQUE,
  workspace_id TEXT NOT NULL,
  workspace_name TEXT,
  access_token TEXT NOT NULL,
  bot_user_id TEXT,
  team_icon_url TEXT,
  connected_by UUID REFERENCES profiles(id),
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Map Slack users to Aicomplice profiles
CREATE TABLE IF NOT EXISTS slack_user_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  profile_id UUID REFERENCES profiles(id),
  slack_user_id TEXT NOT NULL,
  slack_email TEXT,
  slack_username TEXT,
  slack_display_name TEXT,
  slack_avatar_url TEXT,
  match_method TEXT, -- 'auto_email', 'manual', NULL (unmatched)
  matched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, slack_user_id)
);

-- Notification channel preferences per event type
CREATE TABLE IF NOT EXISTS slack_notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  event_type TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  channel_name TEXT,
  is_enabled BOOLEAN DEFAULT true,
  message_template TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, event_type)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_slack_workspaces_org ON slack_workspaces(organization_id);
CREATE INDEX IF NOT EXISTS idx_slack_user_mappings_org ON slack_user_mappings(organization_id);
CREATE INDEX IF NOT EXISTS idx_slack_user_mappings_profile ON slack_user_mappings(profile_id);
CREATE INDEX IF NOT EXISTS idx_slack_user_mappings_slack_user ON slack_user_mappings(slack_user_id);
CREATE INDEX IF NOT EXISTS idx_slack_notification_settings_org ON slack_notification_settings(organization_id);

-- RLS Policies
ALTER TABLE slack_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE slack_user_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE slack_notification_settings ENABLE ROW LEVEL SECURITY;

-- Slack workspaces: Admins can manage
CREATE POLICY "Admins can view slack workspaces" ON slack_workspaces
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE clerk_id = auth.uid()::text AND access_level IN ('admin', 'elt')
    )
  );

CREATE POLICY "Admins can manage slack workspaces" ON slack_workspaces
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE clerk_id = auth.uid()::text AND access_level = 'admin'
    )
  );

-- Slack user mappings: Users can view their own org's mappings
CREATE POLICY "Users can view org slack mappings" ON slack_user_mappings
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE clerk_id = auth.uid()::text
    )
  );

CREATE POLICY "Admins can manage slack mappings" ON slack_user_mappings
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE clerk_id = auth.uid()::text AND access_level = 'admin'
    )
  );

-- Notification settings: Users can view, admins can manage
CREATE POLICY "Users can view notification settings" ON slack_notification_settings
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE clerk_id = auth.uid()::text
    )
  );

CREATE POLICY "Admins can manage notification settings" ON slack_notification_settings
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE clerk_id = auth.uid()::text AND access_level = 'admin'
    )
  );
