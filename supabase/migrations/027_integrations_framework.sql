-- Aicomplice Database Schema
-- Migration 027: Integrations Framework
-- Supports Calendar (Google/Outlook), Slack, and reMarkable integrations

-- ============================================
-- UPDATE EXISTING INTEGRATIONS TABLE
-- Add organization_id for multi-tenancy
-- ============================================
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- Create index for organization lookup
CREATE INDEX IF NOT EXISTS integrations_organization_id_idx ON integrations(organization_id);

-- Add unique constraint for one integration type per organization
-- First, drop the old unique constraint if it exists
DROP INDEX IF EXISTS integrations_type_unique_idx;

-- Add new unique constraint on organization_id + type
CREATE UNIQUE INDEX IF NOT EXISTS integrations_org_type_unique_idx ON integrations(organization_id, type);

-- Update the type check to include new integration types
ALTER TABLE integrations DROP CONSTRAINT IF EXISTS integrations_type_check;
ALTER TABLE integrations ADD CONSTRAINT integrations_type_check
  CHECK (type IN ('hubspot', 'bigquery', 'slack', 'google_calendar', 'outlook_calendar', 'remarkable'));

-- ============================================
-- INTEGRATION TYPES REGISTRY
-- Defines available integration types and their configuration
-- ============================================
CREATE TABLE IF NOT EXISTS integration_types (
  id TEXT PRIMARY KEY, -- 'google_calendar', 'outlook_calendar', 'slack', 'remarkable'
  name TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  auth_type TEXT NOT NULL, -- 'oauth2', 'api_key', 'device_code'
  scope_level TEXT NOT NULL DEFAULT 'organization', -- 'organization' or 'user'
  oauth_scopes TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed integration types
INSERT INTO integration_types (id, name, description, auth_type, scope_level, oauth_scopes) VALUES
  ('google_calendar', 'Google Calendar', 'Sync L10 meetings with Google Calendar', 'oauth2', 'user',
   ARRAY['https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/calendar.readonly']),
  ('outlook_calendar', 'Outlook Calendar', 'Sync L10 meetings with Microsoft Outlook', 'oauth2', 'user',
   ARRAY['Calendars.ReadWrite', 'offline_access']),
  ('slack', 'Slack', 'Notifications and slash commands in Slack', 'oauth2', 'organization',
   ARRAY['chat:write', 'commands', 'channels:read', 'users:read', 'users:read.email']),
  ('remarkable', 'reMarkable', 'Push meeting agendas to reMarkable tablet', 'device_code', 'user', NULL)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  auth_type = EXCLUDED.auth_type,
  scope_level = EXCLUDED.scope_level,
  oauth_scopes = EXCLUDED.oauth_scopes;

-- ============================================
-- USER INTEGRATIONS TABLE
-- User-level connections (calendars, reMarkable)
-- Tokens are encrypted at the application layer
-- ============================================
CREATE TABLE IF NOT EXISTS user_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  integration_type TEXT REFERENCES integration_types(id) NOT NULL,
  -- Tokens are encrypted at application layer before storage
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  -- Provider-specific config (calendar ID, folder path, etc.)
  config JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'error', 'disconnected')),
  error_message TEXT,
  connected_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- One integration type per user
  UNIQUE(profile_id, integration_type)
);

CREATE INDEX IF NOT EXISTS user_integrations_profile_id_idx ON user_integrations(profile_id);
CREATE INDEX IF NOT EXISTS user_integrations_organization_id_idx ON user_integrations(organization_id);
CREATE INDEX IF NOT EXISTS user_integrations_type_idx ON user_integrations(integration_type);
CREATE INDEX IF NOT EXISTS user_integrations_status_idx ON user_integrations(status);

-- ============================================
-- OAUTH STATES TABLE
-- Temporary storage for OAuth flow security
-- ============================================
CREATE TABLE IF NOT EXISTS oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state TEXT NOT NULL UNIQUE,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  integration_type TEXT NOT NULL,
  redirect_uri TEXT,
  metadata JSONB DEFAULT '{}',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS oauth_states_state_idx ON oauth_states(state);
CREATE INDEX IF NOT EXISTS oauth_states_expires_at_idx ON oauth_states(expires_at);

-- Clean up expired states automatically (optional - can use cron instead)
-- CREATE INDEX IF NOT EXISTS oauth_states_cleanup_idx ON oauth_states(expires_at) WHERE expires_at < NOW();

-- ============================================
-- CALENDAR SYNC FIELDS ON L10 MEETINGS
-- ============================================
ALTER TABLE l10_meetings ADD COLUMN IF NOT EXISTS external_calendar_event_id TEXT;
ALTER TABLE l10_meetings ADD COLUMN IF NOT EXISTS external_calendar_provider TEXT;
ALTER TABLE l10_meetings ADD COLUMN IF NOT EXISTS calendar_sync_enabled BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS l10_meetings_calendar_event_idx ON l10_meetings(external_calendar_event_id) WHERE external_calendar_event_id IS NOT NULL;

-- ============================================
-- INTEGRATION EVENTS TABLE
-- Audit log and queue for integration events
-- ============================================
CREATE TABLE IF NOT EXISTS integration_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS integration_events_organization_id_idx ON integration_events(organization_id);
CREATE INDEX IF NOT EXISTS integration_events_event_type_idx ON integration_events(event_type);
CREATE INDEX IF NOT EXISTS integration_events_created_at_idx ON integration_events(created_at DESC);
CREATE INDEX IF NOT EXISTS integration_events_unprocessed_idx ON integration_events(organization_id, event_type)
  WHERE processed_at IS NULL;

-- ============================================
-- RLS POLICIES
-- ============================================

-- User Integrations: Users can only manage their own integrations
ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own integrations"
  ON user_integrations FOR SELECT
  USING (profile_id = (SELECT id FROM profiles WHERE clerk_id = auth.jwt() ->> 'sub'));

CREATE POLICY "Users can insert own integrations"
  ON user_integrations FOR INSERT
  WITH CHECK (profile_id = (SELECT id FROM profiles WHERE clerk_id = auth.jwt() ->> 'sub'));

CREATE POLICY "Users can update own integrations"
  ON user_integrations FOR UPDATE
  USING (profile_id = (SELECT id FROM profiles WHERE clerk_id = auth.jwt() ->> 'sub'));

CREATE POLICY "Users can delete own integrations"
  ON user_integrations FOR DELETE
  USING (profile_id = (SELECT id FROM profiles WHERE clerk_id = auth.jwt() ->> 'sub'));

-- OAuth States: Users can only access their own states
ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own oauth states"
  ON oauth_states FOR SELECT
  USING (profile_id = (SELECT id FROM profiles WHERE clerk_id = auth.jwt() ->> 'sub'));

CREATE POLICY "Users can insert own oauth states"
  ON oauth_states FOR INSERT
  WITH CHECK (profile_id = (SELECT id FROM profiles WHERE clerk_id = auth.jwt() ->> 'sub'));

CREATE POLICY "Users can delete own oauth states"
  ON oauth_states FOR DELETE
  USING (profile_id = (SELECT id FROM profiles WHERE clerk_id = auth.jwt() ->> 'sub'));

-- Integration Types: All authenticated users can view
ALTER TABLE integration_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view integration types"
  ON integration_types FOR SELECT
  USING (auth.role() = 'authenticated');

-- Integration Events: Admins can view, system can manage
ALTER TABLE integration_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view integration events"
  ON integration_events FOR SELECT
  USING (
    organization_id = get_current_organization_id()
    AND get_current_access_level() = 'admin'
  );

-- Note: INSERT is handled by service role from application layer

-- ============================================
-- TRIGGERS
-- ============================================

-- Updated_at trigger for user_integrations
CREATE TRIGGER update_user_integrations_updated_at
  BEFORE UPDATE ON user_integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get user's active integration of a specific type
CREATE OR REPLACE FUNCTION get_user_integration(p_profile_id UUID, p_integration_type TEXT)
RETURNS user_integrations AS $$
  SELECT * FROM user_integrations
  WHERE profile_id = p_profile_id
  AND integration_type = p_integration_type
  AND status = 'active'
  LIMIT 1
$$ LANGUAGE SQL SECURITY DEFINER;

-- Clean up expired OAuth states (call periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_states()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM oauth_states WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
