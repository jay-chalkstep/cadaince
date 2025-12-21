# CLAUDE.md — Aicomplice

## What This Is
Aicomplice is a Leadership Alignment Engine implementing the EOS (Entrepreneurial Operating System) framework. It synthesizes metrics, context, and updates into decision-ready intelligence for executive teams.

**Brand:** Aicomplice (your AI accomplice for leadership alignment)
**App URL:** app.aicomplice.com
**Marketing URL:** aicomplice.com

## Multi-Tenant Architecture
This is a multi-tenant SaaS application. Every data table includes organization_id and uses Row Level Security to isolate tenants.

**Critical Rules:**
- EVERY query must scope by organization_id
- NEVER expose data across organizations
- RLS policies enforce isolation at the database level
- New orgs are created via the onboarding wizard

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 (App Router) + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Database | Supabase (PostgreSQL + Realtime + RLS) |
| Auth | Clerk |
| AI | Anthropic Claude (briefing generation) |
| Video | Mux (hosting) + Deepgram (transcription) |
| Charts | Recharts |
| Background Jobs | Inngest |

## Project Structure

```
apps/
  web/                    # Next.js application
    app/
      (marketing)/        # Public pages (landing, pricing)
      (auth)/             # Clerk auth pages
      (dashboard)/        # Protected app pages
        briefing/
        scorecard/
        rocks/
        issues/
        todos/
        updates/
        vision/           # V/TO display
        settings/
        onboarding/       # Setup wizard
      api/                # API routes
    components/
      layout/             # Sidebar, headers
      ui/                 # shadcn components
      onboarding/         # Wizard step components
    lib/
      ai/                 # Claude integration
      integrations/       # HubSpot, BigQuery
      supabase/           # Client, types
supabase/
  migrations/             # SQL migrations
  seed.sql                # Dev seed data only
```

## Database Schema Overview

### Core Tables

**organizations** — Multi-tenant root
- id, name, slug, logo_url, settings (JSONB)
- Each org has its own V/TO, pillars, team, metrics

**vto** — Vision/Traction Organizer (one per org)
- core_values, core_focus_purpose, core_focus_niche
- ten_year_target, marketing_strategy
- three_year_picture, one_year_plan
- year (to support annual versioning)

**pillars** — Functional areas (Executive, Growth, Customer, etc.)
- name, slug, color, sort_order
- FK to organization

**team_members** — Extends Clerk users with EOS structure
- clerk_user_id, email, full_name, title
- role (admin, elt, slt, consumer)
- manager_id (FK to team_members for reporting structure)
- eos_seat (Visionary, Integrator, etc.)
- status (invited, active, inactive)

**team_member_pillars** — Junction table for multi-pillar membership
- team_member_id, pillar_id
- is_primary (home pillar), is_lead (runs pillar L10)

**quarters** — Time periods for rock planning
- year, quarter (1-4)
- start_date, end_date
- planning_status (upcoming, planning, active, completed, reviewed)

**rocks** — Quarterly initiatives with cascade
- rock_level (company, pillar, individual)
- parent_rock_id (for cascade hierarchy)
- pillar_id (for pillar/individual rocks)
- quarter_id (which quarter)
- owner_id, status, title, description

**meetings** — Recurring meeting definitions
- meeting_type (leadership_l10, pillar_l10, one_on_one, quarterly, annual)
- pillar_id (for pillar L10s)
- manager_id, direct_id (for 1:1s)
- attendee_ids (array), schedule info

**meeting_instances** — Actual meeting occurrences
- meeting_id, scheduled_at, status
- scorecard_snapshot, rocks_snapshot (point-in-time)
- notes, ai_summary

**one_on_one_topics** — Persistent 1:1 talking points
- meeting_id, added_by_id
- title, notes, status (open, discussed, resolved)

**issues** — IDS workflow items with escalation
- issue_level (individual, pillar, company)
- pillar_id, originated_in_meeting_id
- escalated_from_id, escalated_at (for tracking escalation chain)

**data_sources** — Reusable query definitions
- source_type (hubspot, bigquery)
- Configuration for each type
- Referenced by metrics with time windows

**metrics** — Scorecard items
- source_type (manual, data_source, calculated)
- data_source_id + time_window OR formula
- owner_id (FK to team_members)

**todos** — Action items
**updates** — Video/text updates with transcription
**private_notes** — Confidential executive communication
**alerts** — Interrupt-driven notifications

### Key Analytics Views

**company_rock_analytics** — Cascade metrics per company rock
**company_rock_team_coverage** — "X% of team support this rock"
**pillar_health** — Team size, rocks, issues per pillar

### RLS Pattern

All tables use Row Level Security. Pattern:

```sql
CREATE POLICY "Users can view own org data"
ON table_name FOR SELECT
USING (
  organization_id = (
    SELECT organization_id FROM team_members
    WHERE clerk_user_id = auth.uid()
  )
);
```

## Key Concepts

### Roles

- **admin** — Full access, can manage org settings, invite users
- **elt** — Executive Leadership Team, can create/edit most things
- **slt** — Senior Leadership Team, can view and own assigned items
- **consumer** — Read-only access to briefings and dashboards

### Pillars

Functional areas that group metrics, rocks, and people:
- Executive, Growth, Customer, Product, Operations, Finance, People
- Customizable per organization during onboarding

### V/TO (Vision/Traction Organizer)

The strategic foundation. All other modules reference it:
- Rocks should link to 1-Year Plan goals
- Scorecard metrics map to 3-Year Picture measurables
- AI briefing references V/TO for context

### Morning Briefing

AI-generated daily synthesis that:
- Summarizes what changed since yesterday
- Highlights metrics off track
- Surfaces rocks needing attention
- References V/TO for strategic context
- Personalizes based on role and pillar

### Rock Cascade (Company → Pillar → Individual)

Rocks flow down and accountability flows up:

```
Company Rock: "Increase ARR to $8M"
├── Pillar Rock (Growth): "Launch partner channel"
│   ├── Individual Rock: "Sign 5 partner agreements" (Sarah)
│   └── Individual Rock: "Build partner marketing kit" (Tom)
└── Pillar Rock (Product): "Ship self-serve onboarding"
    └── Individual Rock: "Complete user research" (Mike)
```

- **Company Rocks (3-7):** Set by ELT, support 1-Year Plan
- **Pillar Rocks:** Owned by Pillar Leads, support Company Rocks
- **Individual Rocks:** Owned by team members, support Pillar Rocks

### Meeting Pulse

```
1:1s (Manager + Direct)
    └── surfaces blockers → escalates to...
Pillar L10 (Pillar Lead + Team)
    └── escalates cross-pillar issues to...
Leadership L10 (ELT)
    └── company-level decisions
```

### Org Structure

- **Reporting line** = who you have 1:1s with (manager_id)
- **Pillar membership** = functional area (can be multiple)
- **Pillar lead** = runs the Pillar L10

## Feature Modules

### Accountability Chart

Visual org chart showing seats (roles) and who fills them. Core EOS artifact.

**Tables:**
- **seats** — Role definitions with hierarchy (parent_seat_id), GWC indicators, pillar association
- **seat_assignments** — Junction table linking team_members to seats (supports multiple people per seat)

**Key Concepts:**
- Seats represent roles, not people (a seat can be empty or shared)
- GWC = Gets it, Wants it, Capacity to do it (EOS people evaluation)
- Hierarchy flows: Visionary/Integrator → Pillar Leads → Team Members

**Routes:** `/accountability-chart`

### To-Do Visibility

To-dos split into private (only you) and team (visible in L10s).

**Schema Changes:**
- `todos.visibility` — 'private' | 'team' (default: team)
- `todos.meeting_id` — Links to meeting where created

**UI:** Two-tab layout on /todos page. My 90 dashboard shows both counts.

### Headlines

5-minute L10 ritual. Good news about customers or employees. Builds culture.

**Table: headlines**
- `headline_type` — 'customer' | 'employee' | 'general'
- `mentioned_member_id` — Employee being recognized
- `meeting_id` — Which L10 it was shared in
- `reactions` — JSONB for emoji reactions

**Routes:** `/headlines`

**Integration:** Headlines widget on My 90 dashboard. Headlines section in L10 meeting view.

### Rock Milestones

Break 90-day rocks into trackable milestones. Shows progress within rocks.

**Table: rock_milestones**
- `rock_id` — Parent rock
- `title`, `description`, `due_date`
- `status` — 'not_started' | 'in_progress' | 'complete' | 'blocked'
- `sort_order` — For drag reordering

**Rock Table Additions:**
- `milestone_count`, `milestones_complete` — Cached counts for progress display

**UI:** Expandable milestone section in rock detail. Progress bar on rock cards.

### Getting Started Widget

Persistent activation checklist. Drives feature discovery.

**Table: onboarding_progress**
- `completed_items` — JSONB tracking completion timestamps
- `dismissed_at` — When user hid the widget

**Checklist Items:**
1. Create organization (auto-detected)
2. Set up pillars (auto-detected)
3. Invite 2+ team members
4. Start V/TO (auto-detected)
5. Build accountability chart
6. Add first scorecard metric
7. Create a rock
8. Schedule an L10
9. Connect live data integration
10. Share a headline

**UI:** Fixed bottom-left widget, collapsible, shows percentage complete. Persists until dismissed or 100%.

### Process Documentation

Document Core Processes (the "Way" you do things). EOS requires documenting and following processes.

**Tables:**
- **processes** — Name, description, owner, pillar, status (draft/active/archived)
- **process_steps** — Ordered steps within a process, rich text descriptions

**Routes:** `/process`, `/process/[id]`

**Starter Templates:** Sales Process, Hiring Process, Customer Onboarding

### Insights Dashboard

Aggregate view of organizational health. Trends, comparisons, early warnings.

**Table: insight_snapshots**
- Daily cached snapshots of org health metrics
- `metrics_on_track`, `metrics_off_track`, `rocks_on_track`, etc.
- `pillar_health` — JSONB breakdown by pillar

**Background Job:** `daily-insight-snapshot` via Inngest

**Routes:** `/insights`

**Dashboard Sections:**
- Health score cards (Scorecard, Rocks, To-Dos, Issues)
- Trend charts (4-week line charts)
- Pillar breakdown table
- Attention needed list (off-track items)

### Database Schema Summary

```
organizations
├── seats (Accountability Chart)
│   └── seat_assignments → team_members
├── pillars
│   └── processes
│       └── process_steps
├── team_members
├── headlines
├── rocks
│   └── rock_milestones
├── todos (+ visibility, meeting_id)
├── issues
├── metrics
├── meetings
├── vto
├── onboarding_progress
└── insight_snapshots
```

### Shared Components

| Component | Used By |
|-----------|---------|
| `<OrgTree />` | Accountability Chart |
| `<ProgressRing />` | Rock milestones, Getting Started, Insights |
| `<Checklist />` | Getting Started, Rock milestones |
| `<RichTextEditor />` | Process steps, Headlines |
| `<TrendChart />` | Insights dashboard |
| `<ReactionBar />` | Headlines |

### Background Jobs (Inngest)

| Job | Schedule | Purpose |
|-----|----------|---------|
| `daily-insight-snapshot` | Nightly | Cache org health metrics |
| `onboarding-progress-sync` | On data change | Auto-detect checklist completions |
| `milestone-reminder` | Daily | Notify approaching milestone due dates |

### Migration Files

Run in order:

```
013_seats.sql              # Accountability chart
014_todos_visibility.sql   # Private/team to-dos
015_headlines.sql          # Headlines
016_milestones.sql         # Rock milestones
017_onboarding_progress.sql # Getting started tracking
018_processes.sql          # Process documentation
019_insights.sql           # Insights snapshots
```

### API Route Summary

```
/api/accountability-chart/
  GET /                    # Full chart
  POST /seats              # Create seat
  PATCH /seats/:id         # Update seat
  DELETE /seats/:id        # Delete seat
  POST /seats/:id/assign   # Assign member
  DELETE /seats/:id/assign/:mid  # Unassign

/api/headlines/
  GET /                    # List headlines
  POST /                   # Create headline
  DELETE /:id              # Delete headline
  POST /:id/react          # Add reaction

/api/rocks/:id/milestones/
  GET /                    # List milestones
  POST /                   # Create milestone
  PATCH /:mid              # Update milestone
  DELETE /:mid             # Delete milestone
  POST /reorder            # Reorder

/api/onboarding-progress/
  GET /                    # Current progress
  POST /:key               # Mark complete
  POST /dismiss            # Dismiss widget

/api/processes/
  GET /                    # List processes
  GET /:id                 # Process with steps
  POST /                   # Create process
  PATCH /:id               # Update process
  DELETE /:id              # Delete process
  POST /:id/steps          # Add step
  PATCH /:id/steps/:sid    # Update step
  DELETE /:id/steps/:sid   # Delete step
  POST /:id/publish        # Publish

/api/insights/
  GET /                    # Current health
  GET /trends              # Historical trends
  GET /pillar/:id          # Pillar breakdown
```

### Sidebar Navigation Update

Add to existing sidebar in this order:

```tsx
// After existing items
{ name: 'Headlines', href: '/headlines', icon: Megaphone },
{ name: 'Accountability Chart', href: '/accountability-chart', icon: GitBranch },
{ name: 'Process', href: '/process', icon: Workflow },
{ name: 'Insights', href: '/insights', icon: BarChart3 },
```

Icons from `lucide-react`.

### My 90 Dashboard Widgets

The home dashboard (`/briefing` or `/my-90`) should include:

1. **Team To-Dos** — Count + quick list (existing, now filtered to team)
2. **Private To-Dos** — Count + quick list (new)
3. **Rocks & Milestones** — Your rocks with progress bars (enhanced)
4. **Recent Headlines** — Last 3-5 headlines (new)
5. **Scorecard** — Your metrics (existing)
6. **Getting Started** — Widget in bottom-left (new, conditional)

### Competitive Positioning

**What we have that Ninety.io doesn't:**
- Live data integrations (HubSpot, BigQuery) — no manual entry
- AI Morning Briefing — personalized daily synthesis
- Async video updates with transcription
- Private Notes to CoS/CEO — shadow communication layer
- Role-aware personalization

**What we're adding for parity:**
- Accountability Chart
- Private/Team To-Do split
- Headlines
- Rock Milestones
- Process Documentation
- Insights Dashboard
- Getting Started widget

After this build, Aicomplice has full EOS feature coverage PLUS differentiated AI/data capabilities.

## Development Commands

```bash
# Start dev server
pnpm dev

# Run migrations
pnpm supabase db push

# Generate types from Supabase
pnpm supabase gen types typescript --local > lib/supabase/types.ts

# Seed dev data
pnpm supabase db seed

# Deploy to Vercel
vercel --prod
```

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

ANTHROPIC_API_KEY=

MUX_TOKEN_ID=
MUX_TOKEN_SECRET=

DEEPGRAM_API_KEY=

HUBSPOT_ACCESS_TOKEN=
BIGQUERY_PROJECT_ID=
BIGQUERY_CREDENTIALS= (base64 encoded service account JSON)
```

## Code Style

- Use TypeScript strict mode
- Prefer server components, use 'use client' only when needed
- Use shadcn/ui components from @/components/ui
- Database queries go through lib/supabase, not directly in components
- API routes use Next.js Route Handlers
- Form validation with zod + react-hook-form
- Loading states with Suspense boundaries
- Error boundaries for graceful degradation
