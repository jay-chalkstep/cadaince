-- Cadence Database Schema
-- Migration 007: Integration Configurations & Sync Logs

-- ============================================
-- INTEGRATIONS TABLE
-- ============================================
create table if not exists integrations (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  name text not null,
  is_active boolean default true,
  config jsonb default '{}',
  -- HubSpot: {"portal_id": "...", "scopes": [...]}
  -- BigQuery: {"project_id": "...", "dataset": "..."}
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  constraint integrations_type_check
    check (type in ('hubspot', 'bigquery', 'slack', 'google_calendar'))
);

create unique index if not exists integrations_type_unique_idx on integrations(type);

-- Enable RLS
alter table integrations enable row level security;

create policy "Admins can view integrations"
  on integrations for select
  using (get_current_access_level() = 'admin');

create policy "Admins can manage integrations"
  on integrations for all
  using (get_current_access_level() = 'admin');

-- ============================================
-- SYNC LOGS TABLE
-- ============================================
create table if not exists sync_logs (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid references integrations(id) on delete cascade,
  metric_id uuid references metrics(id) on delete cascade,
  started_at timestamptz default now(),
  completed_at timestamptz,
  status text default 'running',
  records_processed integer,
  error_message text,
  details jsonb,

  constraint sync_logs_status_check
    check (status in ('running', 'success', 'error'))
);

create index if not exists sync_logs_integration_id_idx on sync_logs(integration_id);
create index if not exists sync_logs_metric_id_idx on sync_logs(metric_id);
create index if not exists sync_logs_started_at_idx on sync_logs(started_at desc);
create index if not exists sync_logs_status_idx on sync_logs(status);

-- Enable RLS
alter table sync_logs enable row level security;

create policy "Admins can view sync logs"
  on sync_logs for select
  using (get_current_access_level() = 'admin');

create policy "System can manage sync logs"
  on sync_logs for all
  using (true); -- Controlled by service role

-- ============================================
-- INTEGRATION WEBHOOKS TABLE
-- ============================================
create table if not exists integration_webhooks (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid references integrations(id) on delete cascade not null,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  error_message text,
  created_at timestamptz default now()
);

create index if not exists integration_webhooks_integration_idx on integration_webhooks(integration_id);
create index if not exists integration_webhooks_created_at_idx on integration_webhooks(created_at desc);
create index if not exists integration_webhooks_processed_idx on integration_webhooks(processed_at) where processed_at is null;

-- Enable RLS
alter table integration_webhooks enable row level security;

create policy "Admins can view webhooks"
  on integration_webhooks for select
  using (get_current_access_level() = 'admin');

create policy "System can manage webhooks"
  on integration_webhooks for all
  using (true); -- Controlled by service role

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
create trigger update_integrations_updated_at
  before update on integrations
  for each row execute function update_updated_at_column();

-- ============================================
-- SEED DEFAULT INTEGRATIONS (inactive by default)
-- ============================================
insert into integrations (type, name, is_active, config) values
  ('hubspot', 'HubSpot CRM', false, '{"portal_id": null, "scopes": ["crm.objects.deals.read", "crm.objects.contacts.read", "tickets"]}'),
  ('bigquery', 'Google BigQuery', false, '{"project_id": null, "dataset": null}')
on conflict do nothing;

-- ============================================
-- HELPER FUNCTION: Get active integration by type
-- ============================================
create or replace function get_active_integration(integration_type text)
returns uuid as $$
  select id from integrations
  where type = integration_type
  and is_active = true
  limit 1
$$ language sql security definer;

-- ============================================
-- HELPER FUNCTION: Log sync operation
-- ============================================
create or replace function log_sync_start(
  p_integration_id uuid,
  p_metric_id uuid default null
)
returns uuid as $$
declare
  v_log_id uuid;
begin
  insert into sync_logs (integration_id, metric_id, status)
  values (p_integration_id, p_metric_id, 'running')
  returning id into v_log_id;

  return v_log_id;
end;
$$ language plpgsql security definer;

create or replace function log_sync_complete(
  p_log_id uuid,
  p_status text,
  p_records_processed integer default 0,
  p_error_message text default null,
  p_details jsonb default null
)
returns void as $$
begin
  update sync_logs
  set
    completed_at = now(),
    status = p_status,
    records_processed = p_records_processed,
    error_message = p_error_message,
    details = p_details
  where id = p_log_id;
end;
$$ language plpgsql security definer;
