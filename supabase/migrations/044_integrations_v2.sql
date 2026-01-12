-- Migration 044: Integrations V2 - Org-Scoped Integration System
-- Replaces user-scoped user_integrations (027) with unified org-level approach

-- ============================================
-- 1. INTEGRATIONS_V2 TABLE
-- Org-scoped OAuth connections to external services
-- ============================================

CREATE TABLE integrations_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Provider identity
  provider TEXT NOT NULL CHECK (provider IN ('slack', 'hubspot', 'salesforce', 'gong', 'salesloft', 'bigquery')),
  display_name TEXT,

  -- OAuth tokens (encrypted at application layer before storage)
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,

  -- Service account credentials (for BigQuery)
  service_account_json_encrypted TEXT,

  -- OAuth metadata
  oauth_scope TEXT,
  external_account_id TEXT,   -- Provider's account ID (Slack team_id, HubSpot portal_id, etc.)
  external_account_name TEXT, -- Human-readable account name from provider

  -- Connection status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'error', 'disconnected', 'expired')),
  status_message TEXT,
  last_successful_connection_at TIMESTAMPTZ,
  last_error TEXT,
  last_error_at TIMESTAMPTZ,

  -- Provider-specific configuration (JSONB)
  config JSONB DEFAULT '{}',

  -- Audit
  connected_by_profile_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One integration per provider per organization
  UNIQUE(organization_id, provider)
);

-- Indexes
CREATE INDEX idx_integrations_v2_org ON integrations_v2(organization_id);
CREATE INDEX idx_integrations_v2_provider ON integrations_v2(provider);
CREATE INDEX idx_integrations_v2_status ON integrations_v2(status);
CREATE INDEX idx_integrations_v2_active ON integrations_v2(organization_id, status) WHERE status = 'active';

-- ============================================
-- 2. DATA_SOURCES_V2 TABLE
-- Defines what data to pull from each integration
-- ============================================

CREATE TABLE data_sources_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES integrations_v2(id) ON DELETE CASCADE,

  -- Identity
  name TEXT NOT NULL,
  description TEXT,

  -- What to pull
  source_type TEXT NOT NULL, -- Provider-specific: 'hubspot_deals', 'salesforce_opportunities', 'gong_calls', etc.
  query_config JSONB NOT NULL DEFAULT '{}',
  -- Examples:
  -- HubSpot: {"object": "deals", "property": "amount", "aggregation": "sum", "filters": [...]}
  -- BigQuery: {"query": "SELECT ...", "value_column": "total"}
  -- Gong: {"call_type": "demo", "metric": "talk_ratio"}

  -- Where to send the data
  destination_type TEXT NOT NULL DEFAULT 'signal' CHECK (destination_type IN (
    'scorecard_metric',   -- Updates a specific scorecard metric
    'issue_detection',    -- Triggers issue creation based on thresholds
    'customer_health',    -- Feeds customer health scoring
    'team_health',        -- Feeds team health scoring
    'rock_progress',      -- Auto-updates rock progress
    'signal'              -- Raw signal for AI/briefing consumption
  )),
  destination_config JSONB DEFAULT '{}',

  -- Sync settings
  sync_frequency TEXT DEFAULT 'hourly' CHECK (sync_frequency IN ('5min', '15min', 'hourly', 'daily', 'manual')),
  is_active BOOLEAN DEFAULT true,

  -- Status
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT CHECK (last_sync_status IN ('success', 'error', 'running')),
  last_sync_error TEXT,
  last_sync_records_count INTEGER,
  next_scheduled_sync_at TIMESTAMPTZ,

  -- Audit
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_data_sources_v2_org ON data_sources_v2(organization_id);
CREATE INDEX idx_data_sources_v2_integration ON data_sources_v2(integration_id);
CREATE INDEX idx_data_sources_v2_active ON data_sources_v2(is_active) WHERE is_active = true;
CREATE INDEX idx_data_sources_v2_next_sync ON data_sources_v2(next_scheduled_sync_at) WHERE is_active = true;
CREATE INDEX idx_data_sources_v2_destination ON data_sources_v2(destination_type);

-- ============================================
-- 3. DATA_SOURCE_SYNCS TABLE
-- Sync execution history for auditing and debugging
-- ============================================

CREATE TABLE data_source_syncs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_source_id UUID NOT NULL REFERENCES data_sources_v2(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Timing
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,

  -- Results
  status TEXT DEFAULT 'running' CHECK (status IN ('running', 'success', 'error', 'cancelled')),
  records_fetched INTEGER DEFAULT 0,
  records_processed INTEGER DEFAULT 0,
  signals_created INTEGER DEFAULT 0,

  -- Error tracking
  error_message TEXT,
  error_details JSONB,

  -- Trigger info
  triggered_by TEXT DEFAULT 'scheduled' CHECK (triggered_by IN ('scheduled', 'manual', 'webhook', 'retry')),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_data_source_syncs_ds ON data_source_syncs(data_source_id);
CREATE INDEX idx_data_source_syncs_org ON data_source_syncs(organization_id);
CREATE INDEX idx_data_source_syncs_started ON data_source_syncs(started_at DESC);
CREATE INDEX idx_data_source_syncs_status ON data_source_syncs(status) WHERE status = 'running';

-- ============================================
-- 4. SIGNALS TABLE
-- Raw data landing zone from integrations
-- Processed into metrics, issues, health scores, etc.
-- ============================================

CREATE TABLE signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  data_source_id UUID REFERENCES data_sources_v2(id) ON DELETE SET NULL,

  -- Signal identity
  signal_type TEXT NOT NULL, -- 'metric_value', 'deal_closed', 'call_completed', 'anomaly', etc.
  signal_category TEXT NOT NULL, -- 'business_metric', 'customer_health', 'team_health', 'activity', etc.
  external_id TEXT, -- ID from source system for deduplication

  -- Signal data
  title TEXT NOT NULL,
  description TEXT,
  value NUMERIC,
  value_unit TEXT, -- '$', '%', 'count', 'score', etc.
  value_context JSONB, -- Additional context: previous_value, change_pct, benchmark, etc.
  metadata JSONB DEFAULT '{}',

  -- Source reference
  source_provider TEXT NOT NULL,
  source_entity_type TEXT, -- 'deal', 'call', 'channel', 'user', etc.
  source_entity_id TEXT, -- ID in source system
  source_url TEXT, -- Deep link to source system

  -- Severity/importance
  severity TEXT DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),

  -- Timing
  occurred_at TIMESTAMPTZ NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW(),

  -- Processing status
  processed_at TIMESTAMPTZ,
  processed_into_type TEXT, -- 'metric', 'issue', 'briefing', etc.
  processed_into_id UUID,
  processing_error TEXT,

  -- Expiry (some signals are time-sensitive)
  expires_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_signals_org ON signals(organization_id);
CREATE INDEX idx_signals_ds ON signals(data_source_id);
CREATE INDEX idx_signals_type ON signals(signal_type);
CREATE INDEX idx_signals_category ON signals(organization_id, signal_category);
CREATE INDEX idx_signals_occurred ON signals(occurred_at DESC);
CREATE INDEX idx_signals_unprocessed ON signals(organization_id) WHERE processed_at IS NULL;
CREATE INDEX idx_signals_severity ON signals(severity) WHERE severity IN ('warning', 'critical');
CREATE INDEX idx_signals_expires ON signals(expires_at) WHERE expires_at IS NOT NULL;

-- Prevent duplicate signals from same source (when external_id provided)
CREATE UNIQUE INDEX idx_signals_dedup ON signals(data_source_id, external_id) WHERE external_id IS NOT NULL;

-- ============================================
-- 5. RLS POLICIES
-- ============================================

ALTER TABLE integrations_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_sources_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_source_syncs ENABLE ROW LEVEL SECURITY;
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;

-- Integrations: All org members can view, admins can manage
CREATE POLICY "Users can view org integrations"
ON integrations_v2 FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE clerk_id = auth.uid()::text
  )
);

CREATE POLICY "Admins can insert integrations"
ON integrations_v2 FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM profiles
    WHERE clerk_id = auth.uid()::text AND access_level = 'admin'
  )
);

CREATE POLICY "Admins can update integrations"
ON integrations_v2 FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id FROM profiles
    WHERE clerk_id = auth.uid()::text AND access_level = 'admin'
  )
);

CREATE POLICY "Admins can delete integrations"
ON integrations_v2 FOR DELETE
USING (
  organization_id IN (
    SELECT organization_id FROM profiles
    WHERE clerk_id = auth.uid()::text AND access_level = 'admin'
  )
);

-- Data Sources: All org members can view, admins can manage
CREATE POLICY "Users can view org data sources"
ON data_sources_v2 FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE clerk_id = auth.uid()::text
  )
);

CREATE POLICY "Admins can insert data sources"
ON data_sources_v2 FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM profiles
    WHERE clerk_id = auth.uid()::text AND access_level = 'admin'
  )
);

CREATE POLICY "Admins can update data sources"
ON data_sources_v2 FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id FROM profiles
    WHERE clerk_id = auth.uid()::text AND access_level = 'admin'
  )
);

CREATE POLICY "Admins can delete data sources"
ON data_sources_v2 FOR DELETE
USING (
  organization_id IN (
    SELECT organization_id FROM profiles
    WHERE clerk_id = auth.uid()::text AND access_level = 'admin'
  )
);

-- Data Source Syncs: Read-only for org members (system inserts)
CREATE POLICY "Users can view org sync history"
ON data_source_syncs FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE clerk_id = auth.uid()::text
  )
);

-- Signals: Read-only for org members (system inserts)
CREATE POLICY "Users can view org signals"
ON signals FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE clerk_id = auth.uid()::text
  )
);

-- ============================================
-- 6. TRIGGERS
-- ============================================

-- Updated_at triggers
CREATE TRIGGER update_integrations_v2_updated_at
  BEFORE UPDATE ON integrations_v2
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_data_sources_v2_updated_at
  BEFORE UPDATE ON data_sources_v2
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 7. HELPER FUNCTIONS
-- ============================================

-- Get active integration for a provider
CREATE OR REPLACE FUNCTION get_org_integration(p_organization_id UUID, p_provider TEXT)
RETURNS integrations_v2 AS $$
  SELECT * FROM integrations_v2
  WHERE organization_id = p_organization_id
    AND provider = p_provider
    AND status = 'active'
  LIMIT 1
$$ LANGUAGE SQL SECURITY DEFINER;

-- Check if integration is connected
CREATE OR REPLACE FUNCTION is_integration_connected(p_organization_id UUID, p_provider TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM integrations_v2
    WHERE organization_id = p_organization_id
      AND provider = p_provider
      AND status = 'active'
  )
$$ LANGUAGE SQL SECURITY DEFINER;

-- Get integrations expiring soon (for refresh job)
CREATE OR REPLACE FUNCTION get_expiring_integrations(p_hours_ahead INTEGER DEFAULT 1)
RETURNS SETOF integrations_v2 AS $$
  SELECT * FROM integrations_v2
  WHERE status = 'active'
    AND token_expires_at IS NOT NULL
    AND token_expires_at < NOW() + (p_hours_ahead || ' hours')::INTERVAL
$$ LANGUAGE SQL SECURITY DEFINER;

-- ============================================
-- 8. DATA MIGRATION FROM EXISTING TABLES
-- ============================================

-- Migrate existing Slack workspaces to integrations_v2
INSERT INTO integrations_v2 (
  organization_id,
  provider,
  display_name,
  access_token_encrypted,
  external_account_id,
  external_account_name,
  status,
  connected_by_profile_id,
  created_at,
  last_successful_connection_at,
  config
)
SELECT
  sw.organization_id,
  'slack',
  COALESCE(sw.workspace_name, 'Slack'),
  sw.access_token,  -- Already encrypted at app layer
  sw.workspace_id,
  sw.workspace_name,
  CASE WHEN sw.is_active THEN 'active' ELSE 'disconnected' END,
  sw.connected_by,
  sw.created_at,
  CASE WHEN sw.is_active THEN sw.created_at ELSE NULL END,
  jsonb_build_object(
    'bot_user_id', sw.bot_user_id,
    'team_icon_url', sw.team_icon_url,
    'migrated_from', 'slack_workspaces'
  )
FROM slack_workspaces sw
WHERE sw.organization_id IS NOT NULL
ON CONFLICT (organization_id, provider) DO NOTHING;

-- Migrate existing HubSpot/BigQuery from old integrations table
INSERT INTO integrations_v2 (
  organization_id,
  provider,
  display_name,
  status,
  config,
  created_at,
  last_successful_connection_at
)
SELECT
  i.organization_id,
  i.type,
  i.name,
  CASE WHEN i.is_active THEN 'active' ELSE 'disconnected' END,
  jsonb_build_object(
    'legacy_config', i.config,
    'migrated_from', 'integrations'
  ),
  i.created_at,
  CASE WHEN i.is_active THEN i.created_at ELSE NULL END
FROM integrations i
WHERE i.organization_id IS NOT NULL
  AND i.type IN ('hubspot', 'bigquery')
ON CONFLICT (organization_id, provider) DO NOTHING;

-- Note: user_integrations (calendar, remarkable) remain user-scoped and are not migrated
