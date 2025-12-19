-- Aicomplice Database Schema
-- Migration 012: Organizations & Multi-Tenant Support

-- ============================================
-- ORGANIZATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  settings JSONB DEFAULT '{}',
  onboarding_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- ============================================
-- ADD organization_id TO EXISTING TABLES
-- ============================================

-- Pillars
ALTER TABLE pillars ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- Profiles (team_members)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- Metrics
ALTER TABLE metrics ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- Rocks
ALTER TABLE rocks ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- Issues
ALTER TABLE issues ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- Todos
ALTER TABLE todos ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- Updates
ALTER TABLE updates ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- Alerts
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- Private Notes
ALTER TABLE private_notes ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- Meetings
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- Briefings
ALTER TABLE briefings ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- VTO (already has organization_id, but let's add FK if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'vto_organization_id_fkey'
  ) THEN
    ALTER TABLE vto ADD CONSTRAINT vto_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES organizations(id);
  END IF;
END $$;

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS organizations_slug_idx ON organizations(slug);
CREATE INDEX IF NOT EXISTS pillars_organization_id_idx ON pillars(organization_id);
CREATE INDEX IF NOT EXISTS profiles_organization_id_idx ON profiles(organization_id);
CREATE INDEX IF NOT EXISTS metrics_organization_id_idx ON metrics(organization_id);
CREATE INDEX IF NOT EXISTS rocks_organization_id_idx ON rocks(organization_id);
CREATE INDEX IF NOT EXISTS issues_organization_id_idx ON issues(organization_id);
CREATE INDEX IF NOT EXISTS todos_organization_id_idx ON todos(organization_id);
CREATE INDEX IF NOT EXISTS updates_organization_id_idx ON updates(organization_id);
CREATE INDEX IF NOT EXISTS alerts_organization_id_idx ON alerts(organization_id);
CREATE INDEX IF NOT EXISTS private_notes_organization_id_idx ON private_notes(organization_id);
CREATE INDEX IF NOT EXISTS meetings_organization_id_idx ON meetings(organization_id);
CREATE INDEX IF NOT EXISTS briefings_organization_id_idx ON briefings(organization_id);

-- ============================================
-- RLS POLICIES FOR ORGANIZATIONS
-- ============================================

-- Helper function to get user's organization
CREATE OR REPLACE FUNCTION get_current_organization_id()
RETURNS UUID AS $$
  SELECT organization_id FROM profiles WHERE clerk_id = auth.jwt() ->> 'sub'
$$ LANGUAGE SQL SECURITY DEFINER;

-- Organization policies
CREATE POLICY "Users can view own organization"
  ON organizations FOR SELECT
  USING (id = get_current_organization_id());

CREATE POLICY "Admins can update own organization"
  ON organizations FOR UPDATE
  USING (id = get_current_organization_id() AND get_current_access_level() = 'admin');

CREATE POLICY "Anyone can create organization during onboarding"
  ON organizations FOR INSERT
  WITH CHECK (true);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
