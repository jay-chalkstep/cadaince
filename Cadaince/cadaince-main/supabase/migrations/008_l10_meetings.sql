-- Cadence Database Schema
-- Migration 008: L10 Meeting Module

-- ============================================
-- ENHANCE INTEGRATIONS TABLE
-- ============================================
-- Add credentials_set flag for tracking if credentials have been configured
alter table integrations add column if not exists credentials_set boolean default false;

-- ============================================
-- L10 MEETINGS TABLE
-- ============================================
create table if not exists l10_meetings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  meeting_type text default 'leadership',
  scheduled_at timestamptz not null,
  started_at timestamptz,
  ended_at timestamptz,
  duration_minutes integer,
  status text default 'scheduled',
  rating integer,

  -- Snapshots taken at meeting start
  scorecard_snapshot jsonb,
  rocks_snapshot jsonb,

  -- Meeting content
  headlines jsonb default '[]',
  cascading_messages jsonb default '[]',
  notes text,

  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  constraint l10_meetings_type_check
    check (meeting_type in ('leadership', 'department', 'quarterly')),
  constraint l10_meetings_status_check
    check (status in ('scheduled', 'in_progress', 'completed', 'cancelled')),
  constraint l10_meetings_rating_check
    check (rating is null or (rating >= 1 and rating <= 10))
);

create index if not exists l10_meetings_scheduled_at_idx on l10_meetings(scheduled_at);
create index if not exists l10_meetings_status_idx on l10_meetings(status);
create index if not exists l10_meetings_created_by_idx on l10_meetings(created_by);

-- Enable RLS
alter table l10_meetings enable row level security;

-- All users can view L10 meetings
create policy "All users can view l10 meetings"
  on l10_meetings for select
  using (true);

-- Admins and ELT can create meetings
create policy "ELT and admins can create l10 meetings"
  on l10_meetings for insert
  with check (
    get_current_access_level() in ('admin', 'elt')
    or (select is_elt from profiles where id = get_current_profile_id())
  );

-- Admins can update all meetings, creators can update their own
create policy "Creators and admins can update l10 meetings"
  on l10_meetings for update
  using (
    created_by = get_current_profile_id()
    or get_current_access_level() = 'admin'
  );

-- Admins can delete meetings
create policy "Admins can delete l10 meetings"
  on l10_meetings for delete
  using (get_current_access_level() = 'admin');

-- ============================================
-- L10 AGENDA ITEMS TABLE
-- ============================================
create table if not exists l10_agenda_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references l10_meetings(id) on delete cascade not null,
  section text not null,
  sort_order integer,
  duration_minutes integer,
  started_at timestamptz,
  completed_at timestamptz,
  notes text,

  constraint l10_agenda_items_section_check
    check (section in ('segue', 'scorecard', 'rocks', 'headlines', 'todos', 'ids', 'conclude'))
);

create index if not exists l10_agenda_items_meeting_id_idx on l10_agenda_items(meeting_id);
create index if not exists l10_agenda_items_sort_order_idx on l10_agenda_items(meeting_id, sort_order);

-- Enable RLS
alter table l10_agenda_items enable row level security;

-- All users can view agenda items
create policy "All users can view l10 agenda items"
  on l10_agenda_items for select
  using (true);

-- Meeting creators and admins can manage agenda items
create policy "Meeting creators and admins can manage l10 agenda items"
  on l10_agenda_items for all
  using (
    exists (
      select 1 from l10_meetings
      where l10_meetings.id = meeting_id
      and (l10_meetings.created_by = get_current_profile_id() or get_current_access_level() = 'admin')
    )
  );

-- ============================================
-- L10 ISSUES DISCUSSED TABLE
-- ============================================
create table if not exists l10_issues_discussed (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references l10_meetings(id) on delete cascade not null,
  issue_id uuid references issues(id) on delete set null,
  discussed_at timestamptz default now(),
  outcome text,
  decision_notes text,
  todo_id uuid references todos(id) on delete set null,
  discussion_duration_seconds integer,

  constraint l10_issues_discussed_outcome_check
    check (outcome is null or outcome in ('solved', 'todo_created', 'pushed', 'killed'))
);

create index if not exists l10_issues_discussed_meeting_id_idx on l10_issues_discussed(meeting_id);
create index if not exists l10_issues_discussed_issue_id_idx on l10_issues_discussed(issue_id);

-- Enable RLS
alter table l10_issues_discussed enable row level security;

-- All users can view discussed issues
create policy "All users can view l10 issues discussed"
  on l10_issues_discussed for select
  using (true);

-- Meeting participants can manage discussed issues
create policy "Meeting participants can manage l10 issues discussed"
  on l10_issues_discussed for all
  using (
    exists (
      select 1 from l10_meetings
      where l10_meetings.id = meeting_id
      and (l10_meetings.created_by = get_current_profile_id() or get_current_access_level() = 'admin')
    )
  );

-- ============================================
-- L10 TODOS REVIEWED TABLE
-- ============================================
create table if not exists l10_todos_reviewed (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references l10_meetings(id) on delete cascade not null,
  todo_id uuid references todos(id) on delete set null,
  status_at_review text,
  reviewed_at timestamptz default now(),

  constraint l10_todos_reviewed_status_check
    check (status_at_review is null or status_at_review in ('done', 'not_done', 'pushed'))
);

create index if not exists l10_todos_reviewed_meeting_id_idx on l10_todos_reviewed(meeting_id);
create index if not exists l10_todos_reviewed_todo_id_idx on l10_todos_reviewed(todo_id);

-- Enable RLS
alter table l10_todos_reviewed enable row level security;

-- All users can view reviewed todos
create policy "All users can view l10 todos reviewed"
  on l10_todos_reviewed for select
  using (true);

-- Meeting participants can manage reviewed todos
create policy "Meeting participants can manage l10 todos reviewed"
  on l10_todos_reviewed for all
  using (
    exists (
      select 1 from l10_meetings
      where l10_meetings.id = meeting_id
      and (l10_meetings.created_by = get_current_profile_id() or get_current_access_level() = 'admin')
    )
  );

-- ============================================
-- L10 MEETING ATTENDEES TABLE
-- ============================================
create table if not exists l10_meeting_attendees (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references l10_meetings(id) on delete cascade not null,
  profile_id uuid references profiles(id) not null,
  attended boolean default false,
  joined_at timestamptz,
  left_at timestamptz,

  unique(meeting_id, profile_id)
);

create index if not exists l10_meeting_attendees_meeting_id_idx on l10_meeting_attendees(meeting_id);
create index if not exists l10_meeting_attendees_profile_id_idx on l10_meeting_attendees(profile_id);

-- Enable RLS
alter table l10_meeting_attendees enable row level security;

-- All users can view attendees
create policy "All users can view l10 meeting attendees"
  on l10_meeting_attendees for select
  using (true);

-- Meeting creators and admins can manage attendees
create policy "Meeting creators and admins can manage l10 meeting attendees"
  on l10_meeting_attendees for all
  using (
    exists (
      select 1 from l10_meetings
      where l10_meetings.id = meeting_id
      and (l10_meetings.created_by = get_current_profile_id() or get_current_access_level() = 'admin')
    )
  );

-- ============================================
-- UPDATED_AT TRIGGER FOR L10 MEETINGS
-- ============================================
create trigger update_l10_meetings_updated_at
  before update on l10_meetings
  for each row execute function update_updated_at_column();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get upcoming L10 meeting
create or replace function get_next_l10_meeting()
returns l10_meetings as $$
  select * from l10_meetings
  where scheduled_at > now()
  and status = 'scheduled'
  order by scheduled_at asc
  limit 1
$$ language sql security definer;

-- Get meeting with full details
create or replace function get_l10_meeting_details(p_meeting_id uuid)
returns jsonb as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'meeting', row_to_json(m),
    'agenda_items', (
      select coalesce(jsonb_agg(row_to_json(ai) order by ai.sort_order), '[]')
      from l10_agenda_items ai
      where ai.meeting_id = m.id
    ),
    'attendees', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', ma.id,
        'profile_id', ma.profile_id,
        'attended', ma.attended,
        'profile', row_to_json(p)
      )), '[]')
      from l10_meeting_attendees ma
      join profiles p on p.id = ma.profile_id
      where ma.meeting_id = m.id
    ),
    'issues_discussed', (
      select coalesce(jsonb_agg(row_to_json(id)), '[]')
      from l10_issues_discussed id
      where id.meeting_id = m.id
    ),
    'todos_reviewed', (
      select coalesce(jsonb_agg(row_to_json(tr)), '[]')
      from l10_todos_reviewed tr
      where tr.meeting_id = m.id
    )
  ) into v_result
  from l10_meetings m
  where m.id = p_meeting_id;

  return v_result;
end;
$$ language plpgsql security definer;
