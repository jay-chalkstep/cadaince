# Team Cascade & Hierarchy Implementation

**Date:** December 31, 2024 (into January 1, 2025)
**Status:** Complete

## Overview

Evolved Aicomplice from a single-team EOS tool to a full organizational cascade with 1-4 levels of team hierarchy. Teams are derived from the Accountability Chart seat structure, not manually created.

## Architecture

### Hierarchy Levels

```
Level 1: ELT (Executive Leadership Team)
   └── Level 2: Pillar (Growth, Product, Operations, etc.)
         └── Level 3: Department (Sales, Marketing, Engineering, etc.)
               └── Level 4: Team (SDR Team, Frontend Team, etc.)
```

### Key Design Decisions

- **Teams derived from seats:** Teams are auto-created from Accountability Chart seats via `anchor_seat_id`
- **Dual ID pattern:** Keep both `pillar_id` (functional area) and `team_id` (ownership group)
- **Visibility:** Rocks/Scorecard org-wide, Issues/Todos/Headlines team-scoped
- **Confidentiality:** `is_confidential` boolean restricts items to ELT-only visibility

## Database Migrations Applied

### 032_teams_and_hierarchy.sql
- Created `teams` table with hierarchy support
- Created `team_memberships` view (computed from seat assignments)
- Added `team_id` columns to: rocks, issues, todos, headlines, l10_meetings
- Added `parent_rock_id` for rock cascade
- Added `is_confidential` to rocks, issues, headlines
- Created `individual_goals` table
- Created helper functions: `get_team_ancestors()`, `get_team_descendants()`

### 033_scorecard_rollup.sql
- Added rollup columns to metrics: `team_id`, `parent_metric_id`, `aggregation_type`, `is_rollup`
- Created `metric_values` table for history/audit trail
- Created `calculate_metric_rollup()` function

### 034_issue_escalation.sql
- Added `original_team_id` to issues for escalation tracking
- Note: `escalate_issue()` function implemented in API route instead

### 035_team_rls_policies.sql
- RLS policies for `teams` table (org-scoped viewing, admin management)
- RLS policies for `individual_goals` table
- Confidentiality validation trigger for issues, headlines, rocks

### 036_auto_map_existing_data.sql
- Auto-creates teams from existing seats
- Sets parent team relationships from seat hierarchy
- Calculates correct team levels based on depth
- Maps existing rocks, issues, L10 meetings to teams

## New Database Schema

```sql
-- Teams (derived from Accountability Chart)
teams (
  id, organization_id, anchor_seat_id, parent_team_id,
  name, slug, level, is_elt, l10_required, settings
)

-- Individual Goals (Level 4, below rocks)
individual_goals (
  id, organization_id, team_id, rock_id, owner_id,
  title, description, target_value, current_value, unit,
  due_date, status
)

-- Metric Values (history for rollups)
metric_values (
  id, metric_id, value, recorded_at, recorded_by, source, notes
)

-- New columns on existing tables
rocks: team_id, parent_rock_id, is_confidential
issues: team_id, is_confidential, original_team_id
todos: team_id
headlines: team_id, is_confidential
l10_meetings: team_id
metrics: team_id, parent_metric_id, aggregation_type, is_rollup
```

## API Routes Created

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/teams` | GET | List teams with hierarchy |
| `/api/teams/[id]` | GET, PATCH | Team details and settings |
| `/api/teams/[id]/members` | GET | Team members from view |
| `/api/issues/[id]/escalate` | GET, POST | Issue escalation to parent team |
| `/api/metrics/[id]/children` | GET, POST | Child metrics for rollup |
| `/api/goals` | GET, POST | Individual goals CRUD |
| `/api/goals/[id]` | GET, PATCH, DELETE | Individual goal management |
| `/api/rocks/[id]` | GET, PATCH | Enhanced with team context |

## UI Components Created

| Component | Purpose |
|-----------|---------|
| `team-context-provider.tsx` | React context for team state |
| `team-switcher.tsx` | Dropdown for team selection |
| `team-tree.tsx` | Visual hierarchy tree |
| `escalate-button.tsx` | Issue escalation UI |
| `rock-cascade-tree.tsx` | Rock hierarchy visualization |

## Pages Created

| Route | Purpose |
|-------|---------|
| `/teams` | Team overview with hierarchy |
| `/teams/[slug]` | Team dashboard |
| `/teams/[slug]/rocks` | Team rocks |
| `/teams/[slug]/scorecard` | Team scorecard |
| `/teams/[slug]/issues` | Team issues |
| `/teams/[slug]/l10` | Team L10 meeting |

## TypeScript Fixes for Vercel Build

### 1. Supabase Array Handling
**File:** `app/api/issues/[id]/escalate/route.ts`

Supabase returns nested relations as arrays. Fixed by applying `Array.isArray()` checks:

```typescript
const teamData = Array.isArray(issue.team) ? issue.team[0] : issue.team;
```

Applied to all team relation access points in the escalation chain.

### 2. Team Interface Missing Assignments
**File:** `components/team/team-context-provider.tsx`

Added `assignments` field to `anchor_seat` type:

```typescript
anchor_seat?: {
  // ... existing fields
  assignments?: Array<{
    team_member: {
      id: string;
      full_name: string;
      avatar_url: string | null;
    };
  }>;
};
```

### 3. AvatarImage null vs undefined
**File:** `components/team/team-tree.tsx`

Fixed type mismatch for AvatarImage src prop:

```typescript
src={anchorMember.avatar_url || undefined}
```

## Deployment

- **Vercel:** Deployed successfully to app.aicomplice.com
- **Supabase:** All migrations applied to production (project: nlvjiksutojrdgnqhytd)

## Notes

- Teams table is empty until seats are added to the Accountability Chart
- Teams are auto-created via the team-sync Inngest function when AC changes
- L10 meetings are required for levels 1-2 (ELT, Pillar), optional for 3-4
- Metric rollup trigger skipped (metrics table lacks `current_value` column)

## Files Changed

### New Files
- `app/api/teams/route.ts`
- `app/api/teams/[id]/route.ts`
- `app/api/teams/[id]/members/route.ts`
- `app/api/issues/[id]/escalate/route.ts`
- `app/api/metrics/[id]/children/route.ts`
- `app/api/goals/route.ts`
- `app/api/goals/[id]/route.ts`
- `app/(dashboard)/teams/page.tsx`
- `app/(dashboard)/teams/[slug]/page.tsx`
- `app/(dashboard)/teams/[slug]/rocks/page.tsx`
- `app/(dashboard)/teams/[slug]/scorecard/page.tsx`
- `app/(dashboard)/teams/[slug]/issues/page.tsx`
- `app/(dashboard)/teams/[slug]/l10/page.tsx`
- `components/team/team-context-provider.tsx`
- `components/team/team-switcher.tsx`
- `components/team/team-tree.tsx`
- `components/issues/escalate-button.tsx`
- `components/rocks/rock-cascade-tree.tsx`
- `lib/inngest/functions/team-sync.ts`
- `supabase/migrations/032_teams_and_hierarchy.sql`
- `supabase/migrations/033_scorecard_rollup.sql`
- `supabase/migrations/034_issue_escalation.sql`
- `supabase/migrations/035_team_rls_policies.sql`
- `supabase/migrations/036_auto_map_existing_data.sql`

### Modified Files
- `components/layout/sidebar.tsx` - Added Teams nav item
- `components/rocks/rocks-list.tsx` - Team filtering support
- `components/l10/preview/OffTrackRocksList.tsx` - Team context
