# Cadence Feature Implementation: L10, Integrations & V/TO

This document details the implementation of three major features added to the Cadence application:

1. **Data Integrations Admin** - Admin UI for managing HubSpot/BigQuery connections
2. **L10 Meeting Module** - Full EOS Level 10 meeting workflow
3. **V/TO Settings** - Admin interface for managing the Vision/Traction Organizer

---

## Table of Contents

- [1. Data Integrations Admin](#1-data-integrations-admin)
  - [1.1 Database Schema](#11-database-schema)
  - [1.2 API Routes](#12-api-routes)
  - [1.3 UI Components](#13-ui-components)
  - [1.4 Pages](#14-pages)
- [2. L10 Meeting Module](#2-l10-meeting-module)
  - [2.1 Database Schema](#21-database-schema)
  - [2.2 API Routes](#22-api-routes)
  - [2.3 UI Components](#23-ui-components)
  - [2.4 Pages](#24-pages)
  - [2.5 Background Jobs](#25-background-jobs)
- [3. V/TO Settings](#3-vto-settings)
  - [3.1 UI Components](#31-ui-components)
  - [3.2 Pages](#32-pages)
- [4. Bug Fixes](#4-bug-fixes)
- [5. Navigation Updates](#5-navigation-updates)
- [6. File Reference](#6-file-reference)

---

## 1. Data Integrations Admin

### 1.1 Database Schema

**File:** `supabase/migrations/008_l10_meetings.sql`

Added `credentials_set` column to the existing `integrations` table:

```sql
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS credentials_set boolean DEFAULT false;
```

This tracks whether API credentials have been configured for each integration.

### 1.2 API Routes

#### Test Connection
**File:** `apps/web/app/api/integrations/[id]/test/route.ts`

- **POST** `/api/integrations/:id/test`
- Tests connectivity to HubSpot or BigQuery
- For HubSpot: Validates access token, retrieves available scopes
- For BigQuery: Validates service account key, tests project access
- Updates `credentials_set` and `last_error` fields
- Returns: `{ success: boolean, message: string, details?: object }`

#### Manual Sync
**File:** `apps/web/app/api/integrations/[id]/sync/route.ts`

- **POST** `/api/integrations/:id/sync`
- Triggers immediate data sync from external source
- Fetches metrics linked to the integration
- Pulls current values from HubSpot/BigQuery
- Creates metric_values records
- Updates `last_sync_at` timestamp

#### Sync Logs
**File:** `apps/web/app/api/integrations/logs/route.ts`

- **GET** `/api/integrations/logs?integration_id=xxx`
- Retrieves sync history for an integration
- Returns timestamp, status, records synced, errors

### 1.3 UI Components

#### Integration Card
**File:** `apps/web/components/integrations/integration-card.tsx`

Displays integration status in a card format:
- Integration name and type icon (HubSpot/BigQuery)
- Connection status indicator (connected/disconnected/error)
- Last sync timestamp
- Quick action buttons

#### Connection Status
**File:** `apps/web/components/integrations/connection-status.tsx`

Badge component showing real-time connection state:
- Green: Connected and active
- Yellow: Connected but disabled
- Red: Error or not configured
- Gray: Not configured

#### Sync Logs Table
**File:** `apps/web/components/integrations/sync-logs-table.tsx`

DataTable showing sync history:
- Timestamp
- Status (success/error)
- Records synced count
- Error message if failed
- Duration

#### HubSpot Config
**File:** `apps/web/components/integrations/hubspot-config.tsx`

Configuration form for HubSpot integration:
- Portal ID input
- Test connection button with scope display
- Enable/disable toggle
- Shows available HubSpot objects (Deals, Contacts, Tickets, Feedback)

#### BigQuery Config
**File:** `apps/web/components/integrations/bigquery-config.tsx`

Configuration form for BigQuery integration:
- Project ID input
- Default dataset input
- Service account key info (via env var)
- Test connection button
- Query variable documentation
- Example query template

#### Metric Source Dialog
**File:** `apps/web/components/integrations/metric-source-dialog.tsx`

Modal for configuring how a Scorecard metric gets its data:
- **Manual**: Default, values entered through UI
- **HubSpot**: Select object, property, aggregation (count/sum/avg/min/max)
- **BigQuery**: SQL query editor with variable support
- **Calculated**: Coming soon (derived from other metrics)
- Sync frequency selector (5min/15min/hourly/daily)

### 1.4 Pages

#### Integration List
**File:** `apps/web/app/(dashboard)/settings/integrations/page.tsx`

- **Route:** `/settings/integrations`
- Admin-only access (redirects non-admins)
- Grid of integration cards
- Shows all available integrations with status

#### Integration Detail
**File:** `apps/web/app/(dashboard)/settings/integrations/[type]/page.tsx`

- **Route:** `/settings/integrations/hubspot` or `/settings/integrations/bigquery`
- Full configuration interface
- Connection testing
- Sync logs table
- Manual sync trigger

---

## 2. L10 Meeting Module

### 2.1 Database Schema

**File:** `supabase/migrations/008_l10_meetings.sql`

#### l10_meetings
Main meeting record:
```sql
CREATE TABLE l10_meetings (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 90,
  status TEXT DEFAULT 'scheduled', -- scheduled, in_progress, completed, cancelled
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  current_section TEXT,
  section_started_at TIMESTAMPTZ,

  -- Snapshots captured at meeting start
  scorecard_snapshot JSONB,
  rocks_snapshot JSONB,
  todos_snapshot JSONB,
  issues_snapshot JSONB,

  -- Post-meeting
  meeting_rating NUMERIC(2,1),
  summary TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### l10_agenda_items
Meeting agenda structure:
```sql
CREATE TABLE l10_agenda_items (
  id UUID PRIMARY KEY,
  meeting_id UUID REFERENCES l10_meetings(id),
  section TEXT NOT NULL, -- segue, scorecard, rocks, headlines, todos, ids, conclude
  title TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  sort_order INTEGER NOT NULL,
  notes TEXT,
  completed_at TIMESTAMPTZ
);
```

#### l10_meeting_attendees
Meeting participants:
```sql
CREATE TABLE l10_meeting_attendees (
  id UUID PRIMARY KEY,
  meeting_id UUID REFERENCES l10_meetings(id),
  profile_id UUID REFERENCES profiles(id),
  rsvp_status TEXT DEFAULT 'pending', -- pending, accepted, declined
  attended BOOLEAN,
  UNIQUE(meeting_id, profile_id)
);
```

#### l10_issues_discussed
IDS (Identify, Discuss, Solve) tracking:
```sql
CREATE TABLE l10_issues_discussed (
  id UUID PRIMARY KEY,
  meeting_id UUID REFERENCES l10_meetings(id),
  issue_id UUID REFERENCES issues(id),
  outcome TEXT, -- solved, todo_created, moved_to_next, killed
  resolution_notes TEXT,
  time_spent_minutes INTEGER,
  discussed_at TIMESTAMPTZ DEFAULT now()
);
```

#### l10_todos_reviewed
To-do review tracking:
```sql
CREATE TABLE l10_todos_reviewed (
  id UUID PRIMARY KEY,
  meeting_id UUID REFERENCES l10_meetings(id),
  todo_id UUID REFERENCES todos(id),
  status_at_review TEXT, -- done, not_done, moved
  reviewed_at TIMESTAMPTZ DEFAULT now()
);
```

### 2.2 API Routes

#### CRUD Operations
**File:** `apps/web/app/api/l10/route.ts`

- **GET** `/api/l10` - List meetings with filters (status, date range)
- **POST** `/api/l10` - Create new meeting with attendees

**File:** `apps/web/app/api/l10/[id]/route.ts`

- **GET** `/api/l10/:id` - Get meeting details with agenda, attendees
- **PUT** `/api/l10/:id` - Update meeting (reschedule, change attendees)
- **DELETE** `/api/l10/:id` - Cancel/delete meeting

#### Meeting Lifecycle

**Start Meeting**
**File:** `apps/web/app/api/l10/[id]/start/route.ts`

- **POST** `/api/l10/:id/start`
- Sets status to `in_progress`
- Captures snapshots of current Scorecard, Rocks, To-Dos, Issues
- Sets `started_at` timestamp
- Initializes first agenda section

**End Meeting**
**File:** `apps/web/app/api/l10/[id]/end/route.ts`

- **POST** `/api/l10/:id/end`
- Body: `{ rating?: number }`
- Sets status to `completed`
- Sets `ended_at` timestamp
- Generates AI summary of meeting outcomes
- Stores meeting rating (1-10)

#### Agenda Management
**File:** `apps/web/app/api/l10/[id]/agenda/route.ts`

- **POST** `/api/l10/:id/agenda`
- Actions: `next`, `previous`, `jump`
- Updates `current_section` and `section_started_at`
- Marks previous section as completed

#### Headlines
**File:** `apps/web/app/api/l10/[id]/headlines/route.ts`

- **POST** `/api/l10/:id/headlines`
- Body: `{ headline: string }` or `{ id: string }` (to remove)
- Captures good news/wins shared during meeting

#### IDS Issues
**File:** `apps/web/app/api/l10/[id]/issues/route.ts`

- **POST** `/api/l10/:id/issues`
- Body: `{ issue_id, outcome, resolution_notes, time_spent_minutes }`
- Records IDS discussion outcomes
- Outcomes: `solved`, `todo_created`, `moved_to_next`, `killed`

#### To-Do Review
**File:** `apps/web/app/api/l10/[id]/todos/route.ts`

- **POST** `/api/l10/:id/todos`
- Body: `{ todo_id, status }`
- Status: `done`, `not_done`, `moved`
- Records weekly to-do review results

#### Auto-Generate Agenda
**File:** `apps/web/app/api/l10/generate-agenda/route.ts`

- **POST** `/api/l10/generate-agenda`
- Body: `{ meeting_id }`
- Creates standard L10 agenda structure:
  - Segue (5 min)
  - Scorecard Review (5 min)
  - Rock Review (5 min)
  - Customer/Employee Headlines (5 min)
  - To-Do List (5 min)
  - IDS (60 min)
  - Conclude (5 min)

### 2.3 UI Components

#### Meeting Card
**File:** `apps/web/components/l10/meeting-card.tsx`

Card displaying meeting summary:
- Title and scheduled time
- Status badge (scheduled/in_progress/completed)
- Attendee avatars
- Quick actions (join, edit, cancel)

#### Create Meeting Dialog
**File:** `apps/web/components/l10/create-meeting-dialog.tsx`

Modal form for scheduling new L10:
- Title input
- Date/time picker
- Duration selector (60/90/120 min)
- Attendee multi-select from team

#### Agenda Sidebar
**File:** `apps/web/components/l10/agenda-sidebar.tsx`

Left panel in live meeting mode:
- List of agenda sections
- Current section highlight
- Completion checkmarks
- Click to jump to section
- Time allocation per section

#### Meeting Timer
**File:** `apps/web/components/l10/meeting-timer.tsx`

Timer display component:
- Total meeting elapsed time
- Current section elapsed time
- Visual warning when over time
- Section time allocation bar

#### Meeting Controls
**File:** `apps/web/components/l10/meeting-controls.tsx`

Bottom control bar:
- Previous/Next section buttons
- End Meeting button with confirmation dialog
- Timer display

#### Scorecard Review
**File:** `apps/web/components/l10/scorecard-review.tsx`

Scorecard snapshot display:
- Metrics table from meeting start
- On-track/off-track indicators
- Comparison to goals

#### Rock Review
**File:** `apps/web/components/l10/rock-review.tsx`

Quarterly rocks status:
- Rock list with owners
- On-track/off-track/at-risk status
- Progress percentage

#### To-Do Review
**File:** `apps/web/components/l10/todo-review.tsx`

Weekly to-do checklist:
- To-dos from snapshot
- Done/Not Done toggle
- Owner display
- Completion tracking

#### Headline Capture
**File:** `apps/web/components/l10/headline-capture.tsx`

Good news collection:
- Input field for new headlines
- List of captured headlines
- Delete capability

#### IDS Workflow
**File:** `apps/web/components/l10/ids-workflow.tsx`

Three-step IDS facilitation:
1. **Identify**: Select issue from list, prioritize
2. **Discuss**: Timer, notes field
3. **Solve**: Outcome selection (solved/todo/move/kill), resolution notes

Visual state machine with transitions.

#### Meeting Rating
**File:** `apps/web/components/l10/meeting-rating.tsx`

Post-meeting rating:
- 1-10 scale input
- Optional feedback text
- Submit button

### 2.4 Pages

#### L10 List
**File:** `apps/web/app/(dashboard)/l10/page.tsx`

- **Route:** `/l10`
- Upcoming meetings list
- Past meetings history
- "Schedule L10" button
- Filter by status

#### Meeting Detail
**File:** `apps/web/app/(dashboard)/l10/[id]/page.tsx`

- **Route:** `/l10/:id`
- Meeting overview before start
- Attendee list with RSVP status
- Agenda preview
- Start Meeting button

#### Live Meeting Mode
**File:** `apps/web/app/(dashboard)/l10/[id]/live/page.tsx`

- **Route:** `/l10/:id/live`
- Three-panel layout:
  - Left: Agenda sidebar
  - Center: Current section content
  - Bottom: Meeting controls
- Real-time section switching
- Dynamic content based on current agenda item

### 2.5 Background Jobs

**File:** `apps/web/lib/l10/scheduler.ts`

Inngest function for auto-agenda generation:

```typescript
export const generateL10Agenda = inngest.createFunction(
  { id: "generate-l10-agenda" },
  { cron: "0 * * * *" }, // Every hour
  async ({ step }) => {
    // Find meetings starting in next 2 hours without agenda
    // Generate standard agenda for each
  }
);
```

---

## 3. V/TO Settings

### 3.1 UI Components

The V/TO settings page is a single comprehensive component with multiple sections.

### 3.2 Pages

#### V/TO Settings
**File:** `apps/web/app/(dashboard)/settings/vto/page.tsx`

- **Route:** `/settings/vto`
- Admin-only access
- Tabbed interface:

**Foundation Tab:**
- **Core Values Editor**
  - Add/remove values (3-7 recommended)
  - Value name + description fields
  - Drag handle for reordering (visual only)

- **Core Focus**
  - Purpose/Cause/Passion textarea
  - Niche textarea

- **10-Year Target**
  - BHAG description textarea
  - Target date picker

**Strategy Tab:**
- **Marketing Strategy**
  - Target market textarea
  - Three Uniques (numbered inputs 1-3)
  - Proven Process textarea
  - Guarantee textarea

**Plans Tab:**
- **3-Year Picture**
  - Revenue target input
  - Profit target input
  - Target date picker
  - Description textarea
  - Key measurables array editor (measurable + target)

- **1-Year Plan**
  - Revenue target input
  - Profit target input
  - Target date picker
  - Goals array editor (goal + measurable)

**History Tab:**
- Change audit trail
- Shows who changed what and when
- Section/change type badges

---

## 4. Bug Fixes

### Alert Dialog Component
**File:** `apps/web/components/ui/alert-dialog.tsx`

Created missing shadcn/ui AlertDialog component required by `meeting-controls.tsx`.

Installed dependency:
```bash
npm install @radix-ui/react-alert-dialog
```

### TypeScript Errors

**bigquery-config.tsx:**
Fixed `unknown` type not assignable to ReactNode:
```typescript
// Before
{testResult.details.service_account && (
  <div>Service Account: {testResult.details.service_account as string}</div>
)}

// After
{typeof testResult.details.service_account === "string" && (
  <div>Service Account: {testResult.details.service_account}</div>
)}
```

**hubspot-config.tsx:**
Fixed array type check:
```typescript
// Before
{testResult.details?.available_scopes && (

// After
{Array.isArray(testResult.details?.available_scopes) && (
```

**metric-source-dialog.tsx:**
Updated interface to accept flexible config type:
```typescript
// Before
source_config?: MetricSourceConfig | null;

// After
source_config?: Record<string, unknown> | null;
```

---

## 5. Navigation Updates

**File:** `apps/web/components/layout/app-sidebar.tsx`

Added navigation items:

```typescript
const mainNavItems = [
  // ...existing items...
  { title: "L10", href: "/l10", icon: Video },
];

const settingsNavItems = [
  { title: "Team", href: "/team", icon: Users },
  { title: "V/TO", href: "/settings/vto", icon: Settings2 },
  { title: "Integrations", href: "/settings/integrations", icon: Link2 },
  { title: "Settings", href: "/settings", icon: Settings },
];
```

**File:** `apps/web/app/(dashboard)/vision/page.tsx`

Added "Edit V/TO" button in header for admins linking to `/settings/vto`.

---

## 6. File Reference

### New Files Created

```
supabase/migrations/
└── 008_l10_meetings.sql

apps/web/app/api/
├── integrations/
│   ├── [id]/
│   │   ├── test/route.ts
│   │   └── sync/route.ts
│   └── logs/route.ts
└── l10/
    ├── route.ts
    ├── generate-agenda/route.ts
    └── [id]/
        ├── route.ts
        ├── start/route.ts
        ├── end/route.ts
        ├── agenda/route.ts
        ├── headlines/route.ts
        ├── issues/route.ts
        └── todos/route.ts

apps/web/app/(dashboard)/
├── l10/
│   ├── page.tsx
│   └── [id]/
│       ├── page.tsx
│       └── live/page.tsx
└── settings/
    ├── integrations/
    │   ├── page.tsx
    │   └── [type]/page.tsx
    └── vto/
        └── page.tsx

apps/web/components/
├── integrations/
│   ├── integration-card.tsx
│   ├── connection-status.tsx
│   ├── sync-logs-table.tsx
│   ├── hubspot-config.tsx
│   ├── bigquery-config.tsx
│   └── metric-source-dialog.tsx
├── l10/
│   ├── meeting-card.tsx
│   ├── create-meeting-dialog.tsx
│   ├── agenda-sidebar.tsx
│   ├── meeting-timer.tsx
│   ├── meeting-controls.tsx
│   ├── scorecard-review.tsx
│   ├── rock-review.tsx
│   ├── todo-review.tsx
│   ├── headline-capture.tsx
│   ├── ids-workflow.tsx
│   └── meeting-rating.tsx
└── ui/
    └── alert-dialog.tsx

apps/web/lib/
└── l10/
    └── scheduler.ts
```

### Modified Files

```
apps/web/components/layout/app-sidebar.tsx
apps/web/app/(dashboard)/vision/page.tsx
apps/web/components/scorecard/metric-detail-sheet.tsx
apps/web/package.json (added @radix-ui/react-alert-dialog)
```

---

## Git Commits

1. `2c22738` - feat(l10,integrations): add Data Integrations Admin and L10 Meeting Module
2. `491bd1b` - fix(ui): add alert-dialog component and fix TypeScript errors
3. `6eb16ff` - feat(ui): add V/TO settings page for admins

**Branch:** `claude/cadence-integrations-l10-module-rxQuo`
