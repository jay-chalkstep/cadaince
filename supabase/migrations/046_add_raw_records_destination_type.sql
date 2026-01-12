-- Migration: add_raw_records_destination_type
-- Purpose: Add raw_records to destination_type check constraint

-- Drop the existing constraint
ALTER TABLE data_sources_v2 DROP CONSTRAINT IF EXISTS data_sources_v2_destination_type_check;

-- Add updated constraint including raw_records
ALTER TABLE data_sources_v2 ADD CONSTRAINT data_sources_v2_destination_type_check
CHECK (destination_type IN (
  'scorecard_metric',
  'issue_detection',
  'customer_health',
  'team_health',
  'rock_progress',
  'signal',
  'raw_records'
));
