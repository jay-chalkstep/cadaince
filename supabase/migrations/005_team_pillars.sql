-- Cadence Database Schema
-- Migration 005: Enhanced Team & Pillar Architecture

-- ============================================
-- ENHANCE PILLARS TABLE
-- ============================================
alter table pillars add column if not exists slug text;
alter table pillars add column if not exists description text;
alter table pillars add column if not exists color text;
alter table pillars add column if not exists sort_order integer default 0;

-- Add unique constraint on slug (if not exists)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'pillars_slug_key'
  ) then
    alter table pillars add constraint pillars_slug_key unique (slug);
  end if;
end $$;

-- Update existing pillars with slugs and colors
update pillars set slug = 'executive', color = '#6366F1', sort_order = 1 where name = 'Executive';
update pillars set slug = 'growth', color = '#10B981', sort_order = 2 where name = 'Growth';
update pillars set slug = 'customer', color = '#F59E0B', sort_order = 3 where name = 'Customer';
update pillars set slug = 'product', color = '#3B82F6', sort_order = 4 where name = 'Product';
update pillars set slug = 'operations', color = '#8B5CF6', sort_order = 5 where name = 'Operations';
update pillars set slug = 'finance', color = '#EC4899', sort_order = 6 where name = 'Finance';
update pillars set slug = 'people', color = '#14B8A6', sort_order = 7 where name = 'People';

-- ============================================
-- ENHANCE PROFILES TABLE (Team Member Features)
-- ============================================
-- Add title field
alter table profiles add column if not exists title text;

-- Add is_pillar_lead flag
alter table profiles add column if not exists is_pillar_lead boolean default false;

-- Add responsibilities (EOS accountability statements)
alter table profiles add column if not exists responsibilities text[];

-- Add custom permissions override
alter table profiles add column if not exists permissions jsonb default '{}';

-- Add briefing preferences
alter table profiles add column if not exists receives_briefing boolean default true;
alter table profiles add column if not exists briefing_time time default '07:00';
alter table profiles add column if not exists timezone text default 'America/Denver';

-- Add status for invite flow
alter table profiles add column if not exists status text default 'active';
alter table profiles add column if not exists invited_at timestamptz;
alter table profiles add column if not exists activated_at timestamptz;

-- Add constraint for status values
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_status_check'
  ) then
    alter table profiles add constraint profiles_status_check
      check (status in ('invited', 'active', 'inactive'));
  end if;
end $$;

-- ============================================
-- INDEXES
-- ============================================
create index if not exists profiles_pillar_id_idx on profiles(pillar_id);
create index if not exists profiles_access_level_idx on profiles(access_level);
create index if not exists profiles_status_idx on profiles(status);
create index if not exists pillars_sort_order_idx on pillars(sort_order);

-- ============================================
-- UPDATE PILLAR LEADERS
-- ============================================
-- Set is_pillar_lead based on existing pillar leader_id references
update profiles p
set is_pillar_lead = true
from pillars pl
where pl.leader_id = p.id;

-- ============================================
-- HELPER FUNCTION: Check if user is pillar lead
-- ============================================
create or replace function is_pillar_lead(profile_id uuid)
returns boolean as $$
  select coalesce(
    (select is_pillar_lead from profiles where id = profile_id),
    false
  )
$$ language sql security definer;

-- ============================================
-- HELPER FUNCTION: Get user's pillar
-- ============================================
create or replace function get_user_pillar(profile_id uuid)
returns uuid as $$
  select pillar_id from profiles where id = profile_id
$$ language sql security definer;

-- ============================================
-- ENHANCED RLS POLICIES FOR PROFILES
-- ============================================
-- Drop existing insert policy to recreate with invite support
drop policy if exists "Admins can insert profiles" on profiles;

-- Allow admins to create profiles (for invites)
create policy "Admins can insert profiles"
  on profiles for insert
  with check (
    get_current_access_level() = 'admin'
    or (select count(*) from profiles) = 0  -- Allow first user
    or clerk_id = auth.jwt() ->> 'sub'  -- Allow self-registration via webhook
  );

-- ============================================
-- TEAM INVITATIONS TABLE
-- ============================================
create table if not exists team_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role text not null default 'slt',
  pillar_id uuid references pillars(id),
  invited_by uuid references profiles(id),
  token text unique not null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  profile_id uuid references profiles(id), -- Set when invitation is accepted
  created_at timestamptz default now()
);

create index if not exists team_invitations_email_idx on team_invitations(email);
create index if not exists team_invitations_token_idx on team_invitations(token);

-- Enable RLS
alter table team_invitations enable row level security;

-- Invitation policies
create policy "Admins can view invitations"
  on team_invitations for select
  using (get_current_access_level() = 'admin');

create policy "Admins can create invitations"
  on team_invitations for insert
  with check (get_current_access_level() = 'admin');

create policy "Admins can update invitations"
  on team_invitations for update
  using (get_current_access_level() = 'admin');

create policy "Admins can delete invitations"
  on team_invitations for delete
  using (get_current_access_level() = 'admin');
