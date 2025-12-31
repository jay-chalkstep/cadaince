# Cadence — Technical Specification
### For Claude Code Implementation

**Version:** 1.0  
**Last Updated:** December 2025  
**Repository:** https://github.com/jay-chalkstep/cadaince.git

---

## Overview

Cadence is a leadership alignment engine for Choice Digital's Senior Leadership Team (12 users). It replaces fragmented EOS tools, spreadsheets, and Slack threads with a unified system that synthesizes metrics, context, and updates into decision-ready intelligence.

**Core capabilities:**
- EOS system of record (Scorecard, Rocks, Issues, To-Dos)
- Video and text updates with transcription
- AI-generated morning briefings
- Real-time alerts (human and system-triggered)
- Private notes for sensitive escalation
- L10 meeting support

**Platforms:**
- Web application (Next.js)
- iOS application (Swift/SwiftUI)

---

## Tech Stack

| Concern | Service |
|---------|---------|
| Auth | Clerk |
| Database | Supabase (PostgreSQL) |
| Realtime | Supabase Realtime |
| File Storage | Supabase Storage |
| Video | Mux |
| Transcription | Deepgram |
| AI | Anthropic Claude |
| Background Jobs | Inngest |
| Web Hosting | Vercel |
| UI Components | shadcn/ui + Tailwind |
| Charts | Recharts |
| Icons | Lucide |

### Supabase Project Details

**Project Name:** Cadaince
**Project ID:** `nlvjiksutojrdgnqhytd`
**Region:** us-west-2
**Database Host:** `db.nlvjiksutojrdgnqhytd.supabase.co`

> Note: The Supabase project is named "Cadaince" — use this when accessing via Supabase dashboard or MCP tools.

---

## Project Structure

```
cadence/
├── apps/
│   ├── web/                    # Next.js web application
│   │   ├── app/
│   │   │   ├── (auth)/         # Auth routes (sign-in, sign-up)
│   │   │   ├── (dashboard)/    # Main app routes
│   │   │   │   ├── briefing/   # Morning briefing
│   │   │   │   ├── scorecard/  # EOS scorecard
│   │   │   │   ├── rocks/      # Rocks management
│   │   │   │   ├── issues/     # Issues list
│   │   │   │   ├── todos/      # To-dos
│   │   │   │   ├── updates/    # Update feed
│   │   │   │   ├── alerts/     # Alert history
│   │   │   │   ├── meetings/   # L10 support
│   │   │   │   ├── people/     # User/org management
│   │   │   │   └── settings/   # App settings
│   │   │   └── api/            # API routes
│   │   ├── components/
│   │   │   ├── ui/             # Base UI components (shadcn)
│   │   │   ├── scorecard/      # Scorecard-specific
│   │   │   ├── rocks/          # Rocks-specific
│   │   │   ├── updates/        # Update components
│   │   │   ├── briefing/       # Briefing components
│   │   │   └── meetings/       # L10 components
│   │   └── lib/
│   │       ├── supabase/       # Supabase client & queries
│   │       ├── clerk/          # Clerk utilities
│   │       ├── ai/             # Claude integration
│   │       └── integrations/   # HubSpot, BigQuery, etc.
│   │
│   └── ios/                    # Swift/SwiftUI app
│       ├── Cadence/
│       │   ├── App/
│       │   ├── Features/
│       │   │   ├── Briefing/
│       │   │   ├── Updates/
│       │   │   ├── Alerts/
│       │   │   └── Scorecard/
│       │   ├── Components/
│       │   ├── Services/
│       │   └── Models/
│       └── CadenceTests/
│
├── packages/
│   └── shared/                 # Shared types, constants
│
└── supabase/
    ├── migrations/             # Database migrations
    └── functions/              # Edge functions
```

---

## Database Schema

### Core Tables

```sql
-- Users managed by Clerk; this extends with app-specific data
create table profiles (
  id uuid primary key default gen_random_uuid(),
  clerk_id text unique not null,
  email text not null,
  full_name text not null,
  avatar_url text,
  role text not null,
  pillar_id uuid references pillars(id),
  access_level text not null default 'slt',  -- 'admin', 'elt', 'slt', 'consumer'
  is_elt boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table pillars (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  leader_id uuid references profiles(id),
  created_at timestamptz default now()
);

-- EOS Scorecard
create table metrics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  owner_id uuid references profiles(id) not null,
  goal numeric,
  unit text,                       -- '%', '$', 'count', etc.
  frequency text default 'weekly', -- 'daily', 'weekly', 'monthly'
  source text default 'manual',    -- 'manual', 'hubspot', 'bigquery'
  source_config jsonb,
  threshold_red numeric,
  threshold_yellow numeric,
  display_order int,
  created_at timestamptz default now()
);

create table metric_values (
  id uuid primary key default gen_random_uuid(),
  metric_id uuid references metrics(id) not null,
  value numeric not null,
  recorded_at timestamptz default now(),
  source text default 'manual',
  notes text
);

-- EOS Rocks
create table rocks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  owner_id uuid references profiles(id) not null,
  status text default 'on_track',  -- 'on_track', 'at_risk', 'off_track', 'complete'
  due_date date not null,
  quarter text,
  linked_metric_id uuid references metrics(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table rock_milestones (
  id uuid primary key default gen_random_uuid(),
  rock_id uuid references rocks(id) not null,
  title text not null,
  due_date date,
  completed_at timestamptz,
  display_order int
);

-- EOS Issues
create table issues (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  raised_by uuid references profiles(id) not null,
  source text default 'manual',    -- 'manual', 'alert', 'pattern', 'update'
  source_ref uuid,
  status text default 'detected',  -- 'detected', 'prioritized', 'decided', 'resolved'
  priority int,
  resolution text,
  learnings text,
  resolved_at timestamptz,
  created_at timestamptz default now()
);

-- EOS To-Dos
create table todos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  owner_id uuid references profiles(id) not null,
  due_date date not null,
  completed_at timestamptz,
  meeting_id uuid references meetings(id),
  created_at timestamptz default now()
);

-- Updates
create table updates (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references profiles(id) not null,
  type text default 'general',     -- 'general', 'rock', 'scorecard', 'incident'
  format text default 'text',      -- 'text', 'video'
  content text,
  video_url text,
  video_asset_id text,
  thumbnail_url text,
  transcript text,
  duration_seconds int,
  linked_rock_id uuid references rocks(id),
  linked_metric_id uuid references metrics(id),
  is_draft boolean default false,
  published_at timestamptz,
  created_at timestamptz default now()
);

-- Alerts
create table alerts (
  id uuid primary key default gen_random_uuid(),
  type text not null,              -- 'human', 'threshold', 'anomaly', 'missing_update'
  severity text default 'normal',  -- 'normal', 'urgent'
  title text not null,
  description text,
  triggered_by uuid references profiles(id),
  update_id uuid references updates(id),
  metric_id uuid references metrics(id),
  config jsonb,
  created_at timestamptz default now()
);

create table alert_acknowledgments (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid references alerts(id) not null,
  profile_id uuid references profiles(id) not null,
  acknowledged_at timestamptz default now(),
  unique(alert_id, profile_id)
);

-- Private Notes
create table private_notes (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references profiles(id) not null,
  recipient_id uuid references profiles(id) not null,
  content text not null,
  linked_update_id uuid references updates(id),
  linked_rock_id uuid references rocks(id),
  linked_metric_id uuid references metrics(id),
  status text default 'pending',   -- 'pending', 'acknowledged', 'discussed', 'escalated', 'resolved'
  resolution_note text,
  escalated_to_issue_id uuid references issues(id),
  created_at timestamptz default now(),
  resolved_at timestamptz
);

-- Meetings
create table meetings (
  id uuid primary key default gen_random_uuid(),
  type text default 'l10',
  scheduled_at timestamptz not null,
  started_at timestamptz,
  ended_at timestamptz,
  status text default 'scheduled', -- 'scheduled', 'in_progress', 'completed'
  rating numeric,
  notes text,
  ai_summary text,
  created_at timestamptz default now()
);

create table meeting_attendees (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references meetings(id) not null,
  profile_id uuid references profiles(id) not null,
  attended boolean default false,
  unique(meeting_id, profile_id)
);

-- Morning Briefings
create table briefings (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) not null,
  briefing_date date not null,
  content jsonb not null,
  generated_at timestamptz default now(),
  viewed_at timestamptz,
  unique(profile_id, briefing_date)
);

-- AI Learning
create table issue_patterns (
  id uuid primary key default gen_random_uuid(),
  pattern_type text not null,
  pattern_config jsonb not null,
  outcome text,
  recommended_action text,
  confidence numeric default 0.5,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### Row-Level Security

```sql
-- All SLT members can read everything
create policy "SLT read all profiles" on profiles for select using (true);
create policy "SLT read all metrics" on metrics for select using (true);
create policy "SLT read all metric_values" on metric_values for select using (true);
create policy "SLT read all rocks" on rocks for select using (true);
create policy "SLT read all rock_milestones" on rock_milestones for select using (true);
create policy "SLT read all issues" on issues for select using (true);
create policy "SLT read all todos" on todos for select using (true);
create policy "SLT read all updates" on updates for select using (true);
create policy "SLT read all alerts" on alerts for select using (true);
create policy "SLT read all meetings" on meetings for select using (true);
create policy "SLT read all briefings" on briefings for select using (
  profile_id = (select id from profiles where clerk_id = auth.jwt() ->> 'sub')
);

-- Admins can manage users
create policy "Admins manage profiles" on profiles for all using (
  (select access_level from profiles where clerk_id = auth.jwt() ->> 'sub') = 'admin'
);

-- Users can edit own updates
create policy "Own updates" on updates for update using (
  author_id = (select id from profiles where clerk_id = auth.jwt() ->> 'sub')
);

create policy "Own updates delete" on updates for delete using (
  author_id = (select id from profiles where clerk_id = auth.jwt() ->> 'sub')
);

-- Private notes: only author and recipient
create policy "Private note access" on private_notes for select using (
  author_id = (select id from profiles where clerk_id = auth.jwt() ->> 'sub')
  or recipient_id = (select id from profiles where clerk_id = auth.jwt() ->> 'sub')
);

create policy "Private note create" on private_notes for insert with check (
  author_id = (select id from profiles where clerk_id = auth.jwt() ->> 'sub')
);

create policy "Private note update" on private_notes for update using (
  recipient_id = (select id from profiles where clerk_id = auth.jwt() ->> 'sub')
);
```

### Seed Data

```sql
-- Pillars
insert into pillars (id, name) values
  ('p-exec', 'Executive'),
  ('p-growth', 'Growth'),
  ('p-customer', 'Customer'),
  ('p-product', 'Product'),
  ('p-ops', 'Operations'),
  ('p-finance', 'Finance'),
  ('p-people', 'People');

-- Profiles (clerk_id populated on first login via webhook)
-- This is the initial user setup; clerk_id will be set when users authenticate
insert into profiles (id, clerk_id, email, full_name, role, pillar_id, access_level, is_elt) values
  ('u-jay', '', 'jay@choicedigital.com', 'Jay', 'CEO', 'p-exec', 'admin', true),
  ('u-martae', '', 'martae@choicedigital.com', 'Martae', 'Chief of Staff', 'p-exec', 'admin', true),
  ('u-theresa', '', 'theresa@choicedigital.com', 'Theresa', 'Chief Growth Officer', 'p-growth', 'elt', true),
  ('u-judd', '', 'judd@choicedigital.com', 'Judd', 'Chief Customer Officer', 'p-customer', 'elt', true),
  ('u-chad', '', 'chad@choicedigital.com', 'Chad', 'COO', 'p-ops', 'elt', true),
  ('u-mike', '', 'mike@choicedigital.com', 'Mike', 'Chief Product Officer', 'p-product', 'elt', true),
  ('u-nanda', '', 'nanda@choicedigital.com', 'Nanda', 'Head of Engineering', 'p-product', 'slt', false),
  ('u-brooke', '', 'brooke@choicedigital.com', 'Brooke', 'Head of Product', 'p-product', 'slt', false),
  ('u-brian', '', 'brian@choicedigital.com', 'Brian', 'VP Operations', 'p-ops', 'slt', false),
  ('u-evan', '', 'evan@choicedigital.com', 'Evan', 'Head of People', 'p-people', 'slt', false),
  ('u-luke', '', 'luke@choicedigital.com', 'Luke', 'Controller', 'p-finance', 'slt', false),
  ('u-stefanie', '', 'stefanie@choicedigital.com', 'Stefanie', 'Executive Assistant', 'p-exec', 'consumer', false);

-- Update pillar leaders
update pillars set leader_id = 'u-jay' where id = 'p-exec';
update pillars set leader_id = 'u-theresa' where id = 'p-growth';
update pillars set leader_id = 'u-judd' where id = 'p-customer';
update pillars set leader_id = 'u-mike' where id = 'p-product';
update pillars set leader_id = 'u-chad' where id = 'p-ops';
update pillars set leader_id = 'u-luke' where id = 'p-finance';
update pillars set leader_id = 'u-evan' where id = 'p-people';
```

---

## API Routes

### Auth & Users
```
GET    /api/users                    # List all SLT members
GET    /api/users/me                 # Current user profile
PATCH  /api/users/:id                # Update user (admin only)
GET    /api/pillars                  # List pillars
POST   /api/webhooks/clerk           # Clerk webhook (user sync)
```

### Scorecard
```
GET    /api/metrics                  # All metrics with current values
GET    /api/metrics/:id              # Single metric with history
POST   /api/metrics                  # Create metric (admin)
PATCH  /api/metrics/:id              # Update metric
DELETE /api/metrics/:id              # Delete metric (admin)
POST   /api/metrics/:id/values       # Record manual value
GET    /api/metrics/:id/values       # Historical values
```

### Rocks
```
GET    /api/rocks                    # All rocks (query: quarter, owner_id, status)
GET    /api/rocks/:id                # Single rock with milestones
POST   /api/rocks                    # Create rock
PATCH  /api/rocks/:id                # Update rock
DELETE /api/rocks/:id                # Delete rock
POST   /api/rocks/:id/milestones     # Add milestone
PATCH  /api/rocks/:id/milestones/:mid # Update milestone
DELETE /api/rocks/:id/milestones/:mid # Delete milestone
```

### Issues
```
GET    /api/issues                   # All issues (query: status)
GET    /api/issues/:id               # Single issue
POST   /api/issues                   # Create issue
PATCH  /api/issues/:id               # Update issue
DELETE /api/issues/:id               # Delete issue
POST   /api/issues/:id/learn         # Record learnings
```

### To-Dos
```
GET    /api/todos                    # All todos (query: owner_id, completed, meeting_id)
POST   /api/todos                    # Create todo
PATCH  /api/todos/:id                # Update/complete todo
DELETE /api/todos/:id                # Delete todo
```

### Updates
```
GET    /api/updates                  # Update feed (query: author_id, type, rock_id, metric_id)
GET    /api/updates/:id              # Single update
POST   /api/updates                  # Create update
PATCH  /api/updates/:id              # Edit update
DELETE /api/updates/:id              # Delete update
POST   /api/updates/upload-url       # Get Mux direct upload URL
POST   /api/updates/:id/transcribe   # Trigger transcription (webhook from Mux)
```

### Alerts
```
GET    /api/alerts                   # All alerts (query: type, acknowledged)
GET    /api/alerts/:id               # Single alert
POST   /api/alerts                   # Create human alert
POST   /api/alerts/:id/acknowledge   # Acknowledge alert
POST   /api/alerts/:id/escalate      # Escalate to issue
```

### Private Notes
```
GET    /api/private-notes            # Notes where current user is recipient
GET    /api/private-notes/sent       # Notes sent by current user
POST   /api/private-notes            # Create note
PATCH  /api/private-notes/:id        # Update status
POST   /api/private-notes/:id/escalate # Convert to issue
```

### Briefings
```
GET    /api/briefings/today          # Today's briefing for current user
GET    /api/briefings/:date          # Briefing for specific date
POST   /api/briefings/generate       # Manually trigger generation (admin)
```

### Meetings
```
GET    /api/meetings                 # All meetings
GET    /api/meetings/:id             # Single meeting
POST   /api/meetings                 # Schedule meeting
PATCH  /api/meetings/:id             # Update meeting
GET    /api/meetings/:id/prep        # Pre-meeting synthesis
POST   /api/meetings/:id/todos       # Create todo from meeting
POST   /api/meetings/:id/complete    # Complete meeting with rating
```

### Integrations
```
POST   /api/integrations/hubspot/sync    # Manual sync
POST   /api/integrations/bigquery/sync   # Manual sync
GET    /api/integrations/status          # Integration health
POST   /api/webhooks/mux                 # Mux webhook (video ready)
POST   /api/webhooks/deepgram            # Deepgram webhook (transcript ready)
```

---

## UI Design System

### Colors (CSS Variables)
```css
:root {
  --background: 0 0% 100%;
  --foreground: 222 47% 11%;
  --card: 0 0% 100%;
  --card-foreground: 222 47% 11%;
  --popover: 0 0% 100%;
  --popover-foreground: 222 47% 11%;
  --primary: 222 47% 11%;
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 96%;
  --secondary-foreground: 222 47% 11%;
  --muted: 210 40% 96%;
  --muted-foreground: 215 16% 47%;
  --accent: 210 40% 96%;
  --accent-foreground: 222 47% 11%;
  --destructive: 0 84% 60%;
  --destructive-foreground: 210 40% 98%;
  --border: 214 32% 91%;
  --input: 214 32% 91%;
  --ring: 222 47% 11%;
  
  /* Status colors */
  --status-on-track: 142 76% 36%;
  --status-at-risk: 38 92% 50%;
  --status-off-track: 0 84% 60%;
  
  /* Briefing tags */
  --tag-decide: 0 84% 60%;
  --tag-watch: 38 92% 50%;
  --tag-inform: 217 91% 60%;
  --tag-delegate: 142 76% 36%;
}
```

### Typography
```
Font Family: Inter (sans-serif)
Font Weights: 400 (normal), 500 (medium), 600 (semibold)

h1: 24px / 32px, semibold
h2: 20px / 28px, semibold
h3: 18px / 24px, semibold
body: 14px / 20px, normal
small: 12px / 16px, normal
```

### Spacing
Base unit: 4px (Tailwind default)
Common values: 4, 8, 12, 16, 24, 32, 48, 64

### Border Radius
```
Buttons, inputs: 6px (rounded-md)
Cards: 8px (rounded-lg)
Avatars: 9999px (rounded-full)
```

### Shadows
```
sm: 0 1px 2px rgba(0,0,0,0.05)
md: 0 4px 6px rgba(0,0,0,0.07)
lg: 0 10px 15px rgba(0,0,0,0.1)
```

---

## Screen Layouts

### App Shell
```
┌─────────────────────────────────────────────────────────┐
│ Header (h-14)                                           │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Logo    Search (⌘K)              🔔  Avatar        │ │
│ └─────────────────────────────────────────────────────┘ │
├────────────┬────────────────────────────────────────────┤
│ Sidebar    │ Main Content                               │
│ (w-64)     │ (flex-1, p-6)                              │
│            │                                            │
│ Briefing   │                                            │
│ Scorecard  │                                            │
│ Rocks      │                                            │
│ Issues     │                                            │
│ To-Dos     │                                            │
│ Updates    │                                            │
│ ────────── │                                            │
│ Meetings   │                                            │
│ ────────── │                                            │
│ People     │                                            │
│ Settings   │                                            │
│            │                                            │
└────────────┴────────────────────────────────────────────┘
```

### Dashboard (Home)
```
┌─────────────────────────────────────────────────────────┐
│ Good morning, Jay                     Wed, Dec 17, 2025 │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 📋 Today's Briefing                    [View All →] │ │
│ │                                                     │ │
│ │ 🔴 DECIDE: Pipeline coverage at 2.1x               │ │
│ │ 🟡 WATCH: Support tickets up 23%                   │ │
│ │ 🔵 INFORM: Payment API v2 complete                 │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌────────────────────────┐ ┌──────────────────────────┐ │
│ │ Scorecard              │ │ Rocks                    │ │
│ │                        │ │                          │ │
│ │ 🟢 Pipeline    3.2x    │ │ 🟢 On Track      5       │ │
│ │ 🔴 CSAT        4.1     │ │ 🟡 At Risk       2       │ │
│ │ 🟢 Disbursement $8.4M  │ │ 🔴 Off Track     1       │ │
│ │ 🟡 Budget Var  -7%     │ │                          │ │
│ │                        │ │                          │ │
│ │ [View Scorecard →]     │ │ [View Rocks →]           │ │
│ └────────────────────────┘ └──────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Recent Updates                         [View All →] │ │
│ │                                                     │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │ 🎥 Theresa · 2h ago · Pipeline Update          │ │ │
│ │ │ "Quick update on where we stand..."  [1:24]    │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │ 📝 Nanda · 5h ago · Rock: Payment API          │ │ │
│ │ │ "Shipped v2 to production this morning..."     │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Scorecard
```
┌─────────────────────────────────────────────────────────┐
│ Scorecard                            [This Week ▾] [+]  │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐ │
│ │                                                     │ │
│ │ Metric            Owner      Goal    Actual  Trend │ │
│ │ ───────────────────────────────────────────────── │ │
│ │ 🟢 Pipeline       Theresa    3x      3.2x     ↑   │ │
│ │ 🔴 CSAT           Judd       4.5     4.1      ↓   │ │
│ │ 🟢 Disbursement   Chad       $8M     $8.4M    →   │ │
│ │ 🟡 Budget Var     Luke       ±5%     -7%      ↓   │ │
│ │ 🟢 Support Vol    Judd       <50     42       →   │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Click any row to view details and context              │
└─────────────────────────────────────────────────────────┘
```

### Metric Detail (Slide-over)
```
┌─────────────────────────────────────────────────────────┐
│ CSAT Score                               [Edit]    [X] │
├─────────────────────────────────────────────────────────┤
│ Owner: Judd · Source: HubSpot · Updated: 2h ago        │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │                    [Line Chart]                     │ │
│ │                  12-week trend                      │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Current: 4.1    Goal: 4.5    Status: 🔴 Off Track      │
│                                                         │
│ ─────────────────────────────────────────────────────── │
│ Context                                    [+ Add]     │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🎥 Judd · Dec 15                                    │ │
│ │ "CSAT took a hit after last week's outage. We're   │ │
│ │ seeing recovery but it'll take 2-3 weeks..."       │ │
│ │                                        [▶ 1:24]    │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 📝 Judd · Dec 10                                    │ │
│ │ "New support playbook rolling out this week..."    │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Rocks
```
┌─────────────────────────────────────────────────────────┐
│ Rocks                                   [Q1 2026 ▾] [+] │
├─────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐                 │
│ │ On Track │ │ At Risk  │ │Off Track │                 │
│ │    5     │ │    2     │ │    1     │                 │
│ └──────────┘ └──────────┘ └──────────┘                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🔴 Payment API v3 Migration                  Chad  │ │
│ │    Due: Mar 31 · 2/4 milestones                    │ │
│ │    "Blocked on vendor response..."    Dec 14      │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🟡 Enterprise Sales Process               Theresa  │ │
│ │    Due: Mar 31 · 3/5 milestones                    │ │
│ │    "Pipeline building slower than..."    Dec 16   │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🟢 Q1 Pipeline Target                     Theresa  │ │
│ │    Due: Mar 31 · 4/5 milestones                    │ │
│ │    "Ahead of pace, strong December"      Dec 16   │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Morning Briefing
```
┌─────────────────────────────────────────────────────────┐
│ ← Dashboard                      Tuesday, Dec 17, 2025  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Good morning, Jay.                                      │
│ Here's what needs your attention today.                 │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🔴 DECIDE                                           │ │
│ │                                                     │ │
│ │ Pipeline coverage dropped to 2.1x                   │ │
│ │ Target is 3x. Theresa posted context yesterday.    │ │
│ │ This may require Q1 target adjustment.             │ │
│ │                                                     │ │
│ │ [View Metric] [Watch Update ▶]                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🟡 WATCH                                            │ │
│ │                                                     │ │
│ │ Support ticket volume up 23% WoW                    │ │
│ │ Likely related to last week's outage. Judd hasn't │ │
│ │ posted an update yet.                              │ │
│ │                                                     │ │
│ │ [View Metric] [Request Update]                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🔵 INFORM                                           │ │
│ │                                                     │ │
│ │ Rock "Payment API v2" marked complete              │ │
│ │ Nanda shipped to production yesterday.             │ │
│ │                                                     │ │
│ │ [View Rock]                                        │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ─────────────────────────────────────────────────────── │
│ 📰 External                                             │
│                                                         │
│ • FTC announces new prepaid card disclosure rules      │
│ • Competitor X raises Series C ($45M)                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Create Update (Modal)
```
┌─────────────────────────────────────────────────────────┐
│ New Update                                          [X] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Type                                                    │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│ │ General  │ │   Rock   │ │Scorecard │ │  Alert   │   │
│ │    ●     │ │    ○     │ │    ○     │ │    ○     │   │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │                                                     │ │
│ │        [📹 Record Video]  or  [📝 Text]            │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Link to                                                 │
│ [Select Rock or Metric...                          ▾]  │
│                                                         │
│ ☐ Send as Alert (pushes notification)                  │
│                                                         │
│ ☐ Add private note to Martae                           │
│   ┌───────────────────────────────────────────────────┐ │
│   │ Private note content...                           │ │
│   └───────────────────────────────────────────────────┘ │
│                                                         │
│                          [Save Draft]    [Publish]     │
└─────────────────────────────────────────────────────────┘
```

### Private Notes (Martae View)
```
┌─────────────────────────────────────────────────────────┐
│ Private Notes                              3 pending    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ○ PENDING                                           │ │
│ │                                                     │ │
│ │ From Theresa · Dec 16 · Re: Pipeline metric        │ │
│ │                                                     │ │
│ │ "I'm showing this as on track publicly but I'm     │ │
│ │ actually concerned about Q1. The enterprise deals │ │
│ │ are moving slower than expected. Can we discuss?" │ │
│ │                                                     │ │
│ │ [Acknowledge] [Discussed] [Escalate]               │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ✓ ACKNOWLEDGED · Dec 15                            │ │
│ │                                                     │ │
│ │ From Mike · Dec 15 · Re: Outage update             │ │
│ │                                                     │ │
│ │ "FYI there's more to the outage story—vendor      │ │
│ │ issue that I don't want to blast publicly yet."   │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ✓ RESOLVED · Dec 14                                │ │
│ │                                                     │ │
│ │ From Chad · Dec 12 · General                       │ │
│ │                                                     │ │
│ │ "Heads up on a potential people issue forming..."  │ │
│ │                                                     │ │
│ │ Resolution: Discussed offline, monitoring          │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## iOS App Screens

### Tab Bar
```
┌─────────────────────────────────────────┐
│  Briefing  │  Updates  │  Alerts  │  Me │
└─────────────────────────────────────────┘
```

### Briefing Tab (Default)
- Today's briefing, scrollable
- Pull to refresh
- Tap item → deep link to web for details

### Updates Tab
- Feed of recent updates
- FAB: "+" to create update
- Tap update → expand with video player

### Video Capture Flow
1. Tap "+" FAB
2. Select type (General, Rock, Scorecard, Alert)
3. Camera opens
4. Optional: template overlay for structured updates
5. Record (max 3 min)
6. Preview → Retake or Use
7. Add title, select linked artifact
8. Optional: toggle "Send as Alert"
9. Optional: add private note
10. Upload (show progress)
11. Confirmation

### Alerts Tab
- List of alerts (newest first)
- Unacknowledged highlighted
- Tap → view detail, acknowledge

### Me Tab
- Profile info
- Notification settings
- Sign out

---

## Background Jobs (Inngest)

### Daily Briefing Generation
```typescript
// Runs at 5:00 AM Mountain Time
export const generateDailyBriefings = inngest.createFunction(
  { id: "generate-daily-briefings" },
  { cron: "0 5 * * *" },  // 5 AM daily
  async ({ step }) => {
    // 1. Get all active profiles
    // 2. For each profile, gather:
    //    - Metric changes (last 24h)
    //    - Updates posted (last 24h)
    //    - Alerts (last 24h)
    //    - Rock status changes
    //    - Calendar load (today)
    //    - Missing rhythm updates
    // 3. Call Claude to synthesize
    // 4. Tag items: Inform/Watch/Decide/Delegate
    // 5. Save to briefings table
    // 6. Send push notification: "Your briefing is ready"
  }
);
```

### Metric Sync (HubSpot)
```typescript
// Runs every 15 minutes
export const syncHubspotMetrics = inngest.createFunction(
  { id: "sync-hubspot-metrics" },
  { cron: "*/15 * * * *" },
  async ({ step }) => {
    // 1. Get metrics where source = 'hubspot'
    // 2. Fetch current values from HubSpot API
    // 3. Insert new metric_values
    // 4. Check thresholds, create alerts if needed
  }
);
```

### Metric Sync (BigQuery)
```typescript
// Runs hourly
export const syncBigqueryMetrics = inngest.createFunction(
  { id: "sync-bigquery-metrics" },
  { cron: "0 * * * *" },
  async ({ step }) => {
    // 1. Get metrics where source = 'bigquery'
    // 2. Execute configured queries
    // 3. Insert new metric_values
    // 4. Check thresholds, create alerts if needed
  }
);
```

### Rhythm Update Reminders
```typescript
// Runs Tuesday at 9 AM (for Wednesday L10)
export const sendUpdateReminders = inngest.createFunction(
  { id: "send-update-reminders" },
  { cron: "0 9 * * 2" },  // Tuesday 9 AM
  async ({ step }) => {
    // 1. Get all metric/rock owners
    // 2. Check who hasn't posted this week
    // 3. Send push notification reminders
  }
);
```

### Missing Update Alerts
```typescript
// Runs Tuesday at 5 PM
export const createMissingUpdateAlerts = inngest.createFunction(
  { id: "missing-update-alerts" },
  { cron: "0 17 * * 2" },  // Tuesday 5 PM
  async ({ step }) => {
    // 1. Check for missing rhythm updates
    // 2. Create system alerts for missing updates
  }
);
```

---

## Environment Variables

```bash
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
CLERK_WEBHOOK_SECRET=whsec_...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Mux
MUX_TOKEN_ID=...
MUX_TOKEN_SECRET=...
MUX_WEBHOOK_SECRET=...

# Deepgram
DEEPGRAM_API_KEY=...

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Inngest
INNGEST_EVENT_KEY=...
INNGEST_SIGNING_KEY=...

# Integrations
HUBSPOT_ACCESS_TOKEN=...
GOOGLE_CLOUD_PROJECT_ID=...
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json
```

---

## Git Workflow & Commit Conventions

### Repository
```
https://github.com/jay-chalkstep/cadaince.git
```

### Branch Strategy

```
main                 # Production-ready code
├── develop          # Integration branch for features
├── feature/*        # New features
├── fix/*            # Bug fixes
└── chore/*          # Maintenance, deps, config
```

**Branch naming:**
```
feature/scorecard-crud
feature/video-upload
feature/morning-briefing
fix/metric-threshold-alert
chore/update-dependencies
```

### Commit Convention

Use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
| Type | Use For |
|------|---------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, no code change |
| `refactor` | Code change that neither fixes nor adds |
| `perf` | Performance improvement |
| `test` | Adding or updating tests |
| `chore` | Maintenance, deps, build config |
| `ci` | CI/CD changes |

**Scopes** (optional, but helpful):
```
db, api, ui, auth, scorecard, rocks, issues, todos, 
updates, alerts, briefing, notes, meetings, ios, inngest
```

**Examples:**
```bash
# Feature commits
git commit -m "feat(db): add metrics and metric_values tables"
git commit -m "feat(api): implement metrics CRUD endpoints"
git commit -m "feat(ui): add scorecard table component"
git commit -m "feat(ui): add metric detail slide-over with chart"

# Fix commits
git commit -m "fix(api): handle null metric values in response"
git commit -m "fix(ui): correct status color for at-risk rocks"

# Chore commits
git commit -m "chore: initialize next.js project with tailwind"
git commit -m "chore(deps): add recharts and lucide-react"
git commit -m "chore(db): add seed data for Choice Digital team"

# Docs commits
git commit -m "docs: add README with setup instructions"
git commit -m "docs: update API route documentation"
```

### Commit Frequency

**Commit early, commit often.** Each commit should be:
- **Atomic:** One logical change per commit
- **Buildable:** Code should compile/run after each commit
- **Descriptive:** Message explains what and why

**Good commit rhythm:**
```bash
# Setting up a new feature
git commit -m "chore(db): add rocks table migration"
git commit -m "feat(api): add GET /api/rocks endpoint"
git commit -m "feat(api): add POST /api/rocks endpoint"
git commit -m "feat(api): add PATCH /api/rocks/:id endpoint"
git commit -m "feat(api): add DELETE /api/rocks/:id endpoint"
git commit -m "feat(ui): add rocks list page layout"
git commit -m "feat(ui): add rock card component"
git commit -m "feat(ui): add create rock modal"
git commit -m "feat(ui): wire up rocks page to API"
git commit -m "test(api): add rocks endpoint tests"
```

**Avoid:**
```bash
# Too big
git commit -m "add rocks feature"  # ❌ What specifically?

# Too vague
git commit -m "updates"  # ❌ What updates?
git commit -m "fix bug"  # ❌ What bug?

# Bundling unrelated changes
git commit -m "add rocks and fix scorecard and update deps"  # ❌ Split these
```

### Pull Request Flow

For significant features, use PRs even when working solo (creates documentation):

```bash
# Start feature
git checkout develop
git pull origin develop
git checkout -b feature/scorecard-crud

# Work and commit frequently
git commit -m "feat(db): add metrics table"
git commit -m "feat(api): add metrics endpoints"
# ... more commits

# Push and create PR
git push -u origin feature/scorecard-crud
# Create PR: feature/scorecard-crud → develop

# After review/testing, merge to develop
# Periodically merge develop → main for releases
```

### Recommended Git Aliases

Add to `~/.gitconfig`:
```ini
[alias]
  co = checkout
  br = branch
  ci = commit
  st = status
  lg = log --oneline --graph --decorate -20
  last = log -1 HEAD --stat
  unstage = reset HEAD --
  amend = commit --amend --no-edit
```

### CLAUDE.md

Create this file in repo root to guide Claude Code:

```markdown
# Cadence - Claude Code Guidelines

## Project Overview
Leadership alignment engine for Choice Digital. See `/docs/TECHNICAL_SPEC.md` for full specification.

## Tech Stack
- Next.js 14 (App Router)
- Tailwind CSS + shadcn/ui
- Supabase (Postgres + Auth + Storage)
- Clerk (Auth)
- Mux (Video)
- Deepgram (Transcription)
- Anthropic Claude (AI)
- Inngest (Background Jobs)

## Code Style
- Use TypeScript strict mode
- Prefer named exports
- Use async/await over .then()
- Components in PascalCase
- Utilities in camelCase
- Database queries in lib/supabase/

## Commit Convention
Use Conventional Commits: `type(scope): description`
Types: feat, fix, docs, style, refactor, perf, test, chore, ci
Scopes: db, api, ui, auth, scorecard, rocks, issues, todos, updates, alerts, briefing, notes, meetings, ios, inngest

Commit frequently - one logical change per commit.

## File Structure
- `/app/(dashboard)/` - Main app routes
- `/components/ui/` - shadcn base components
- `/components/{feature}/` - Feature-specific components
- `/lib/supabase/` - Database queries
- `/lib/ai/` - Claude integration

## Testing
- API routes: test with sample requests before moving on
- UI: verify in browser after each component
- Document any manual testing done in commit message if relevant

## When Stuck
- Check the technical spec in `/docs/TECHNICAL_SPEC.md`
- Follow the implementation sequence (Sprint 1 → 2 → 3...)
- Each sprint builds on the previous one
```

---

## Implementation Sequence

### Sprint 1: Foundation (Week 1-2)
- [ ] Initialize Next.js 14 project with App Router
- [ ] Configure Tailwind + shadcn/ui
- [ ] Set up Supabase project
- [ ] Run database migrations
- [ ] Integrate Clerk authentication
- [ ] Build app shell (sidebar, header, routing)
- [ ] Create Clerk webhook to sync users to profiles
- [ ] Seed database with Choice Digital users/pillars

### Sprint 2: EOS Core (Week 3-4)
- [ ] Metrics CRUD API routes
- [ ] Scorecard page with table view
- [ ] Metric detail slide-over with chart
- [ ] Manual metric value entry
- [ ] Rocks CRUD API routes
- [ ] Rocks page with status cards
- [ ] Rock detail page with milestones
- [ ] Issues CRUD API routes
- [ ] Issues list page
- [ ] To-Dos CRUD API routes
- [ ] To-Dos page

### Sprint 3: Updates (Week 5-6)
- [ ] Updates CRUD API routes
- [ ] Update feed page
- [ ] Text update composer
- [ ] Mux integration (direct upload)
- [ ] Video player component
- [ ] Deepgram integration (transcription webhook)
- [ ] Video update composer
- [ ] Link updates to rocks/metrics
- [ ] Display updates on metric/rock detail pages

### Sprint 4: Alerts & Private Notes (Week 7-8)
- [ ] Alerts CRUD API routes
- [ ] Create alert flow (from update composer)
- [ ] Alert acknowledgment
- [ ] Inngest setup
- [ ] Threshold alert job
- [ ] Missing update alert job
- [ ] Private notes CRUD API routes
- [ ] Private notes inbox (Martae)
- [ ] Private note composer (checkbox on updates)
- [ ] Escalation flow (note → issue)

### Sprint 5: iOS App (Week 7-10, parallel track)
- [ ] Xcode project setup
- [ ] Clerk iOS SDK integration
- [ ] API client layer
- [ ] Briefing tab (read-only)
- [ ] Updates tab + feed
- [ ] Video capture flow
- [ ] Mux direct upload from iOS
- [ ] Alerts tab
- [ ] Push notification setup (APNs)
- [ ] Profile tab

### Sprint 6: Intelligence (Week 9-12)
- [ ] Claude integration (API client)
- [ ] Briefing generation prompt engineering
- [ ] Daily briefing job (Inngest)
- [ ] Briefing page (web)
- [ ] Role-aware briefing content
- [ ] Inform/Watch/Decide/Delegate tagging
- [ ] Dashboard home page with briefing summary
- [ ] Pre-meeting synthesis
- [ ] Issue pattern learning (store outcomes)

---

## Acceptance Criteria

### Scorecard
- [ ] Admin can create/edit/delete metrics
- [ ] Metrics display current value, goal, trend indicator, status color
- [ ] Clicking metric opens detail slide-over
- [ ] Detail shows 12-week trend chart (Recharts)
- [ ] Manual values can be recorded with optional notes
- [ ] Linked updates appear on metric detail
- [ ] HubSpot metrics auto-sync every 15 minutes
- [ ] BigQuery metrics auto-sync hourly

### Rocks
- [ ] SLT can create rocks (self-assigned)
- [ ] Admin can assign rocks to anyone
- [ ] Status changes are logged with timestamp
- [ ] Milestones can be added, completed, reordered
- [ ] Rocks can link to scorecard metrics
- [ ] Past-due rocks show warning indicator
- [ ] Linked updates appear on rock detail

### Updates
- [ ] Text updates can be created and published
- [ ] Draft updates can be saved and edited
- [ ] Video uploads complete within 60 seconds
- [ ] Videos are transcribed within 5 minutes
- [ ] Transcript is searchable
- [ ] Updates can be linked to one rock or metric
- [ ] Feed is paginated (20 per page)
- [ ] Feed can be filtered by author, type, artifact

### Alerts
- [ ] Human alerts can be created from update composer
- [ ] Alerts push to iOS devices within 30 seconds
- [ ] Alerts appear in header notification area
- [ ] Unacknowledged alerts show badge count
- [ ] Clicking alert opens detail
- [ ] Alerts can be acknowledged
- [ ] Alerts can be escalated to Issues
- [ ] System alerts fire when metric crosses threshold
- [ ] System alerts fire for missing updates

### Private Notes
- [ ] Any SLT can attach private note when creating update
- [ ] Private notes can be standalone (not linked)
- [ ] Martae sees private notes inbox
- [ ] Jay sees private notes from Martae
- [ ] Notes show linked artifact context
- [ ] Notes can be acknowledged
- [ ] Notes can be marked "discussed"
- [ ] Notes can be escalated to Issue (requires author consent modal)
- [ ] Notes can be resolved with optional note
- [ ] Note history is preserved

### Morning Briefing
- [ ] Briefing generates at 5 AM Mountain
- [ ] Briefing contains items from last 24 hours
- [ ] Items are tagged Inform/Watch/Decide/Delegate
- [ ] Items link to source artifacts
- [ ] Briefing varies by role (Martae vs Jay vs functional)
- [ ] Briefing is viewable on web
- [ ] Briefing is viewable on iOS
- [ ] Push notification sent when briefing ready

### iOS App
- [ ] Sign in with Clerk works
- [ ] Briefing tab shows today's briefing
- [ ] Updates tab shows recent feed
- [ ] Video can be recorded (max 3 min)
- [ ] Video uploads with progress indicator
- [ ] Updates can be linked to artifacts
- [ ] Alerts tab shows all alerts
- [ ] Alerts can be acknowledged
- [ ] Push notifications work for alerts
- [ ] Push notifications work for briefing ready
