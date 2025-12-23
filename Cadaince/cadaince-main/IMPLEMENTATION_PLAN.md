# Aicomplice Feature Expansion - Implementation Plan

**Version:** 1.1
**Date:** December 2025
**Scope:** 7 features across P0/P1/P2 priority

---

## Current State Assessment

| Aspect | Status |
|--------|--------|
| Latest Migration | `015_org_rocks_cascade.sql` |
| Next Migration # | `016` |
| Inngest Setup | Not yet configured |
| Sidebar Items | 8 main + 3 secondary + 5 settings |

---

## Implementation Order

Based on dependencies and priority, here's the recommended build order:

### Phase 1: Foundation (P0)
1. **Accountability Chart** — Core EOS artifact, no dependencies
2. **Private/Team To-Dos** — Simple schema change, quick win

### Phase 2: Engagement (P1)
3. **Headlines** — Culture builder, referenced by Getting Started
4. **Rock Milestones** — Enhances existing rocks feature
5. **Getting Started Widget** — Depends on other features existing

### Phase 3: Insights (P2)
6. **Process Documentation** — Standalone documentation feature
7. **Insights Dashboard** — Aggregates data from all other features

---

## Feature Breakdown

### 1. Accountability Chart (P0)

**Migration:** `016_seats.sql`

```
Tables:
├── seats
│   ├── id, organization_id
│   ├── name, pillar_id, parent_seat_id
│   ├── roles (TEXT[]), GWC booleans
│   └── position_x, position_y, color
└── seat_assignments
    ├── seat_id → seats
    ├── team_member_id → team_members
    └── is_primary
```

**API Routes:** 6 endpoints
```
/api/accountability-chart/
├── GET /                     → Full chart with nested seats
├── POST /seats              → Create seat
├── PATCH /seats/[id]        → Update seat
├── DELETE /seats/[id]       → Delete seat (cascade assignments)
├── POST /seats/[id]/assign  → Assign member
└── DELETE /seats/[id]/assign/[memberId] → Unassign
```

**Components:**
```
/components/accountability-chart/
├── org-tree.tsx             → Tree visualization container
├── seat-card.tsx            → Individual seat card
├── seat-editor.tsx          → Modal for editing seat details
└── assign-member-dialog.tsx → Member picker dialog
```

**Page:** `/app/(dashboard)/accountability-chart/page.tsx`

**Sidebar:** Add `{ title: 'Accountability Chart', href: '/accountability-chart', icon: GitBranch }`

---

### 2. Private/Team To-Dos (P0)

**Migration:** `017_todos_visibility.sql`

```sql
ALTER TABLE todos ADD COLUMN visibility TEXT DEFAULT 'team';
ALTER TABLE todos ADD COLUMN meeting_id UUID REFERENCES meetings(id);
ALTER TABLE todos ADD COLUMN organization_id UUID REFERENCES organizations(id);
CREATE INDEX idx_todos_visibility ON todos(owner_id, visibility);
```

> Note: The current `todos` table is missing `organization_id` — this migration will fix that.

**API Changes:** Modify existing `/api/todos/`
- Add `?visibility=private|team|all` query param
- Include visibility in create/update payloads
- Backfill organization_id from owner's profile

**UI Changes:**
- `/todos/page.tsx`: Add tabs for "Team To-Dos" | "Private To-Dos"
- `CreateTodoDialog`: Add visibility toggle
- Briefing dashboard widget: Show split counts

**No new components needed** — enhance existing.

---

### 3. Headlines (P1)

**Migration:** `018_headlines.sql`

```
Tables:
└── headlines
    ├── id, organization_id
    ├── title, description
    ├── headline_type ('customer' | 'employee' | 'general')
    ├── created_by → team_members
    ├── mentioned_member_id → team_members (nullable)
    ├── meeting_id → meetings (nullable)
    ├── reactions JSONB
    └── shared_at, created_at
```

**API Routes:** 4 endpoints
```
/api/headlines/
├── GET /              → List headlines (paginated, newest first)
├── POST /             → Create headline
├── DELETE /[id]       → Delete (creator only)
└── POST /[id]/react   → Add/toggle reaction
```

**Components:**
```
/components/headlines/
├── headline-card.tsx    → Display with reactions
├── headline-form.tsx    → Create/edit form
├── reaction-bar.tsx     → Emoji reactions component
└── headlines-widget.tsx → My 90 dashboard widget
```

**Page:** `/app/(dashboard)/headlines/page.tsx` — Feed view

**Sidebar:** Add `{ title: 'Headlines', href: '/headlines', icon: Megaphone }`

---

### 4. Rock Milestones (P1)

**Migration:** `019_rock_milestones.sql`

```
Tables:
└── rock_milestones
    ├── id, rock_id → rocks
    ├── title, description, due_date
    ├── status ('not_started' | 'in_progress' | 'complete' | 'blocked')
    ├── completed_at, sort_order
    └── created_at, updated_at

-- Add to rocks table:
ALTER TABLE rocks ADD COLUMN milestone_count INTEGER DEFAULT 0;
ALTER TABLE rocks ADD COLUMN milestones_complete INTEGER DEFAULT 0;

-- Trigger to auto-update counts
```

**API Routes:** 5 endpoints
```
/api/rocks/[id]/milestones/
├── GET /           → List milestones for rock
├── POST /          → Create milestone
├── PATCH /[mid]    → Update milestone
├── DELETE /[mid]   → Delete milestone
└── POST /reorder   → Reorder milestones
```

**Component Changes:**
- `RockDetailSheet`: Add expandable milestones section
- `RockCard` (list view): Add mini progress bar
- New: `milestone-list.tsx`, `milestone-item.tsx`

**No new page needed** — integrates into existing rocks views.

---

### 5. Getting Started Widget (P1)

**Migration:** `020_onboarding_progress.sql`

```
Tables:
└── onboarding_progress
    ├── id, organization_id (UNIQUE)
    ├── completed_items JSONB
    │   └── {"key": "2025-01-15T...", ...}
    ├── dismissed_at
    └── created_at, updated_at
```

**Checklist Items (hardcoded):**
1. `org_created` — Create organization (auto-detect)
2. `pillars_configured` — Set up pillars (auto-detect)
3. `team_invited` — Invite 2+ team members
4. `vto_started` — Start V/TO (auto-detect)
5. `accountability_chart` — Build accountability chart
6. `first_metric` — Add first scorecard metric
7. `first_rock` — Create a rock
8. `first_meeting` — Schedule an L10
9. `data_integration` — Connect live data
10. `first_headline` — Share a headline

**API Routes:** 3 endpoints
```
/api/onboarding-progress/
├── GET /           → Current progress with computed completion %
├── POST /[key]     → Mark item complete
└── POST /dismiss   → Dismiss widget
```

**Components:**
```
/components/getting-started/
├── widget.tsx           → Fixed bottom-left widget
├── checklist.tsx        → Checklist items
└── use-onboarding.ts    → Hook for auto-detection
```

**Integration:** Add to dashboard layout (`/app/(dashboard)/layout.tsx`)

---

### 6. Process Documentation (P2)

**Migration:** `021_processes.sql`

```
Tables:
├── processes
│   ├── id, organization_id
│   ├── name, description
│   ├── pillar_id → pillars, owner_id → team_members
│   ├── status ('draft' | 'active' | 'archived')
│   ├── version, published_at
│   └── created_at, updated_at
└── process_steps
    ├── id, process_id → processes
    ├── title, description (rich text)
    ├── sort_order
    ├── external_url, external_tool
    └── created_at, updated_at
```

**API Routes:** 9 endpoints
```
/api/processes/
├── GET /                     → List processes
├── GET /[id]                 → Process with steps
├── POST /                    → Create process
├── PATCH /[id]               → Update process
├── DELETE /[id]              → Delete process
├── POST /[id]/steps          → Add step
├── PATCH /[id]/steps/[sid]   → Update step
├── DELETE /[id]/steps/[sid]  → Delete step
└── POST /[id]/publish        → Publish (set active)
```

**Components:**
```
/components/process/
├── process-card.tsx      → List card
├── process-editor.tsx    → Create/edit form
├── step-list.tsx         → Draggable step list
└── step-editor.tsx       → Step form (rich text)
```

**Pages:**
- `/app/(dashboard)/process/page.tsx` — List view
- `/app/(dashboard)/process/[id]/page.tsx` — Detail/editor

**Templates:** Pre-populate 3 starter templates on first load:
- Sales Process
- Hiring Process
- Customer Onboarding

**Sidebar:** Add `{ title: 'Process', href: '/process', icon: Workflow }`

---

### 7. Insights Dashboard (P2)

**Migration:** `022_insights.sql`

```
Tables:
└── insight_snapshots
    ├── id, organization_id
    ├── snapshot_date (UNIQUE with org_id)
    ├── metrics_on_track, metrics_off_track
    ├── rocks_on_track, rocks_off_track, rocks_complete
    ├── todos_complete, todos_overdue
    ├── issues_open, issues_resolved
    ├── headlines_count
    ├── pillar_health JSONB
    └── created_at
```

**API Routes:** 4 endpoints
```
/api/insights/
├── GET /                → Current health (computed live)
├── GET /snapshot        → Specific date snapshot
├── GET /trends          → Historical data for charts
└── GET /pillar/[id]     → Pillar-specific breakdown
```

**Background Job (Inngest):**
```typescript
// lib/inngest/daily-insight-snapshot.ts
export const dailyInsightSnapshot = inngest.createFunction(
  { id: "daily-insight-snapshot" },
  { cron: "0 2 * * *" }, // 2 AM daily
  async ({ step }) => {
    // Generate snapshots for all organizations
  }
);
```

**Components:**
```
/components/insights/
├── health-card.tsx      → Score card (donut chart)
├── trend-chart.tsx      → Recharts line chart
├── pillar-table.tsx     → Breakdown table
└── attention-list.tsx   → Items needing attention
```

**Page:** `/app/(dashboard)/insights/page.tsx`

**Dashboard Sections:**
1. Health score cards (4 donut charts)
2. Trend charts (4-week line charts)
3. Pillar breakdown table
4. Attention needed list

**Sidebar:** Add `{ title: 'Insights', href: '/insights', icon: BarChart3 }`

**Dependency:** Requires Inngest setup for background job.

---

## Inngest Setup (Required for P2)

**Installation:**
```bash
pnpm add inngest
```

**Files to Create:**
```
/app/api/inngest/route.ts     → Inngest endpoint
/lib/inngest/client.ts        → Inngest client
/lib/inngest/functions.ts     → All functions
```

**Environment Variables:**
```
INNGEST_SIGNING_KEY=
INNGEST_EVENT_KEY=
```

---

## Sidebar Navigation Updates

**File:** `/apps/web/components/layout/app-sidebar.tsx`

```typescript
// Add to mainNavItems after existing items:
{ title: 'Headlines', href: '/headlines', icon: Megaphone },

// Add to secondaryNavItems:
{ title: 'Accountability Chart', href: '/accountability-chart', icon: GitBranch },
{ title: 'Process', href: '/process', icon: Workflow },
{ title: 'Insights', href: '/insights', icon: BarChart3 },
```

**New Icon Imports:**
```typescript
import { Megaphone, GitBranch, Workflow } from 'lucide-react';
```

---

## Migration Files Summary

| # | File | Feature |
|---|------|---------|
| 016 | `016_seats.sql` | Accountability Chart |
| 017 | `017_todos_visibility.sql` | Private/Team To-Dos |
| 018 | `018_headlines.sql` | Headlines |
| 019 | `019_rock_milestones.sql` | Rock Milestones |
| 020 | `020_onboarding_progress.sql` | Getting Started Widget |
| 021 | `021_processes.sql` | Process Documentation |
| 022 | `022_insights.sql` | Insights Dashboard |

---

## New API Routes Summary

| Feature | Routes | Total |
|---------|--------|-------|
| Accountability Chart | 6 | 6 |
| Headlines | 4 | 10 |
| Rock Milestones | 5 | 15 |
| Getting Started | 3 | 18 |
| Process Documentation | 9 | 27 |
| Insights | 4 | 31 |

**Total New Endpoints:** 31

---

## New Components Summary

| Feature | Components |
|---------|------------|
| Accountability Chart | 4 |
| Headlines | 4 |
| Rock Milestones | 2 |
| Getting Started | 3 |
| Process Documentation | 4 |
| Insights | 4 |

**Total New Components:** 21

---

## New Pages Summary

| Route | Feature |
|-------|---------|
| `/accountability-chart` | Accountability Chart |
| `/headlines` | Headlines |
| `/process` | Process List |
| `/process/[id]` | Process Detail |
| `/insights` | Insights Dashboard |

**Total New Pages:** 5

---

## Shared Components to Create

| Component | Used By |
|-----------|---------|
| `<ProgressRing />` | Rock milestones, Getting Started, Insights |
| `<Checklist />` | Getting Started, Rock milestones |
| `<RichTextEditor />` | Process steps (consider Tiptap) |
| `<TrendChart />` | Insights dashboard |
| `<ReactionBar />` | Headlines |
| `<DraggableList />` | Process steps, Milestones |

---

## Work Estimates by Feature

| Feature | Complexity | Files | Est. Effort |
|---------|------------|-------|-------------|
| Accountability Chart | High | ~12 | 4-6 hours |
| Private/Team To-Dos | Low | ~4 | 1-2 hours |
| Headlines | Medium | ~10 | 3-4 hours |
| Rock Milestones | Medium | ~8 | 3-4 hours |
| Getting Started Widget | Medium | ~6 | 2-3 hours |
| Process Documentation | High | ~14 | 4-6 hours |
| Insights Dashboard | High | ~12 | 4-6 hours |

**Total Estimated Effort:** 21-31 hours (3-5 focused sessions)

---

## Execution Checklist

### Phase 1: Foundation (Day 1)
- [ ] Create migration 016_seats.sql
- [ ] Build Accountability Chart API routes
- [ ] Build Accountability Chart page + components
- [ ] Create migration 017_todos_visibility.sql
- [ ] Update todos API and page for visibility split

### Phase 2: Engagement (Day 2-3)
- [ ] Create migration 018_headlines.sql
- [ ] Build Headlines API routes
- [ ] Build Headlines page + components
- [ ] Create migration 019_rock_milestones.sql
- [ ] Build Milestones API routes
- [ ] Enhance RockDetailSheet with milestones
- [ ] Create migration 020_onboarding_progress.sql
- [ ] Build Getting Started widget

### Phase 3: Insights (Day 4-5)
- [ ] Create migration 021_processes.sql
- [ ] Build Process API routes
- [ ] Build Process pages + components
- [ ] Set up Inngest
- [ ] Create migration 022_insights.sql
- [ ] Build Insights API + background job
- [ ] Build Insights dashboard page

### Finalization
- [ ] Update sidebar navigation
- [ ] Update My 90 dashboard widgets
- [ ] Test all features end-to-end
- [ ] Update CLAUDE.md with final structure

---

## Ready to Start?

Run this command to begin:

```bash
cd /home/user/cadaince
git checkout -b feature/expansion-v1
```

Then follow the prompts in the spec document to implement each feature.
