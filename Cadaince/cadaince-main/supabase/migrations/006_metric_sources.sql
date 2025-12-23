-- Cadence Database Schema
-- Migration 006: Metric Source Configuration & Thresholds

-- ============================================
-- ENHANCE METRICS TABLE FOR EXTERNAL SOURCES
-- ============================================
-- Note: 'source' and 'source_config' columns already exist from initial schema
-- We'll add additional columns for sync tracking

-- Add source_type with proper check constraint
alter table metrics add column if not exists source_type text default 'manual';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'metrics_source_type_check'
  ) then
    alter table metrics add constraint metrics_source_type_check
      check (source_type in ('manual', 'hubspot', 'bigquery', 'calculated'));
  end if;
end $$;

-- Migrate existing 'source' values to 'source_type'
update metrics set source_type = source where source in ('manual', 'hubspot', 'bigquery');

-- Add sync tracking columns
alter table metrics add column if not exists last_sync_at timestamptz;
alter table metrics add column if not exists sync_error text;
alter table metrics add column if not exists sync_enabled boolean default true;

-- Add is_active flag for soft delete
alter table metrics add column if not exists is_active boolean default true;

-- ============================================
-- METRIC THRESHOLDS TABLE
-- ============================================
create table if not exists metric_thresholds (
  id uuid primary key default gen_random_uuid(),
  metric_id uuid references metrics(id) on delete cascade not null,
  threshold_type text not null,
  threshold_value numeric(15,4) not null,
  severity text default 'warning',
  consecutive_periods integer default 1, -- Must breach N times before alert
  is_active boolean default true,
  created_at timestamptz default now(),

  constraint metric_thresholds_type_check
    check (threshold_type in ('above', 'below', 'change_percent')),
  constraint metric_thresholds_severity_check
    check (severity in ('info', 'warning', 'critical'))
);

create index if not exists metric_thresholds_metric_id_idx on metric_thresholds(metric_id);

-- Enable RLS
alter table metric_thresholds enable row level security;

-- Threshold policies
create policy "All users can view thresholds"
  on metric_thresholds for select
  using (true);

create policy "Admins can manage thresholds"
  on metric_thresholds for all
  using (get_current_access_level() = 'admin');

-- ============================================
-- ENHANCE METRIC_VALUES TABLE
-- ============================================
-- Add recorded_by for tracking who/what entered the value
alter table metric_values add column if not exists recorded_by uuid references profiles(id);

-- ============================================
-- METRIC ANOMALIES TABLE
-- ============================================
create table if not exists metric_anomalies (
  id uuid primary key default gen_random_uuid(),
  metric_id uuid references metrics(id) on delete cascade not null,
  detected_at timestamptz default now(),
  anomaly_type text not null, -- 'threshold', 'deviation', 'trend', 'missing'
  severity text default 'warning',
  current_value numeric(15,4),
  expected_value numeric(15,4),
  deviation_percent numeric(10,2),
  message text not null,
  alert_id uuid references alerts(id), -- Link to generated alert
  resolved_at timestamptz,

  constraint metric_anomalies_type_check
    check (anomaly_type in ('threshold', 'deviation', 'trend', 'missing')),
  constraint metric_anomalies_severity_check
    check (severity in ('info', 'warning', 'critical'))
);

create index if not exists metric_anomalies_metric_id_idx on metric_anomalies(metric_id);
create index if not exists metric_anomalies_detected_at_idx on metric_anomalies(detected_at desc);
create index if not exists metric_anomalies_resolved_idx on metric_anomalies(resolved_at) where resolved_at is null;

-- Enable RLS
alter table metric_anomalies enable row level security;

create policy "All users can view anomalies"
  on metric_anomalies for select
  using (true);

create policy "System can manage anomalies"
  on metric_anomalies for all
  using (true); -- Controlled by service role

-- ============================================
-- INDEXES FOR METRICS
-- ============================================
create index if not exists metrics_source_type_idx on metrics(source_type);
create index if not exists metrics_is_active_idx on metrics(is_active);
create index if not exists metrics_last_sync_idx on metrics(last_sync_at);

-- ============================================
-- MIGRATE EXISTING THRESHOLD VALUES
-- ============================================
-- Convert existing threshold_red and threshold_yellow to metric_thresholds
insert into metric_thresholds (metric_id, threshold_type, threshold_value, severity)
select id, 'below', threshold_red, 'critical'
from metrics
where threshold_red is not null
on conflict do nothing;

insert into metric_thresholds (metric_id, threshold_type, threshold_value, severity)
select id, 'below', threshold_yellow, 'warning'
from metrics
where threshold_yellow is not null
on conflict do nothing;
