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

This is a **monorepo** with two separate Next.js applications:

```
apps/
  marketing/              # Marketing site (aicomplice.com)
    app/
      page.tsx            # Landing page
      not-found.tsx       # 404 page
  web/                    # Product app (app.aicomplice.com)
    app/
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
      onboarding/         # Wizard step components
    lib/
      ai/                 # Claude integration
      integrations/       # HubSpot, BigQuery
      supabase/           # Client, types
packages/
  ui/                     # Shared UI components (shadcn/ui)
    src/
      button.tsx
      card.tsx
      ...etc
supabase/
  migrations/             # SQL migrations
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
# Install dependencies (from root)
npm install

# Start app dev server (app.aicomplice.com)
npm run dev:app
# or from apps/web: npm run dev

# Start marketing dev server (aicomplice.com)
npm run dev:marketing
# or from apps/marketing: npm run dev

# Build all apps
npm run build

# Run migrations
npx supabase db push

# Generate types from Supabase
npx supabase gen types typescript --local > apps/web/lib/supabase/types.ts

# Seed dev data
npx supabase db seed
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

This monorepo requires **TWO separate Vercel projects**:

### 1. Marketing Site (aicomplice.com)
- **Vercel Project Name:** `aicomplice-marketing`
- **Root Directory:** `apps/marketing`
- **Domain:** `aicomplice.com` + `www.aicomplice.com`
- **Environment Variables:**
  - `NEXT_PUBLIC_APP_URL=https://app.aicomplice.com`

### 2. Product App (app.aicomplice.com)
- **Vercel Project Name:** `aicomplice-app`
- **Root Directory:** `apps/web`
- **Domain:** `app.aicomplice.com`
- **Environment Variables:** See `.env.local.example` in `apps/web/`

**DO NOT create a vercel.json file at the repository root.** Configure Root Directory via the Vercel dashboard for each project.

If there are deployment issues, check:
1. Environment variables are set in Vercel dashboard for the correct project
2. The Root Directory setting points to the correct `apps/` subdirectory
3. API route code for runtime errors
