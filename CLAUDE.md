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
