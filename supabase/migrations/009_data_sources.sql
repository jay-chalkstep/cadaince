-- Cadence Database Schema
-- Migration 009: Data Sources & Multi-Window Metrics

-- ============================================
-- DATA SOURCES TABLE
-- Reusable query definitions that metrics reference
-- ============================================
create table if not exists data_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,

  -- Source configuration
  source_type text not null,

  -- HubSpot config
  hubspot_object text, -- 'deals', 'contacts', 'tickets', 'feedback_submissions'
  hubspot_property text,
  hubspot_aggregation text, -- 'sum', 'avg', 'count', 'min', 'max'
  hubspot_filters jsonb default '[]',

  -- BigQuery config
  bigquery_query text, -- Must include {{start}} and {{end}} placeholders
  bigquery_value_column text,

  -- Metadata
  unit text, -- '$', '%', 'users', etc.
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  constraint data_sources_source_type_check
    check (source_type in ('hubspot', 'bigquery'))
);

create index if not exists idx_data_sources_type on data_sources(source_type);
create index if not exists idx_data_sources_created_at on data_sources(created_at desc);

-- Enable RLS
alter table data_sources enable row level security;

-- Data sources policies
create policy "All users can view data sources"
  on data_sources for select
  using (true);

create policy "Admins can manage data sources"
  on data_sources for all
  using (get_current_access_level() = 'admin');

-- Trigger for updated_at
create trigger update_data_sources_updated_at
  before update on data_sources
  for each row execute function update_updated_at_column();

-- ============================================
-- UPDATE METRICS TABLE FOR MULTI-WINDOW SUPPORT
-- ============================================

-- Add metric_type column (manual, single_window, multi_window, calculated)
alter table metrics add column if not exists metric_type text default 'manual';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'metrics_metric_type_check'
  ) then
    alter table metrics add constraint metrics_metric_type_check
      check (metric_type in ('manual', 'single_window', 'multi_window', 'calculated'));
  end if;
end $$;

-- Add data_source_id reference
alter table metrics add column if not exists data_source_id uuid references data_sources(id);

-- For single_window metrics
alter table metrics add column if not exists time_window text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'metrics_time_window_check'
  ) then
    alter table metrics add constraint metrics_time_window_check
      check (time_window in ('day', 'week', 'mtd', 'qtd', 'ytd', 'trailing_7', 'trailing_30', 'trailing_90'));
  end if;
end $$;

-- For multi_window metrics (stores which windows to display)
alter table metrics add column if not exists time_windows text[] default '{}';

-- For multi_window metrics (stores goal per window)
alter table metrics add column if not exists goals_by_window jsonb default '{}';

-- For multi_window metrics (stores thresholds per window)
alter table metrics add column if not exists thresholds_by_window jsonb default '{}';

-- For calculated metrics
alter table metrics add column if not exists formula text;
alter table metrics add column if not exists formula_references jsonb default '[]';

-- Sync configuration
alter table metrics add column if not exists sync_frequency text default '15min';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'metrics_sync_frequency_check'
  ) then
    alter table metrics add constraint metrics_sync_frequency_check
      check (sync_frequency in ('5min', '15min', 'hourly', 'daily'));
  end if;
end $$;

-- ============================================
-- UPDATE METRIC_VALUES TABLE FOR MULTI-WINDOW
-- ============================================

-- Add time_window column to support multi-window values
alter table metric_values add column if not exists time_window text;

-- Add constraint for time_window
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'metric_values_time_window_check'
  ) then
    alter table metric_values add constraint metric_values_time_window_check
      check (time_window is null or time_window in ('day', 'week', 'mtd', 'qtd', 'ytd', 'trailing_7', 'trailing_30', 'trailing_90'));
  end if;
end $$;

-- Add index for time window queries
create index if not exists idx_metric_values_window on metric_values(metric_id, time_window);

-- ============================================
-- INDEXES FOR NEW COLUMNS
-- ============================================
create index if not exists idx_metrics_metric_type on metrics(metric_type);
create index if not exists idx_metrics_data_source on metrics(data_source_id);

-- ============================================
-- MIGRATE EXISTING METRICS
-- ============================================
-- Existing metrics with source_type stay as 'manual' for metric_type
-- unless they have external source configuration

-- Mark metrics with hubspot/bigquery source_config as single_window
update metrics
set metric_type = 'single_window',
    time_window = 'week'
where source_type in ('hubspot', 'bigquery')
  and source_config is not null
  and metric_type = 'manual';
