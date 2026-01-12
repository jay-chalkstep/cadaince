-- Migration: integration_records
-- Purpose: Store raw records from integrations (HubSpot, etc.) for flexible querying

-- Create integration_records table
CREATE TABLE integration_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  data_source_id UUID NOT NULL REFERENCES data_sources_v2(id) ON DELETE CASCADE,

  -- External record identity
  external_id TEXT NOT NULL,           -- e.g., HubSpot ticket ID "12345"
  object_type TEXT NOT NULL,           -- "tickets", "deals", "contacts", etc.

  -- The actual data (flexible JSONB)
  properties JSONB NOT NULL DEFAULT '{}',

  -- Timestamps from source system
  external_created_at TIMESTAMPTZ,
  external_updated_at TIMESTAMPTZ,

  -- Our timestamps
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicates per data source
  UNIQUE(data_source_id, external_id)
);

-- Indexes for common query patterns
CREATE INDEX idx_integration_records_org ON integration_records(organization_id);
CREATE INDEX idx_integration_records_ds ON integration_records(data_source_id);
CREATE INDEX idx_integration_records_object ON integration_records(object_type);
CREATE INDEX idx_integration_records_synced ON integration_records(synced_at DESC);
CREATE INDEX idx_integration_records_external_updated ON integration_records(external_updated_at DESC);

-- GIN index for JSONB property queries
CREATE INDEX idx_integration_records_props ON integration_records USING GIN(properties);

-- Trigger for updated_at
CREATE TRIGGER update_integration_records_updated_at
  BEFORE UPDATE ON integration_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE integration_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies (using profiles table like other v2 tables)
CREATE POLICY "Users can view org integration records"
ON integration_records FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE clerk_id = auth.uid()::text
  )
);

CREATE POLICY "Users can insert org integration records"
ON integration_records FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE clerk_id = auth.uid()::text
  )
);

CREATE POLICY "Users can update org integration records"
ON integration_records FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE clerk_id = auth.uid()::text
  )
);

CREATE POLICY "Users can delete org integration records"
ON integration_records FOR DELETE
USING (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE clerk_id = auth.uid()::text
  )
);

-- Comment
COMMENT ON TABLE integration_records IS 'Stores raw records from external integrations (HubSpot, etc.) with flexible JSONB properties';
COMMENT ON COLUMN integration_records.external_id IS 'ID from the source system (e.g., HubSpot object ID)';
COMMENT ON COLUMN integration_records.object_type IS 'Type of object (tickets, deals, contacts, companies, etc.)';
COMMENT ON COLUMN integration_records.properties IS 'All properties fetched from the source system';
