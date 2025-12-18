-- Cadence Database Schema
-- Migration 004: Vision/Traction Organizer (V/TO)

-- ============================================
-- V/TO TABLE - EOS Strategic Foundation
-- ============================================
create table vto (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default '00000000-0000-0000-0000-000000000001',

  -- Core Values (array of 3-5 values with descriptions)
  core_values jsonb default '[]',
  -- Format: [{"value": "string", "description": "string"}]

  -- Core Focus
  purpose text,
  niche text,

  -- 10-Year Target
  ten_year_target text,
  ten_year_target_date date,

  -- Marketing Strategy
  target_market text,
  three_uniques jsonb default '[]', -- ["unique1", "unique2", "unique3"]
  proven_process text,
  guarantee text,

  -- 3-Year Picture
  three_year_revenue numeric(15,2),
  three_year_profit numeric(15,2),
  three_year_measurables jsonb default '[]',
  -- Format: [{"measurable": "string", "target": "string"}]
  three_year_description text,
  three_year_target_date date,

  -- 1-Year Plan
  one_year_revenue numeric(15,2),
  one_year_profit numeric(15,2),
  one_year_goals jsonb default '[]',
  -- Format: [{"goal": "string", "measurable": "string", "owner_id": "uuid"}]
  one_year_target_date date,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  updated_by uuid references profiles(id)
);

-- ============================================
-- V/TO HISTORY - Audit Trail
-- ============================================
create table vto_history (
  id uuid primary key default gen_random_uuid(),
  vto_id uuid references vto(id) on delete cascade,
  changed_by uuid references profiles(id),
  changed_at timestamptz default now(),
  change_type text, -- 'annual_planning', 'quarterly_update', 'correction'
  section text, -- Which section was changed
  previous_values jsonb,
  new_values jsonb
);

-- ============================================
-- INDEXES
-- ============================================
create index vto_organization_idx on vto(organization_id);
create index vto_history_vto_id_idx on vto_history(vto_id);
create index vto_history_changed_at_idx on vto_history(changed_at desc);

-- ============================================
-- ENABLE RLS
-- ============================================
alter table vto enable row level security;
alter table vto_history enable row level security;

-- ============================================
-- RLS POLICIES
-- ============================================
-- All authenticated users can view V/TO
create policy "All users can view VTO"
  on vto for select
  using (true);

-- Only admins can modify V/TO
create policy "Admins can insert VTO"
  on vto for insert
  with check (get_current_access_level() = 'admin');

create policy "Admins can update VTO"
  on vto for update
  using (get_current_access_level() = 'admin');

create policy "Admins can delete VTO"
  on vto for delete
  using (get_current_access_level() = 'admin');

-- V/TO history policies
create policy "All users can view VTO history"
  on vto_history for select
  using (true);

create policy "System can insert VTO history"
  on vto_history for insert
  with check (true); -- Controlled by service role

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
create trigger update_vto_updated_at
  before update on vto
  for each row execute function update_updated_at_column();

-- ============================================
-- SEED DEFAULT V/TO FOR CHOICE DIGITAL
-- ============================================
insert into vto (
  organization_id,
  core_values,
  purpose,
  niche,
  ten_year_target,
  target_market,
  three_uniques
) values (
  '00000000-0000-0000-0000-000000000001',
  '[
    {"value": "Innovation", "description": "We constantly seek better ways to solve problems"},
    {"value": "Integrity", "description": "We do what we say and say what we do"},
    {"value": "Excellence", "description": "We deliver exceptional quality in everything"},
    {"value": "Collaboration", "description": "We succeed together as a team"},
    {"value": "Customer Focus", "description": "Our customers success is our success"}
  ]'::jsonb,
  'Empowering financial inclusion through innovative payment solutions',
  'B2B payment processing and disbursement services',
  'Become the leading embedded finance platform for enterprise disbursements',
  'Enterprise businesses needing fast, reliable disbursement solutions',
  '["Same-day disbursements", "Enterprise-grade compliance", "Seamless API integration"]'::jsonb
);
