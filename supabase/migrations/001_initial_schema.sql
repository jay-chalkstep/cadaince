-- Cadence Database Schema
-- Initial migration: Core tables

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================
-- PILLARS (create first as profiles references it)
-- ============================================
create table pillars (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  leader_id uuid, -- Will add FK after profiles table
  created_at timestamptz default now()
);

-- ============================================
-- PROFILES (extends Clerk users)
-- ============================================
create table profiles (
  id uuid primary key default gen_random_uuid(),
  clerk_id text unique not null,
  email text not null,
  full_name text not null,
  avatar_url text,
  role text not null,
  pillar_id uuid references pillars(id),
  access_level text not null default 'slt',  -- 'admin', 'elt', 'slt', 'consumer'
  is_elt boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Add FK for pillar leader after profiles exists
alter table pillars
  add constraint pillars_leader_id_fkey
  foreign key (leader_id) references profiles(id);

-- ============================================
-- MEETINGS (create before todos as todos references it)
-- ============================================
create table meetings (
  id uuid primary key default gen_random_uuid(),
  type text default 'l10',
  scheduled_at timestamptz not null,
  started_at timestamptz,
  ended_at timestamptz,
  status text default 'scheduled', -- 'scheduled', 'in_progress', 'completed'
  rating numeric,
  notes text,
  ai_summary text,
  created_at timestamptz default now()
);

-- ============================================
-- EOS SCORECARD
-- ============================================
create table metrics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  owner_id uuid references profiles(id) not null,
  goal numeric,
  unit text,                       -- '%', '$', 'count', etc.
  frequency text default 'weekly', -- 'daily', 'weekly', 'monthly'
  source text default 'manual',    -- 'manual', 'hubspot', 'bigquery'
  source_config jsonb,
  threshold_red numeric,
  threshold_yellow numeric,
  display_order int,
  created_at timestamptz default now()
);

create table metric_values (
  id uuid primary key default gen_random_uuid(),
  metric_id uuid references metrics(id) on delete cascade not null,
  value numeric not null,
  recorded_at timestamptz default now(),
  source text default 'manual',
  notes text
);

-- Index for efficient metric history queries
create index metric_values_metric_id_recorded_at_idx
  on metric_values(metric_id, recorded_at desc);

-- ============================================
-- EOS ROCKS
-- ============================================
create table rocks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  owner_id uuid references profiles(id) not null,
  status text default 'on_track',  -- 'on_track', 'at_risk', 'off_track', 'complete'
  due_date date not null,
  quarter text,
  linked_metric_id uuid references metrics(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table rock_milestones (
  id uuid primary key default gen_random_uuid(),
  rock_id uuid references rocks(id) on delete cascade not null,
  title text not null,
  due_date date,
  completed_at timestamptz,
  display_order int
);

-- Index for efficient rock queries
create index rocks_owner_id_idx on rocks(owner_id);
create index rocks_status_idx on rocks(status);
create index rocks_quarter_idx on rocks(quarter);

-- ============================================
-- EOS ISSUES
-- ============================================
create table issues (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  raised_by uuid references profiles(id) not null,
  source text default 'manual',    -- 'manual', 'alert', 'pattern', 'update'
  source_ref uuid,
  status text default 'detected',  -- 'detected', 'prioritized', 'decided', 'resolved'
  priority int,
  resolution text,
  learnings text,
  resolved_at timestamptz,
  created_at timestamptz default now()
);

create index issues_status_idx on issues(status);
create index issues_raised_by_idx on issues(raised_by);

-- ============================================
-- EOS TO-DOS
-- ============================================
create table todos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  owner_id uuid references profiles(id) not null,
  due_date date not null,
  completed_at timestamptz,
  meeting_id uuid references meetings(id),
  created_at timestamptz default now()
);

create index todos_owner_id_idx on todos(owner_id);
create index todos_due_date_idx on todos(due_date);

-- ============================================
-- UPDATES
-- ============================================
create table updates (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references profiles(id) not null,
  type text default 'general',     -- 'general', 'rock', 'scorecard', 'incident'
  format text default 'text',      -- 'text', 'video'
  content text,
  video_url text,
  video_asset_id text,
  thumbnail_url text,
  transcript text,
  duration_seconds int,
  linked_rock_id uuid references rocks(id),
  linked_metric_id uuid references metrics(id),
  is_draft boolean default false,
  published_at timestamptz,
  created_at timestamptz default now()
);

create index updates_author_id_idx on updates(author_id);
create index updates_published_at_idx on updates(published_at desc);
create index updates_linked_rock_id_idx on updates(linked_rock_id);
create index updates_linked_metric_id_idx on updates(linked_metric_id);

-- ============================================
-- ALERTS
-- ============================================
create table alerts (
  id uuid primary key default gen_random_uuid(),
  type text not null,              -- 'human', 'threshold', 'anomaly', 'missing_update'
  severity text default 'normal',  -- 'normal', 'urgent'
  title text not null,
  description text,
  triggered_by uuid references profiles(id),
  update_id uuid references updates(id),
  metric_id uuid references metrics(id),
  config jsonb,
  created_at timestamptz default now()
);

create table alert_acknowledgments (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid references alerts(id) on delete cascade not null,
  profile_id uuid references profiles(id) not null,
  acknowledged_at timestamptz default now(),
  unique(alert_id, profile_id)
);

create index alerts_created_at_idx on alerts(created_at desc);
create index alerts_type_idx on alerts(type);

-- ============================================
-- PRIVATE NOTES
-- ============================================
create table private_notes (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references profiles(id) not null,
  recipient_id uuid references profiles(id) not null,
  content text not null,
  linked_update_id uuid references updates(id),
  linked_rock_id uuid references rocks(id),
  linked_metric_id uuid references metrics(id),
  status text default 'pending',   -- 'pending', 'acknowledged', 'discussed', 'escalated', 'resolved'
  resolution_note text,
  escalated_to_issue_id uuid references issues(id),
  created_at timestamptz default now(),
  resolved_at timestamptz
);

create index private_notes_recipient_id_idx on private_notes(recipient_id);
create index private_notes_author_id_idx on private_notes(author_id);
create index private_notes_status_idx on private_notes(status);

-- ============================================
-- MEETING ATTENDEES
-- ============================================
create table meeting_attendees (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references meetings(id) on delete cascade not null,
  profile_id uuid references profiles(id) not null,
  attended boolean default false,
  unique(meeting_id, profile_id)
);

-- ============================================
-- MORNING BRIEFINGS
-- ============================================
create table briefings (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) not null,
  briefing_date date not null,
  content jsonb not null,
  generated_at timestamptz default now(),
  viewed_at timestamptz,
  unique(profile_id, briefing_date)
);

create index briefings_profile_date_idx on briefings(profile_id, briefing_date desc);

-- ============================================
-- AI LEARNING
-- ============================================
create table issue_patterns (
  id uuid primary key default gen_random_uuid(),
  pattern_type text not null,
  pattern_config jsonb not null,
  outcome text,
  recommended_action text,
  confidence numeric default 0.5,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at_column();

create trigger update_rocks_updated_at
  before update on rocks
  for each row execute function update_updated_at_column();

create trigger update_issue_patterns_updated_at
  before update on issue_patterns
  for each row execute function update_updated_at_column();
