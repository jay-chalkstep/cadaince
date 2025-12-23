-- Cadence Database Schema
-- Migration 011: Update Issues RLS policies to align with owner_id / created_by

-- Note: Service-role (admin) clients bypass RLS, but keeping policies correct
-- makes it safe to move more routes to user-scoped Supabase clients later.

-- Drop legacy policies that referenced raised_by
drop policy if exists "All users can view issues" on issues;
drop policy if exists "All users can create issues" on issues;
drop policy if exists "Raisers and admins can update issues" on issues;
drop policy if exists "Admins can delete issues" on issues;

-- Recreate policies using owner_id / created_by
create policy "All users can view issues"
  on issues for select
  using (true);

create policy "All users can create issues"
  on issues for insert
  with check (
    created_by = get_current_profile_id()
    or get_current_access_level() = 'admin'
  );

create policy "Owners/creators and admins can update issues"
  on issues for update
  using (
    owner_id = get_current_profile_id()
    or created_by = get_current_profile_id()
    or get_current_access_level() = 'admin'
  );

create policy "Owners/creators and admins can delete issues"
  on issues for delete
  using (
    owner_id = get_current_profile_id()
    or created_by = get_current_profile_id()
    or get_current_access_level() = 'admin'
  );
