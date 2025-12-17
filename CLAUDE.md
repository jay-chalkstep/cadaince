# Cadence - Claude Code Guidelines

## Project Overview
Leadership alignment engine for Choice Digital. See `/Docs/cadence-technical-spec.md` for full specification.

## Tech Stack
- Next.js 14 (App Router)
- Tailwind CSS + shadcn/ui
- Supabase (Postgres + Realtime + Storage)
- Clerk (Auth)
- Mux (Video)
- Deepgram (Transcription)
- Anthropic Claude (AI)
- Inngest (Background Jobs)
- Recharts (Charts)
- Lucide (Icons)

## Code Style
- Use TypeScript strict mode
- Prefer named exports
- Use async/await over .then()
- Components in PascalCase
- Utilities in camelCase
- Database queries in lib/supabase/

## Commit Convention
Use Conventional Commits: `type(scope): description`

**Types:** feat, fix, docs, style, refactor, perf, test, chore, ci

**Scopes:** db, api, ui, auth, scorecard, rocks, issues, todos, updates, alerts, briefing, notes, meetings, ios, inngest

Commit frequently - one logical change per commit.

## File Structure
```
apps/web/
├── app/
│   ├── (auth)/          # Auth routes (sign-in, sign-up)
│   ├── (dashboard)/     # Main app routes
│   │   ├── briefing/    # Morning briefing
│   │   ├── scorecard/   # EOS scorecard
│   │   ├── rocks/       # Rocks management
│   │   ├── issues/      # Issues list
│   │   ├── todos/       # To-dos
│   │   ├── updates/     # Update feed
│   │   ├── alerts/      # Alert history
│   │   ├── meetings/    # L10 support
│   │   ├── people/      # User/org management
│   │   └── settings/    # App settings
│   └── api/             # API routes
├── components/
│   ├── ui/              # shadcn base components
│   ├── layout/          # App shell components
│   ├── scorecard/       # Scorecard-specific
│   ├── rocks/           # Rocks-specific
│   ├── updates/         # Update components
│   ├── briefing/        # Briefing components
│   └── meetings/        # L10 components
└── lib/
    ├── supabase/        # Supabase client & queries
    ├── clerk/           # Clerk utilities
    ├── ai/              # Claude integration
    └── integrations/    # HubSpot, BigQuery, etc.
```

## Testing
- API routes: test with sample requests before moving on
- UI: verify in browser after each component
- Document any manual testing done in commit message if relevant

## When Stuck
- Check the technical spec in `/Docs/cadence-technical-spec.md`
- Follow the implementation sequence (Sprint 1 → 2 → 3...)
- Each sprint builds on the previous one

## Sprint Implementation Order

### Sprint 1: Foundation
- [x] Initialize Next.js 14 project with App Router
- [x] Configure Tailwind + shadcn/ui
- [x] Create folder structure
- [x] Set up Supabase project
- [x] Run database migrations (SQL files in supabase/migrations/)
- [x] Integrate Clerk authentication
- [x] Build app shell (sidebar, header, routing)
- [x] Create Clerk webhook to sync users to profiles
- [x] Seed database with Choice Digital users/pillars

### Sprint 2: EOS Core
- [x] Metrics CRUD API routes
- [x] Scorecard page with table view
- [x] Rocks CRUD API routes
- [x] Rocks page with status cards
- [x] Issues CRUD API routes and page
- [x] To-Dos CRUD API routes and page

### Sprint 3: Updates
- [x] Updates CRUD API routes
- [x] Updates page with feed view
- [x] Video upload with Mux
- [x] Transcription with Deepgram

### Sprint 4: Alerts & Private Notes
- Alert system
- Private notes for sensitive communication

### Sprint 5: iOS App
- Swift/SwiftUI implementation

### Sprint 6: Intelligence
- Morning briefing generation with Claude
- Pre-meeting synthesis
