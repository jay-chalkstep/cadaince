# Aicomplice - Claude Code Guidelines

## What This Is
Aicomplice is a Leadership Alignment Engine implementing the EOS (Entrepreneurial Operating System) framework. It synthesizes metrics, context, and updates into decision-ready intelligence for executive teams.

**Brand:** Aicomplice (your AI accomplice for leadership alignment)
**App URL:** app.aicomplice.com
**Marketing URL:** aicomplice.com

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
- pillar_id, is_pillar_lead
- responsibilities (text array)
- status (invited, active, inactive)

**data_sources** — Reusable query definitions
- source_type (hubspot, bigquery)
- Configuration for each type
- Referenced by metrics with time windows

**metrics** — Scorecard items
- source_type (manual, data_source, calculated)
- data_source_id + time_window OR formula
- owner_id (FK to team_members)

**rocks** — Quarterly initiatives
**issues** — IDS workflow items
**todos** — Action items
**updates** — Video/text updates with transcription
**private_notes** — Confidential executive communication
**alerts** — Interrupt-driven notifications

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

## Commit Convention

Use Conventional Commits: `type(scope): description`

**Types:** feat, fix, docs, style, refactor, perf, test, chore, ci

**Scopes:** db, api, ui, auth, scorecard, rocks, issues, todos, updates, alerts, briefing, notes, meetings, ios, inngest

Commit frequently - one logical change per commit.

## Vercel Deployment - IMPORTANT

**DO NOT create a vercel.json file at the repository root.** This is a monorepo with the Next.js app in `apps/web/`. The Vercel project is configured via the dashboard with Root Directory set to `apps/web/`. Adding a root-level vercel.json causes build failures and conflicts with this configuration.

If there are deployment issues, the fix is NOT vercel.json. Check:
1. Environment variables are set in Vercel dashboard
2. The Root Directory setting in Vercel points to `apps/web`
3. API route code for runtime errors
