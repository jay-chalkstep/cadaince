-- Fix pillars unique constraint to be per-organization instead of global
-- The original constraint (pillars_slug_key) was on slug alone, but slug
-- should only be unique within an organization

-- Drop the global unique constraint on slug
ALTER TABLE pillars DROP CONSTRAINT IF EXISTS pillars_slug_key;

-- Add composite unique constraint on organization_id + slug
-- This allows different organizations to have pillars with the same slug
ALTER TABLE pillars ADD CONSTRAINT pillars_org_slug_unique UNIQUE (organization_id, slug);
