-- Migration 047: Growth Pulse - HubSpot Deal Pipeline Analytics
-- Tables for storing HubSpot deals, owners, activities, and stage history

-- ============================================
-- 1. HUBSPOT_OWNERS TABLE
-- Dedicated HubSpot owner table (migrating from integration_records)
-- ============================================

CREATE TABLE hubspot_owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  hubspot_owner_id TEXT NOT NULL,

  -- Owner info
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  user_id TEXT,
  teams JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,

  -- Sync tracking
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, hubspot_owner_id)
);

-- Indexes
CREATE INDEX idx_hubspot_owners_org ON hubspot_owners(organization_id);
CREATE INDEX idx_hubspot_owners_hubspot_id ON hubspot_owners(hubspot_owner_id);
CREATE INDEX idx_hubspot_owners_active ON hubspot_owners(organization_id) WHERE is_active = true;

-- ============================================
-- 2. HUBSPOT_DEALS TABLE
-- Deal records with denormalized key fields
-- ============================================

CREATE TABLE hubspot_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  hubspot_deal_id TEXT NOT NULL,

  -- Core deal info
  deal_name TEXT,
  amount NUMERIC,
  hs_arr NUMERIC,
  deal_stage TEXT,
  pipeline TEXT,
  deal_type TEXT,
  offering TEXT,

  -- Dates
  close_date TIMESTAMPTZ,
  create_date TIMESTAMPTZ,

  -- Owner (HubSpot owner ID - joins to hubspot_owners.hubspot_owner_id)
  owner_id TEXT,

  -- Company association
  company_id TEXT,
  company_name TEXT,

  -- Forecasting
  deal_stage_probability NUMERIC,
  forecast_amount NUMERIC,
  forecast_category TEXT,

  -- Full properties for flexibility
  properties JSONB DEFAULT '{}',

  -- Sync tracking
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  external_created_at TIMESTAMPTZ,
  external_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, hubspot_deal_id)
);

-- Indexes
CREATE INDEX idx_hubspot_deals_org ON hubspot_deals(organization_id);
CREATE INDEX idx_hubspot_deals_owner ON hubspot_deals(organization_id, owner_id);
CREATE INDEX idx_hubspot_deals_stage ON hubspot_deals(organization_id, deal_stage);
CREATE INDEX idx_hubspot_deals_pipeline ON hubspot_deals(organization_id, pipeline);
CREATE INDEX idx_hubspot_deals_close_date ON hubspot_deals(organization_id, close_date);
CREATE INDEX idx_hubspot_deals_create_date ON hubspot_deals(organization_id, create_date);
CREATE INDEX idx_hubspot_deals_open ON hubspot_deals(organization_id)
  WHERE deal_stage NOT IN ('closedwon', 'closedlost');

-- ============================================
-- 3. HUBSPOT_DEAL_STAGE_HISTORY TABLE
-- Self-tracked stage transitions (HubSpot doesn't expose this)
-- ============================================

CREATE TABLE hubspot_deal_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL REFERENCES hubspot_deals(id) ON DELETE CASCADE,
  hubspot_deal_id TEXT NOT NULL,

  -- Stage transition
  from_stage TEXT,
  to_stage TEXT NOT NULL,

  -- Duration tracking
  entered_at TIMESTAMPTZ NOT NULL,
  exited_at TIMESTAMPTZ,
  duration_ms BIGINT,

  -- Snapshot of deal at transition
  deal_amount NUMERIC,
  deal_arr NUMERIC,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_deal_stage_history_deal ON hubspot_deal_stage_history(deal_id);
CREATE INDEX idx_deal_stage_history_org_deal ON hubspot_deal_stage_history(organization_id, hubspot_deal_id);
CREATE INDEX idx_deal_stage_history_entered ON hubspot_deal_stage_history(entered_at);
CREATE INDEX idx_deal_stage_history_current ON hubspot_deal_stage_history(deal_id)
  WHERE exited_at IS NULL;

-- ============================================
-- 4. HUBSPOT_ACTIVITIES TABLE
-- Engagement records (calls, emails, meetings, notes, tasks)
-- ============================================

CREATE TABLE hubspot_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  hubspot_activity_id TEXT NOT NULL,

  -- Activity type
  activity_type TEXT NOT NULL,

  -- Associated records (HubSpot IDs)
  deal_id TEXT,
  contact_id TEXT,
  company_id TEXT,
  owner_id TEXT,

  -- Activity details
  subject TEXT,
  body TEXT,
  activity_date TIMESTAMPTZ,
  duration_ms BIGINT,

  -- Full properties
  properties JSONB DEFAULT '{}',

  -- Sync tracking
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, hubspot_activity_id)
);

-- Indexes
CREATE INDEX idx_hubspot_activities_org ON hubspot_activities(organization_id);
CREATE INDEX idx_hubspot_activities_deal ON hubspot_activities(organization_id, deal_id);
CREATE INDEX idx_hubspot_activities_owner ON hubspot_activities(organization_id, owner_id);
CREATE INDEX idx_hubspot_activities_date ON hubspot_activities(activity_date DESC);
CREATE INDEX idx_hubspot_activities_type ON hubspot_activities(organization_id, activity_type);

-- ============================================
-- 5. GROWTH_PULSE_SYNC_LOG TABLE
-- Sync execution tracking
-- ============================================

CREATE TABLE growth_pulse_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Sync identity
  sync_type TEXT NOT NULL CHECK (sync_type IN ('owners', 'deals', 'activities', 'full')),
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'error')),

  -- Timing
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,

  -- Results
  records_fetched INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  stage_changes_detected INTEGER DEFAULT 0,

  -- Error tracking
  error_message TEXT,
  error_details JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_growth_pulse_sync_log_org ON growth_pulse_sync_log(organization_id);
CREATE INDEX idx_growth_pulse_sync_log_started ON growth_pulse_sync_log(started_at DESC);
CREATE INDEX idx_growth_pulse_sync_log_status ON growth_pulse_sync_log(status) WHERE status = 'running';

-- ============================================
-- 6. RLS POLICIES
-- ============================================

ALTER TABLE hubspot_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE hubspot_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE hubspot_deal_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE hubspot_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_pulse_sync_log ENABLE ROW LEVEL SECURITY;

-- HubSpot Owners: All org members can view
CREATE POLICY "Users can view org hubspot_owners"
ON hubspot_owners FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE clerk_id = auth.uid()::text
  )
);

-- HubSpot Deals: All org members can view
CREATE POLICY "Users can view org hubspot_deals"
ON hubspot_deals FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE clerk_id = auth.uid()::text
  )
);

-- HubSpot Deal Stage History: All org members can view
CREATE POLICY "Users can view org deal stage history"
ON hubspot_deal_stage_history FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE clerk_id = auth.uid()::text
  )
);

-- HubSpot Activities: All org members can view
CREATE POLICY "Users can view org hubspot_activities"
ON hubspot_activities FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE clerk_id = auth.uid()::text
  )
);

-- Growth Pulse Sync Log: All org members can view
CREATE POLICY "Users can view org sync log"
ON growth_pulse_sync_log FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE clerk_id = auth.uid()::text
  )
);

-- ============================================
-- 7. TRIGGERS
-- ============================================

-- Updated_at triggers
CREATE TRIGGER update_hubspot_owners_updated_at
  BEFORE UPDATE ON hubspot_owners
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hubspot_deals_updated_at
  BEFORE UPDATE ON hubspot_deals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 8. COMPUTED VIEWS
-- ============================================

-- Seller Pipeline Summary View
CREATE OR REPLACE VIEW vw_seller_pipeline_summary AS
SELECT
  d.organization_id,
  d.owner_id,
  o.first_name,
  o.last_name,
  COALESCE(o.first_name || ' ' || o.last_name, 'Unknown') AS owner_name,
  o.email AS owner_email,

  -- Open pipeline
  COUNT(*) FILTER (WHERE d.deal_stage NOT IN ('closedwon', 'closedlost')) AS open_deal_count,
  COALESCE(SUM(COALESCE(d.hs_arr, d.amount)) FILTER (WHERE d.deal_stage NOT IN ('closedwon', 'closedlost')), 0) AS open_pipeline_arr,
  COALESCE(SUM(d.amount) FILTER (WHERE d.deal_stage NOT IN ('closedwon', 'closedlost')), 0) AS open_pipeline_amount,

  -- Closed won (all time)
  COUNT(*) FILTER (WHERE d.deal_stage = 'closedwon') AS closed_won_count,
  COALESCE(SUM(COALESCE(d.hs_arr, d.amount)) FILTER (WHERE d.deal_stage = 'closedwon'), 0) AS closed_won_arr,

  -- Closed won (QTD)
  COUNT(*) FILTER (WHERE d.deal_stage = 'closedwon'
    AND d.close_date >= DATE_TRUNC('quarter', CURRENT_DATE)) AS closed_won_qtd_count,
  COALESCE(SUM(COALESCE(d.hs_arr, d.amount)) FILTER (WHERE d.deal_stage = 'closedwon'
    AND d.close_date >= DATE_TRUNC('quarter', CURRENT_DATE)), 0) AS closed_won_qtd_arr,

  -- Closed lost
  COUNT(*) FILTER (WHERE d.deal_stage = 'closedlost') AS closed_lost_count,

  -- Average deal size
  COALESCE(AVG(COALESCE(d.hs_arr, d.amount)) FILTER (WHERE d.deal_stage NOT IN ('closedwon', 'closedlost')), 0) AS avg_open_deal_size,

  -- Deal age (average days since creation for open deals)
  COALESCE(AVG(EXTRACT(EPOCH FROM (NOW() - d.create_date)) / 86400) FILTER (
    WHERE d.deal_stage NOT IN ('closedwon', 'closedlost')
  ), 0) AS avg_deal_age_days

FROM hubspot_deals d
LEFT JOIN hubspot_owners o
  ON o.organization_id = d.organization_id
  AND o.hubspot_owner_id = d.owner_id
WHERE d.owner_id IS NOT NULL
GROUP BY d.organization_id, d.owner_id, o.first_name, o.last_name, o.email;

-- Organization Benchmarks View
CREATE OR REPLACE VIEW vw_org_benchmarks AS
SELECT
  organization_id,

  -- Team averages
  AVG(open_pipeline_arr) AS avg_open_pipeline,
  AVG(closed_won_qtd_arr) AS avg_closed_won_qtd,
  AVG(open_deal_count) AS avg_open_deals,
  AVG(avg_deal_age_days) AS avg_deal_age,
  AVG(avg_open_deal_size) AS avg_deal_size,

  -- Leader stats (top performer)
  MAX(closed_won_qtd_arr) AS leader_closed_won_qtd,
  MAX(open_pipeline_arr) AS leader_open_pipeline,
  MAX(open_deal_count) AS leader_open_deals,

  -- Team totals
  SUM(open_pipeline_arr) AS total_open_pipeline,
  SUM(closed_won_qtd_arr) AS total_closed_won_qtd,
  COUNT(DISTINCT owner_id) AS seller_count

FROM vw_seller_pipeline_summary
GROUP BY organization_id;

-- Pipeline by Stage View
CREATE OR REPLACE VIEW vw_pipeline_by_stage AS
SELECT
  organization_id,
  deal_stage,
  pipeline,
  COUNT(*) AS deal_count,
  COALESCE(SUM(COALESCE(hs_arr, amount)), 0) AS total_arr,
  COALESCE(SUM(amount), 0) AS total_amount,
  COALESCE(AVG(COALESCE(hs_arr, amount)), 0) AS avg_deal_size,
  COALESCE(AVG(EXTRACT(EPOCH FROM (NOW() - create_date)) / 86400), 0) AS avg_days_in_pipeline

FROM hubspot_deals
WHERE deal_stage NOT IN ('closedwon', 'closedlost')
GROUP BY organization_id, deal_stage, pipeline
ORDER BY organization_id, pipeline, deal_stage;

-- Closed Won Trend View (daily aggregation)
CREATE OR REPLACE VIEW vw_closed_won_trend AS
SELECT
  organization_id,
  DATE(close_date) AS close_day,
  COUNT(*) AS deal_count,
  COALESCE(SUM(COALESCE(hs_arr, amount)), 0) AS total_arr,
  COALESCE(SUM(amount), 0) AS total_amount

FROM hubspot_deals
WHERE deal_stage = 'closedwon'
  AND close_date IS NOT NULL
GROUP BY organization_id, DATE(close_date)
ORDER BY organization_id, close_day DESC;

-- ============================================
-- 9. DATA MIGRATION FROM INTEGRATION_RECORDS
-- Migrate existing HubSpot owners from integration_records to hubspot_owners
-- ============================================

INSERT INTO hubspot_owners (
  organization_id,
  hubspot_owner_id,
  email,
  first_name,
  last_name,
  user_id,
  teams,
  is_active,
  synced_at
)
SELECT
  ir.organization_id,
  ir.external_id,
  ir.properties->>'email',
  ir.properties->>'firstName',
  ir.properties->>'lastName',
  ir.properties->>'userId',
  COALESCE((ir.properties->'teams')::jsonb, '[]'::jsonb),
  true,
  ir.synced_at
FROM integration_records ir
WHERE ir.object_type = 'owners'
ON CONFLICT (organization_id, hubspot_owner_id) DO UPDATE SET
  email = EXCLUDED.email,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  user_id = EXCLUDED.user_id,
  teams = EXCLUDED.teams,
  synced_at = EXCLUDED.synced_at,
  updated_at = NOW();
