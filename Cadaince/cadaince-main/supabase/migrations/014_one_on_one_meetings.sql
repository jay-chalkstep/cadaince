-- Cadence Database Schema
-- Migration 014: 1:1 Meetings System

-- ============================================
-- ADD MANAGER_ID TO PROFILES (ORG STRUCTURE)
-- ============================================
alter table profiles add column if not exists manager_id uuid references profiles(id);
create index if not exists profiles_manager_id_idx on profiles(manager_id);

-- ============================================
-- ONE-ON-ONE MEETINGS TABLE
-- ============================================
-- Represents the recurring 1:1 relationship between manager and direct
create table if not exists one_on_one_meetings (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references profiles(id),
  direct_id uuid not null references profiles(id),

  title text not null,
  meeting_day text,
  meeting_time time,
  duration_minutes integer default 30,

  is_active boolean default true,
  settings jsonb default '{}',

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  constraint one_on_one_meetings_day_check
    check (meeting_day is null or meeting_day in ('monday', 'tuesday', 'wednesday', 'thursday', 'friday')),
  constraint one_on_one_meetings_different_people
    check (manager_id != direct_id),
  unique(manager_id, direct_id)
);

create index if not exists one_on_one_meetings_manager_id_idx on one_on_one_meetings(manager_id);
create index if not exists one_on_one_meetings_direct_id_idx on one_on_one_meetings(direct_id);
create index if not exists one_on_one_meetings_is_active_idx on one_on_one_meetings(is_active);

-- Enable RLS
alter table one_on_one_meetings enable row level security;

-- Participants can view their own 1:1s
create policy "Participants can view their 1:1 meetings"
  on one_on_one_meetings for select
  using (
    manager_id = get_current_profile_id()
    or direct_id = get_current_profile_id()
    or get_current_access_level() = 'admin'
  );

-- Managers and admins can create 1:1s
create policy "Managers and admins can create 1:1 meetings"
  on one_on_one_meetings for insert
  with check (
    manager_id = get_current_profile_id()
    or get_current_access_level() = 'admin'
  );

-- Participants can update their 1:1s
create policy "Participants can update 1:1 meetings"
  on one_on_one_meetings for update
  using (
    manager_id = get_current_profile_id()
    or direct_id = get_current_profile_id()
    or get_current_access_level() = 'admin'
  );

-- Admins can delete 1:1s
create policy "Admins can delete 1:1 meetings"
  on one_on_one_meetings for delete
  using (get_current_access_level() = 'admin');

-- ============================================
-- ONE-ON-ONE MEETING INSTANCES TABLE
-- ============================================
-- Represents actual occurrences of 1:1 meetings
create table if not exists one_on_one_instances (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references one_on_one_meetings(id) on delete cascade,

  scheduled_at timestamptz not null,
  started_at timestamptz,
  ended_at timestamptz,

  status text default 'scheduled',

  -- Snapshots for context
  rocks_snapshot jsonb default '[]',
  metrics_snapshot jsonb default '[]',

  notes text,
  ai_summary text,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  constraint one_on_one_instances_status_check
    check (status in ('scheduled', 'in_progress', 'completed', 'cancelled', 'rescheduled'))
);

create index if not exists one_on_one_instances_meeting_id_idx on one_on_one_instances(meeting_id);
create index if not exists one_on_one_instances_scheduled_at_idx on one_on_one_instances(scheduled_at);
create index if not exists one_on_one_instances_status_idx on one_on_one_instances(status);

-- Enable RLS
alter table one_on_one_instances enable row level security;

-- Participants can view instances of their 1:1s
create policy "Participants can view their 1:1 instances"
  on one_on_one_instances for select
  using (
    exists (
      select 1 from one_on_one_meetings
      where one_on_one_meetings.id = meeting_id
      and (manager_id = get_current_profile_id() or direct_id = get_current_profile_id())
    )
    or get_current_access_level() = 'admin'
  );

-- Participants can create instances
create policy "Participants can create 1:1 instances"
  on one_on_one_instances for insert
  with check (
    exists (
      select 1 from one_on_one_meetings
      where one_on_one_meetings.id = meeting_id
      and (manager_id = get_current_profile_id() or direct_id = get_current_profile_id())
    )
    or get_current_access_level() = 'admin'
  );

-- Participants can update instances
create policy "Participants can update 1:1 instances"
  on one_on_one_instances for update
  using (
    exists (
      select 1 from one_on_one_meetings
      where one_on_one_meetings.id = meeting_id
      and (manager_id = get_current_profile_id() or direct_id = get_current_profile_id())
    )
    or get_current_access_level() = 'admin'
  );

-- ============================================
-- ONE-ON-ONE TOPICS TABLE
-- ============================================
-- Persistent talking points for 1:1 meetings
create table if not exists one_on_one_topics (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references one_on_one_meetings(id) on delete cascade,
  added_by_id uuid not null references profiles(id),

  title text not null,
  notes text,

  status text default 'open',
  discussed_in_instance_id uuid references one_on_one_instances(id) on delete set null,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  constraint one_on_one_topics_status_check
    check (status in ('open', 'discussed', 'resolved'))
);

create index if not exists one_on_one_topics_meeting_id_idx on one_on_one_topics(meeting_id);
create index if not exists one_on_one_topics_added_by_id_idx on one_on_one_topics(added_by_id);
create index if not exists one_on_one_topics_status_idx on one_on_one_topics(status);

-- Enable RLS
alter table one_on_one_topics enable row level security;

-- Participants can view topics from their 1:1s
create policy "Participants can view their 1:1 topics"
  on one_on_one_topics for select
  using (
    exists (
      select 1 from one_on_one_meetings
      where one_on_one_meetings.id = meeting_id
      and (manager_id = get_current_profile_id() or direct_id = get_current_profile_id())
    )
    or get_current_access_level() = 'admin'
  );

-- Participants can add topics
create policy "Participants can add 1:1 topics"
  on one_on_one_topics for insert
  with check (
    exists (
      select 1 from one_on_one_meetings
      where one_on_one_meetings.id = meeting_id
      and (manager_id = get_current_profile_id() or direct_id = get_current_profile_id())
    )
  );

-- Participants can update topics
create policy "Participants can update 1:1 topics"
  on one_on_one_topics for update
  using (
    exists (
      select 1 from one_on_one_meetings
      where one_on_one_meetings.id = meeting_id
      and (manager_id = get_current_profile_id() or direct_id = get_current_profile_id())
    )
  );

-- Participants can delete their own topics
create policy "Users can delete their own 1:1 topics"
  on one_on_one_topics for delete
  using (
    added_by_id = get_current_profile_id()
    or get_current_access_level() = 'admin'
  );

-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================
create trigger update_one_on_one_meetings_updated_at
  before update on one_on_one_meetings
  for each row execute function update_updated_at_column();

create trigger update_one_on_one_instances_updated_at
  before update on one_on_one_instances
  for each row execute function update_updated_at_column();

create trigger update_one_on_one_topics_updated_at
  before update on one_on_one_topics
  for each row execute function update_updated_at_column();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get all direct reports for a manager
create or replace function get_direct_reports(p_manager_id uuid)
returns setof profiles as $$
  select * from profiles
  where manager_id = p_manager_id
  and status = 'active'
  order by full_name
$$ language sql security definer;

-- Get org tree from a given profile (all descendants)
create or replace function get_org_tree(p_profile_id uuid)
returns table (
  id uuid,
  full_name text,
  title text,
  manager_id uuid,
  depth integer
) as $$
  with recursive org_tree as (
    -- Base case: direct reports
    select
      p.id,
      p.full_name,
      p.title,
      p.manager_id,
      1 as depth
    from profiles p
    where p.manager_id = p_profile_id
    and p.status = 'active'

    union all

    -- Recursive case: reports of reports
    select
      p.id,
      p.full_name,
      p.title,
      p.manager_id,
      ot.depth + 1
    from profiles p
    join org_tree ot on p.manager_id = ot.id
    where p.status = 'active'
  )
  select * from org_tree
  order by depth, full_name
$$ language sql security definer;

-- Get next 1:1 instance for a meeting
create or replace function get_next_one_on_one_instance(p_meeting_id uuid)
returns one_on_one_instances as $$
  select * from one_on_one_instances
  where meeting_id = p_meeting_id
  and scheduled_at > now()
  and status = 'scheduled'
  order by scheduled_at asc
  limit 1
$$ language sql security definer;

-- Get 1:1 meeting details with context
create or replace function get_one_on_one_details(p_meeting_id uuid)
returns jsonb as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'meeting', row_to_json(m),
    'manager', (
      select row_to_json(p) from profiles p where p.id = m.manager_id
    ),
    'direct', (
      select row_to_json(p) from profiles p where p.id = m.direct_id
    ),
    'open_topics', (
      select coalesce(jsonb_agg(row_to_json(t) order by t.created_at), '[]')
      from one_on_one_topics t
      where t.meeting_id = m.id
      and t.status = 'open'
    ),
    'upcoming_instances', (
      select coalesce(jsonb_agg(row_to_json(i) order by i.scheduled_at), '[]')
      from one_on_one_instances i
      where i.meeting_id = m.id
      and i.scheduled_at > now()
      and i.status = 'scheduled'
    ),
    'recent_instances', (
      select coalesce(jsonb_agg(row_to_json(i) order by i.scheduled_at desc), '[]')
      from one_on_one_instances i
      where i.meeting_id = m.id
      and i.status = 'completed'
      limit 5
    ),
    'direct_rocks', (
      select coalesce(jsonb_agg(row_to_json(r)), '[]')
      from rocks r
      where r.owner_id = m.direct_id
      and r.status != 'complete'
    )
  ) into v_result
  from one_on_one_meetings m
  where m.id = p_meeting_id;

  return v_result;
end;
$$ language plpgsql security definer;
