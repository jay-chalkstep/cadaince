-- Fix: Add organization_id to data_sources for multi-tenancy
-- The data_sources table was missing organization_id column which caused 400 errors

-- Add organization_id column
ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- Backfill organization_id from the creator's profile
UPDATE data_sources ds
SET organization_id = p.organization_id
FROM profiles p
WHERE ds.created_by = p.id AND ds.organization_id IS NULL;

-- Make it NOT NULL after backfill
ALTER TABLE data_sources ALTER COLUMN organization_id SET NOT NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_data_sources_organization_id ON data_sources(organization_id);

-- Enable RLS
ALTER TABLE data_sources ENABLE ROW LEVEL SECURITY;

-- RLS policy for tenant isolation
DROP POLICY IF EXISTS "Users can view org data sources" ON data_sources;
CREATE POLICY "Users can view org data sources" ON data_sources
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE clerk_id = auth.uid()::text
    )
  );
