-- Cadence Database Schema
-- Migration 010: Align issues + todos tables with API expectations

-- ============================================
-- TODOS: add richer fields expected by /api/todos
-- ============================================

alter table todos
  add column if not exists description text;

alter table todos
  add column if not exists created_by uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'todos_created_by_fkey'
  ) then
    alter table todos
      add constraint todos_created_by_fkey
      foreign key (created_by) references profiles(id);
  end if;
end $$;

alter table todos
  add column if not exists is_complete boolean default false;

alter table todos
  add column if not exists linked_rock_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'todos_linked_rock_id_fkey'
  ) then
    alter table todos
      add constraint todos_linked_rock_id_fkey
      foreign key (linked_rock_id) references rocks(id);
  end if;
end $$;

alter table todos
  add column if not exists linked_issue_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'todos_linked_issue_id_fkey'
  ) then
    alter table todos
      add constraint todos_linked_issue_id_fkey
      foreign key (linked_issue_id) references issues(id);
  end if;
end $$;

-- Backfill completeness based on completed_at
update todos
set is_complete = (completed_at is not null)
where is_complete is distinct from (completed_at is not null);

-- Keep is_complete and completed_at consistent
create or replace function sync_todo_completion()
returns trigger
language plpgsql
as $$
begin
  -- If is_complete is set but completed_at isn't, set completed_at
  if new.is_complete is true and new.completed_at is null then
    new.completed_at := now();
  end if;

  -- If is_complete is false, clear completed_at
  if new.is_complete is false then
    new.completed_at := null;
  end if;

  -- Derive is_complete from completed_at
  new.is_complete := (new.completed_at is not null);

  return new;
end;
$$;

drop trigger if exists trg_sync_todo_completion on todos;
create trigger trg_sync_todo_completion
before insert or update of is_complete, completed_at
on todos
for each row
execute function sync_todo_completion();

create index if not exists todos_is_complete_idx on todos(is_complete);
create index if not exists todos_linked_rock_id_idx on todos(linked_rock_id);
create index if not exists todos_linked_issue_id_idx on todos(linked_issue_id);

-- ============================================
-- ISSUES: align columns expected by /api/issues
-- ============================================

alter table issues
  add column if not exists owner_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'issues_owner_id_fkey'
  ) then
    alter table issues
      add constraint issues_owner_id_fkey
      foreign key (owner_id) references profiles(id);
  end if;
end $$;

alter table issues
  add column if not exists created_by uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'issues_created_by_fkey'
  ) then
    alter table issues
      add constraint issues_created_by_fkey
      foreign key (created_by) references profiles(id);
  end if;
end $$;

alter table issues
  add column if not exists linked_rock_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'issues_linked_rock_id_fkey'
  ) then
    alter table issues
      add constraint issues_linked_rock_id_fkey
      foreign key (linked_rock_id) references rocks(id);
  end if;
end $$;

-- Default API expects 'open' for new issues
alter table issues alter column status set default 'open';

-- Backfill created_by from raised_by for existing records
update issues
set created_by = raised_by
where created_by is null;

-- If owner_id is null for existing issues, set to created_by (safe default)
update issues
set owner_id = created_by
where owner_id is null and created_by is not null;

-- Map old default status (if present) to 'open' for API consistency
update issues
set status = 'open'
where status in ('detected');

create index if not exists issues_owner_id_idx on issues(owner_id);
create index if not exists issues_created_by_idx on issues(created_by);
create index if not exists issues_linked_rock_id_idx on issues(linked_rock_id);
