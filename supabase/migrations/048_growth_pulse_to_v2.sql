-- Migration: 048_growth_pulse_to_v2
-- Purpose: Migrate Growth Pulse to use data_sources_v2 pattern
--
-- This migration:
-- 1. Adds 'growth_pulse' to destination_type constraint
-- 2. Seeds data_sources_v2 records for existing HubSpot integrations
-- 3. Adds deprecation comment to growth_pulse_sync_log

-- =============================================================================
-- 1. Add growth_pulse destination type
-- =============================================================================

ALTER TABLE data_sources_v2 DROP CONSTRAINT IF EXISTS data_sources_v2_destination_type_check;

ALTER TABLE data_sources_v2 ADD CONSTRAINT data_sources_v2_destination_type_check
CHECK (destination_type IN (
  'scorecard_metric',
  'issue_detection',
  'customer_health',
  'team_health',
  'rock_progress',
  'signal',
  'raw_records',
  'growth_pulse'
));

-- =============================================================================
-- 2. Seed data_sources_v2 for existing HubSpot integrations
-- =============================================================================

-- Create Growth Pulse - Owners data source
INSERT INTO data_sources_v2 (
  organization_id,
  integration_id,
  name,
  description,
  source_type,
  query_config,
  destination_type,
  destination_config,
  sync_frequency,
  is_active,
  created_at,
  updated_at
)
SELECT
  i.organization_id,
  i.id,
  'Growth Pulse - Owners',
  'HubSpot sales owner data for Growth Pulse analytics',
  'hubspot_owners',
  '{"object": "owners"}'::jsonb,
  'growth_pulse',
  '{"entity_type": "owners"}'::jsonb,
  'daily',
  true,
  NOW(),
  NOW()
FROM integrations_v2 i
WHERE i.provider = 'hubspot'
  AND i.status = 'active'
ON CONFLICT DO NOTHING;

-- Create Growth Pulse - Deals data source
INSERT INTO data_sources_v2 (
  organization_id,
  integration_id,
  name,
  description,
  source_type,
  query_config,
  destination_type,
  destination_config,
  sync_frequency,
  is_active,
  created_at,
  updated_at
)
SELECT
  i.organization_id,
  i.id,
  'Growth Pulse - Deals',
  'HubSpot deal pipeline data with stage history tracking',
  'hubspot_deals',
  '{
    "object": "deals",
    "properties": [
      "hs_object_id", "dealname", "amount", "hs_arr", "dealstage",
      "pipeline", "dealtype", "offering", "closedate", "createdate",
      "hubspot_owner_id", "hs_deal_stage_probability",
      "hs_forecast_amount", "hs_forecast_category", "hs_lastmodifieddate"
    ],
    "associations": ["companies"]
  }'::jsonb,
  'growth_pulse',
  '{"entity_type": "deals", "track_stage_history": true}'::jsonb,
  '15min',
  true,
  NOW(),
  NOW()
FROM integrations_v2 i
WHERE i.provider = 'hubspot'
  AND i.status = 'active'
ON CONFLICT DO NOTHING;

-- Create Growth Pulse - Activities data source
INSERT INTO data_sources_v2 (
  organization_id,
  integration_id,
  name,
  description,
  source_type,
  query_config,
  destination_type,
  destination_config,
  sync_frequency,
  is_active,
  created_at,
  updated_at
)
SELECT
  i.organization_id,
  i.id,
  'Growth Pulse - Activities',
  'HubSpot engagement activities (calls, emails, meetings, notes, tasks)',
  'hubspot_activities',
  '{
    "activity_types": ["calls", "emails", "meetings", "notes", "tasks"],
    "associations": ["deals", "contacts", "companies"]
  }'::jsonb,
  'growth_pulse',
  '{"entity_type": "activities"}'::jsonb,
  'hourly',
  true,
  NOW(),
  NOW()
FROM integrations_v2 i
WHERE i.provider = 'hubspot'
  AND i.status = 'active'
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 3. Add deprecation comment to growth_pulse_sync_log
-- =============================================================================

COMMENT ON TABLE growth_pulse_sync_log IS
  'DEPRECATED: Historical sync logs for Growth Pulse. New syncs are logged to data_source_syncs table. This table will be removed in a future migration.';

-- =============================================================================
-- 4. Add unique constraint for Growth Pulse data sources (prevent duplicates)
-- =============================================================================

-- Create unique index on (organization_id, source_type) for growth_pulse destinations
-- This ensures each org has at most one of each Growth Pulse data source type
CREATE UNIQUE INDEX IF NOT EXISTS idx_data_sources_v2_growth_pulse_unique
ON data_sources_v2 (organization_id, source_type)
WHERE destination_type = 'growth_pulse';
