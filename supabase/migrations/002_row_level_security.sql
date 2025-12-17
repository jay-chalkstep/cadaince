-- Cadence Row-Level Security Policies
-- Enable RLS on all tables and create access policies

-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================
alter table profiles enable row level security;
alter table pillars enable row level security;
alter table metrics enable row level security;
alter table metric_values enable row level security;
alter table rocks enable row level security;
alter table rock_milestones enable row level security;
alter table issues enable row level security;
alter table todos enable row level security;
alter table updates enable row level security;
alter table alerts enable row level security;
alter table alert_acknowledgments enable row level security;
alter table private_notes enable row level security;
alter table meetings enable row level security;
alter table meeting_attendees enable row level security;
alter table briefings enable row level security;
alter table issue_patterns enable row level security;

-- ============================================
-- HELPER FUNCTION: Get current user's profile
-- ============================================
create or replace function get_current_profile_id()
returns uuid as $$
  select id from profiles where clerk_id = auth.jwt() ->> 'sub'
$$ language sql security definer;

create or replace function get_current_access_level()
returns text as $$
  select access_level from profiles where clerk_id = auth.jwt() ->> 'sub'
$$ language sql security definer;

-- ============================================
-- PROFILES
-- ============================================
-- All authenticated users can read all profiles (SLT team)
create policy "All users can view profiles"
  on profiles for select
  using (true);

-- Users can update their own profile
create policy "Users can update own profile"
  on profiles for update
  using (clerk_id = auth.jwt() ->> 'sub');

-- Admins can manage all profiles
create policy "Admins can insert profiles"
  on profiles for insert
  with check (
    get_current_access_level() = 'admin'
    or (select count(*) from profiles) = 0  -- Allow first user
  );

create policy "Admins can delete profiles"
  on profiles for delete
  using (get_current_access_level() = 'admin');

-- ============================================
-- PILLARS
-- ============================================
create policy "All users can view pillars"
  on pillars for select
  using (true);

create policy "Admins can manage pillars"
  on pillars for all
  using (get_current_access_level() = 'admin');

-- ============================================
-- METRICS
-- ============================================
create policy "All users can view metrics"
  on metrics for select
  using (true);

create policy "Admins can create metrics"
  on metrics for insert
  with check (get_current_access_level() = 'admin');

create policy "Owners and admins can update metrics"
  on metrics for update
  using (
    owner_id = get_current_profile_id()
    or get_current_access_level() = 'admin'
  );

create policy "Admins can delete metrics"
  on metrics for delete
  using (get_current_access_level() = 'admin');

-- ============================================
-- METRIC VALUES
-- ============================================
create policy "All users can view metric values"
  on metric_values for select
  using (true);

create policy "Metric owners can insert values"
  on metric_values for insert
  with check (
    exists (
      select 1 from metrics
      where metrics.id = metric_id
      and (metrics.owner_id = get_current_profile_id() or get_current_access_level() = 'admin')
    )
  );

create policy "Metric owners can update values"
  on metric_values for update
  using (
    exists (
      select 1 from metrics
      where metrics.id = metric_id
      and (metrics.owner_id = get_current_profile_id() or get_current_access_level() = 'admin')
    )
  );

-- ============================================
-- ROCKS
-- ============================================
create policy "All users can view rocks"
  on rocks for select
  using (true);

create policy "Users can create rocks"
  on rocks for insert
  with check (
    owner_id = get_current_profile_id()
    or get_current_access_level() = 'admin'
  );

create policy "Owners can update rocks"
  on rocks for update
  using (
    owner_id = get_current_profile_id()
    or get_current_access_level() = 'admin'
  );

create policy "Owners and admins can delete rocks"
  on rocks for delete
  using (
    owner_id = get_current_profile_id()
    or get_current_access_level() = 'admin'
  );

-- ============================================
-- ROCK MILESTONES
-- ============================================
create policy "All users can view milestones"
  on rock_milestones for select
  using (true);

create policy "Rock owners can manage milestones"
  on rock_milestones for all
  using (
    exists (
      select 1 from rocks
      where rocks.id = rock_id
      and (rocks.owner_id = get_current_profile_id() or get_current_access_level() = 'admin')
    )
  );

-- ============================================
-- ISSUES
-- ============================================
create policy "All users can view issues"
  on issues for select
  using (true);

create policy "All users can create issues"
  on issues for insert
  with check (raised_by = get_current_profile_id());

create policy "Raisers and admins can update issues"
  on issues for update
  using (
    raised_by = get_current_profile_id()
    or get_current_access_level() = 'admin'
  );

create policy "Admins can delete issues"
  on issues for delete
  using (get_current_access_level() = 'admin');

-- ============================================
-- TO-DOS
-- ============================================
create policy "All users can view todos"
  on todos for select
  using (true);

create policy "All users can create todos"
  on todos for insert
  with check (owner_id = get_current_profile_id() or get_current_access_level() = 'admin');

create policy "Owners can update todos"
  on todos for update
  using (
    owner_id = get_current_profile_id()
    or get_current_access_level() = 'admin'
  );

create policy "Owners and admins can delete todos"
  on todos for delete
  using (
    owner_id = get_current_profile_id()
    or get_current_access_level() = 'admin'
  );

-- ============================================
-- UPDATES
-- ============================================
create policy "All users can view published updates"
  on updates for select
  using (
    is_draft = false
    or author_id = get_current_profile_id()
  );

create policy "Users can create updates"
  on updates for insert
  with check (author_id = get_current_profile_id());

create policy "Authors can update own updates"
  on updates for update
  using (author_id = get_current_profile_id());

create policy "Authors can delete own updates"
  on updates for delete
  using (author_id = get_current_profile_id());

-- ============================================
-- ALERTS
-- ============================================
create policy "All users can view alerts"
  on alerts for select
  using (true);

create policy "Users can create alerts"
  on alerts for insert
  with check (triggered_by = get_current_profile_id() or triggered_by is null);

-- ============================================
-- ALERT ACKNOWLEDGMENTS
-- ============================================
create policy "All users can view acknowledgments"
  on alert_acknowledgments for select
  using (true);

create policy "Users can acknowledge alerts"
  on alert_acknowledgments for insert
  with check (profile_id = get_current_profile_id());

-- ============================================
-- PRIVATE NOTES (restricted access)
-- ============================================
create policy "Authors and recipients can view private notes"
  on private_notes for select
  using (
    author_id = get_current_profile_id()
    or recipient_id = get_current_profile_id()
  );

create policy "Users can create private notes"
  on private_notes for insert
  with check (author_id = get_current_profile_id());

create policy "Recipients can update private notes status"
  on private_notes for update
  using (recipient_id = get_current_profile_id());

-- ============================================
-- MEETINGS
-- ============================================
create policy "All users can view meetings"
  on meetings for select
  using (true);

create policy "Admins can manage meetings"
  on meetings for all
  using (get_current_access_level() = 'admin');

-- ============================================
-- MEETING ATTENDEES
-- ============================================
create policy "All users can view attendees"
  on meeting_attendees for select
  using (true);

create policy "Admins can manage attendees"
  on meeting_attendees for all
  using (get_current_access_level() = 'admin');

-- ============================================
-- BRIEFINGS (personal)
-- ============================================
create policy "Users can view own briefings"
  on briefings for select
  using (profile_id = get_current_profile_id());

create policy "System can create briefings"
  on briefings for insert
  with check (true);  -- Controlled by service role

create policy "Users can update own briefings viewed_at"
  on briefings for update
  using (profile_id = get_current_profile_id());

-- ============================================
-- ISSUE PATTERNS
-- ============================================
create policy "All users can view patterns"
  on issue_patterns for select
  using (true);

create policy "Admins can manage patterns"
  on issue_patterns for all
  using (get_current_access_level() = 'admin');
