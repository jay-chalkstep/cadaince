# Cadence Technical Build Plan 2
## Implementation Specification for Claude Code

**Version:** 1.0  
**Date:** December 2025  
**Codebase:** `apps/web/` (Next.js 14 App Router)

---

## 1. Current Architecture Summary

```
apps/web/
├── app/
│   ├── (dashboard)/          # Authenticated routes
│   │   ├── briefing/         # AI morning briefing
│   │   ├── scorecard/        # EOS metrics
│   │   ├── rocks/            # Quarterly goals
│   │   ├── issues/           # IDS tracking
│   │   ├── todos/            # 7-day commitments
│   │   ├── updates/          # Video/text updates
│   │   ├── alerts/           # Interrupts
│   │   ├── notes/            # Private notes
│   │   └── layout.tsx        # Dashboard shell
│   └── api/                  # REST endpoints
├── components/
│   └── layout/
│       └── app-sidebar.tsx   # Navigation
├── lib/
│   └── ai/
│       └── briefing.ts       # Claude integration
└── supabase/
    └── migrations/           # 3 existing SQL files
```

**Tech Stack:**
- Framework: Next.js 14 (App Router) + TypeScript
- Styling: Tailwind CSS + shadcn/ui
- Database: Supabase (PostgreSQL + Realtime)
- Auth: Clerk
- AI: Anthropic Claude
- Video: Mux + Deepgram
- Background Jobs: Inngest
- Charts: Recharts

---

## 2. Database Schema Additions

### 2.1 V/TO Tables

```sql
-- Migration: 004_vto.sql

-- Vision/Traction Organizer
CREATE TABLE vto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  
  -- Core Values (array of 3-5 values with descriptions)
  core_values JSONB DEFAULT '[]',
  -- Format: [{"value": "string", "description": "string"}]
  
  -- Core Focus
  purpose TEXT,
  niche TEXT,
  
  -- 10-Year Target
  ten_year_target TEXT,
  ten_year_target_date DATE,
  
  -- Marketing Strategy
  target_market TEXT,
  three_uniques JSONB DEFAULT '[]', -- ["unique1", "unique2", "unique3"]
  proven_process TEXT,
  guarantee TEXT,
  
  -- 3-Year Picture
  three_year_revenue DECIMAL(15,2),
  three_year_profit DECIMAL(15,2),
  three_year_measurables JSONB DEFAULT '[]',
  three_year_description TEXT,
  three_year_target_date DATE,
  
  -- 1-Year Plan
  one_year_revenue DECIMAL(15,2),
  one_year_profit DECIMAL(15,2),
  one_year_goals JSONB DEFAULT '[]',
  -- Format: [{"goal": "string", "measurable": "string", "owner_id": "uuid"}]
  one_year_target_date DATE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES team_members(id)
);

-- VTO change history for audit
CREATE TABLE vto_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vto_id UUID REFERENCES vto(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES team_members(id),
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  change_type TEXT, -- 'annual_planning', 'correction', 'update'
  previous_values JSONB,
  new_values JSONB
);

-- Enable RLS
ALTER TABLE vto ENABLE ROW LEVEL SECURITY;
ALTER TABLE vto_history ENABLE ROW LEVEL SECURITY;
```

### 2.2 Team & Pillar Tables

```sql
-- Migration: 005_team_pillars.sql

-- Pillars (functional areas)
CREATE TABLE pillars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT, -- For UI (hex code)
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default pillars
INSERT INTO pillars (name, slug, color, sort_order) VALUES
  ('Executive', 'executive', '#6366F1', 1),
  ('Growth', 'growth', '#10B981', 2),
  ('Customer', 'customer', '#F59E0B', 3),
  ('Product', 'product', '#3B82F6', 4),
  ('Operations', 'operations', '#8B5CF6', 5),
  ('Finance', 'finance', '#EC4899', 6),
  ('People', 'people', '#14B8A6', 7);

-- Team members (extends Clerk users)
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT UNIQUE, -- Populated after invite acceptance
  
  -- Profile
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  title TEXT,
  
  -- EOS Structure
  role TEXT NOT NULL CHECK (role IN ('admin', 'elt', 'slt', 'consumer')),
  pillar_id UUID REFERENCES pillars(id),
  is_pillar_lead BOOLEAN DEFAULT FALSE,
  
  -- Accountabilities (EOS seat concept)
  responsibilities TEXT[], -- Array of accountability statements
  
  -- Permissions (can override role defaults)
  permissions JSONB DEFAULT '{}',
  
  -- Settings
  receives_briefing BOOLEAN DEFAULT TRUE,
  briefing_time TIME DEFAULT '07:00',
  timezone TEXT DEFAULT 'America/Denver',
  
  -- Status
  status TEXT DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'inactive')),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_team_members_clerk ON team_members(clerk_user_id);
CREATE INDEX idx_team_members_pillar ON team_members(pillar_id);
CREATE INDEX idx_team_members_role ON team_members(role);

-- Enable RLS
ALTER TABLE pillars ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
```

### 2.3 Metric Source Configuration

```sql
-- Migration: 006_metric_sources.sql

-- Extend existing metrics table (or create if not exists)
ALTER TABLE metrics ADD COLUMN IF NOT EXISTS source_type TEXT 
  DEFAULT 'manual' 
  CHECK (source_type IN ('manual', 'hubspot', 'bigquery', 'calculated'));

ALTER TABLE metrics ADD COLUMN IF NOT EXISTS source_config JSONB DEFAULT '{}';
-- HubSpot format: {"object": "deals", "property": "amount", "aggregation": "sum", "filters": {...}}
-- BigQuery format: {"query": "SELECT ...", "value_column": "total", "dataset": "analytics"}
-- Calculated format: {"formula": "metric_a / metric_b", "dependencies": ["uuid1", "uuid2"]}

ALTER TABLE metrics ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ;
ALTER TABLE metrics ADD COLUMN IF NOT EXISTS sync_error TEXT;

-- Metric value history (for trend calculation)
CREATE TABLE metric_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_id UUID REFERENCES metrics(id) ON DELETE CASCADE,
  value DECIMAL(15,4) NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  source TEXT, -- 'manual', 'hubspot', 'bigquery', 'system'
  recorded_by UUID REFERENCES team_members(id), -- NULL for automated
  notes TEXT
);

CREATE INDEX idx_metric_values_metric ON metric_values(metric_id);
CREATE INDEX idx_metric_values_recorded ON metric_values(recorded_at DESC);

-- Metric thresholds for alerting
CREATE TABLE metric_thresholds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_id UUID REFERENCES metrics(id) ON DELETE CASCADE,
  threshold_type TEXT CHECK (threshold_type IN ('above', 'below', 'change_percent')),
  threshold_value DECIMAL(15,4) NOT NULL,
  severity TEXT DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  consecutive_periods INTEGER DEFAULT 1, -- Must breach N times before alert
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.4 Integration Credentials

```sql
-- Migration: 007_integrations.sql

-- Integration configurations (credentials stored in env, config here)
CREATE TABLE integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('hubspot', 'bigquery', 'slack', 'google_calendar')),
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  config JSONB DEFAULT '{}',
  -- HubSpot: {"portal_id": "...", "scopes": [...]}
  -- BigQuery: {"project_id": "...", "dataset": "..."}
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sync logs for debugging
CREATE TABLE sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID REFERENCES integrations(id),
  metric_id UUID REFERENCES metrics(id),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT CHECK (status IN ('running', 'success', 'error')),
  records_processed INTEGER,
  error_message TEXT,
  details JSONB
);
```

---

## 3. New Files to Create

### 3.1 Integration Layer

```
apps/web/lib/integrations/
├── index.ts              # Exports all integrations
├── types.ts              # Shared types
├── hubspot/
│   ├── client.ts         # HubSpot API client
│   ├── metrics.ts        # Metric fetching logic
│   └── types.ts          # HubSpot-specific types
├── bigquery/
│   ├── client.ts         # BigQuery client
│   ├── metrics.ts        # Query execution
│   └── types.ts          # BigQuery-specific types
└── sync/
    ├── scheduler.ts      # Inngest job definitions
    ├── processor.ts      # Sync orchestration
    └── anomaly.ts        # Anomaly detection logic
```

### 3.2 Team Management

```
apps/web/app/(dashboard)/team/
├── page.tsx              # Team list view
├── [id]/
│   └── page.tsx          # Team member detail
├── invite/
│   └── page.tsx          # Invite flow
└── pillars/
    └── page.tsx          # Pillar management

apps/web/lib/team/
├── permissions.ts        # Permission checking utilities
├── roles.ts              # Role definitions
└── invite.ts             # Clerk invite integration
```

### 3.3 V/TO Module

```
apps/web/app/(dashboard)/vision/
├── page.tsx              # V/TO display
├── edit/
│   └── page.tsx          # Edit mode (admin only)
└── components/
    ├── core-values.tsx
    ├── core-focus.tsx
    ├── ten-year-target.tsx
    ├── marketing-strategy.tsx
    ├── three-year-picture.tsx
    ├── one-year-plan.tsx
    └── vto-section.tsx   # Reusable section wrapper
```

### 3.4 Enhanced Briefing

```
apps/web/lib/ai/
├── briefing.ts           # Existing - enhance
├── context/
│   ├── vto.ts            # V/TO context builder
│   ├── metrics.ts        # Live metric context
│   ├── anomalies.ts      # Anomaly summaries
│   └── rocks.ts          # Rock status context
├── prompts/
│   ├── briefing.ts       # Main briefing prompt
│   └── role-specific.ts  # Role customization
└── types.ts              # AI-related types
```

---

## 4. API Routes

### 4.1 New Routes to Create

```
apps/web/app/api/
├── vto/
│   ├── route.ts          # GET (read), PUT (update)
│   └── history/
│       └── route.ts      # GET (audit trail)
├── team/
│   ├── route.ts          # GET (list), POST (create)
│   ├── [id]/
│   │   └── route.ts      # GET, PUT, DELETE
│   └── invite/
│       └── route.ts      # POST (send invite)
├── pillars/
│   ├── route.ts          # GET (list), POST (create)
│   └── [id]/
│       └── route.ts      # GET, PUT, DELETE
├── integrations/
│   ├── route.ts          # GET (list), POST (create)
│   ├── [id]/
│   │   └── route.ts      # GET, PUT, DELETE
│   └── test/
│       └── route.ts      # POST (test connection)
├── metrics/
│   ├── [id]/
│   │   ├── values/
│   │   │   └── route.ts  # GET (history)
│   │   └── sync/
│   │       └── route.ts  # POST (manual sync)
│   └── sources/
│       └── route.ts      # GET (available sources)
└── webhooks/
    └── clerk/
        └── route.ts      # POST (user events)
```

---

## 5. Integration Implementation

### 5.1 HubSpot Client

```typescript
// apps/web/lib/integrations/hubspot/client.ts

import { Client } from '@hubspot/api-client';

const hubspotClient = new Client({ 
  accessToken: process.env.HUBSPOT_ACCESS_TOKEN 
});

export async function fetchHubSpotMetric(config: HubSpotMetricConfig): Promise<number> {
  const { object, property, aggregation, filters } = config;
  
  switch (object) {
    case 'deals':
      return fetchDealMetric(property, aggregation, filters);
    case 'contacts':
      return fetchContactMetric(property, aggregation, filters);
    case 'tickets':
      return fetchTicketMetric(property, aggregation, filters);
    case 'feedback_submissions':
      return fetchFeedbackMetric(property, aggregation, filters);
    default:
      throw new Error(`Unsupported HubSpot object: ${object}`);
  }
}

async function fetchDealMetric(
  property: string, 
  aggregation: 'sum' | 'avg' | 'count',
  filters?: Record<string, any>
): Promise<number> {
  const searchRequest = {
    filterGroups: filters ? [{ filters: Object.entries(filters).map(([k, v]) => ({
      propertyName: k,
      operator: 'EQ',
      value: v
    }))}] : [],
    properties: [property],
    limit: 100
  };
  
  const response = await hubspotClient.crm.deals.searchApi.doSearch(searchRequest);
  
  const values = response.results
    .map(deal => parseFloat(deal.properties[property] || '0'))
    .filter(v => !isNaN(v));
  
  switch (aggregation) {
    case 'sum': return values.reduce((a, b) => a + b, 0);
    case 'avg': return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    case 'count': return response.total;
  }
}

// Similar implementations for contacts, tickets, feedback...
```

### 5.2 BigQuery Client

```typescript
// apps/web/lib/integrations/bigquery/client.ts

import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery({
  projectId: process.env.BIGQUERY_PROJECT_ID,
  credentials: JSON.parse(process.env.BIGQUERY_CREDENTIALS || '{}')
});

export async function fetchBigQueryMetric(config: BigQueryMetricConfig): Promise<number> {
  const { query, value_column, parameters } = config;
  
  // Inject date parameters
  const processedQuery = query
    .replace('{{period_start}}', parameters?.period_start || getDefaultPeriodStart())
    .replace('{{period_end}}', parameters?.period_end || getDefaultPeriodEnd());
  
  const [rows] = await bigquery.query({ query: processedQuery });
  
  if (!rows.length) return 0;
  
  const value = rows[0][value_column];
  return typeof value === 'number' ? value : parseFloat(value) || 0;
}

function getDefaultPeriodStart(): string {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString().split('T')[0];
}

function getDefaultPeriodEnd(): string {
  return new Date().toISOString().split('T')[0];
}
```

### 5.3 Inngest Sync Jobs

```typescript
// apps/web/lib/integrations/sync/scheduler.ts

import { inngest } from '@/lib/inngest';
import { syncMetric } from './processor';

// Scheduled metric sync - runs every 15 minutes
export const scheduledMetricSync = inngest.createFunction(
  { id: 'sync-external-metrics', name: 'Sync External Metrics' },
  { cron: '*/15 * * * *' },
  async ({ step }) => {
    // Get all metrics with external sources
    const metrics = await step.run('fetch-metrics', async () => {
      const { data } = await supabase
        .from('metrics')
        .select('*')
        .in('source_type', ['hubspot', 'bigquery'])
        .eq('is_active', true);
      return data || [];
    });
    
    // Sync each metric
    for (const metric of metrics) {
      await step.run(`sync-${metric.id}`, async () => {
        await syncMetric(metric);
      });
    }
    
    // Run anomaly detection
    await step.run('detect-anomalies', async () => {
      await detectAnomalies();
    });
    
    return { synced: metrics.length };
  }
);

// Manual sync trigger
export const manualMetricSync = inngest.createFunction(
  { id: 'manual-metric-sync', name: 'Manual Metric Sync' },
  { event: 'metric/sync.requested' },
  async ({ event, step }) => {
    const { metricId } = event.data;
    
    const metric = await step.run('fetch-metric', async () => {
      const { data } = await supabase
        .from('metrics')
        .select('*')
        .eq('id', metricId)
        .single();
      return data;
    });
    
    if (!metric) throw new Error('Metric not found');
    
    await step.run('sync', async () => {
      await syncMetric(metric);
    });
    
    return { success: true };
  }
);
```

### 5.4 Anomaly Detection

```typescript
// apps/web/lib/integrations/sync/anomaly.ts

interface AnomalyResult {
  metric_id: string;
  type: 'threshold' | 'deviation' | 'trend';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  current_value: number;
  expected_value?: number;
  deviation_percent?: number;
}

export async function detectAnomalies(): Promise<AnomalyResult[]> {
  const anomalies: AnomalyResult[] = [];
  
  // Get metrics with recent values
  const { data: metrics } = await supabase
    .from('metrics')
    .select(`
      *,
      metric_values(value, recorded_at),
      metric_thresholds(*)
    `)
    .eq('is_active', true)
    .order('recorded_at', { foreignTable: 'metric_values', ascending: false })
    .limit(30, { foreignTable: 'metric_values' });
  
  for (const metric of metrics || []) {
    const values = metric.metric_values || [];
    if (values.length < 2) continue;
    
    const current = values[0].value;
    const previous = values.slice(1, 8); // Last 7 values for comparison
    
    // Check thresholds
    for (const threshold of metric.metric_thresholds || []) {
      if (!threshold.is_active) continue;
      
      const breached = threshold.threshold_type === 'below' 
        ? current < threshold.threshold_value
        : current > threshold.threshold_value;
        
      if (breached) {
        anomalies.push({
          metric_id: metric.id,
          type: 'threshold',
          severity: threshold.severity,
          message: `${metric.name} is ${threshold.threshold_type} threshold (${current} vs ${threshold.threshold_value})`,
          current_value: current
        });
      }
    }
    
    // Check for statistical deviation (>2 std dev from mean)
    if (previous.length >= 5) {
      const mean = previous.reduce((a, b) => a + b.value, 0) / previous.length;
      const stdDev = Math.sqrt(
        previous.reduce((a, b) => a + Math.pow(b.value - mean, 2), 0) / previous.length
      );
      
      if (stdDev > 0) {
        const zScore = Math.abs((current - mean) / stdDev);
        if (zScore > 2) {
          const deviationPercent = ((current - mean) / mean) * 100;
          anomalies.push({
            metric_id: metric.id,
            type: 'deviation',
            severity: zScore > 3 ? 'critical' : 'warning',
            message: `${metric.name} deviated ${deviationPercent.toFixed(1)}% from recent average`,
            current_value: current,
            expected_value: mean,
            deviation_percent: deviationPercent
          });
        }
      }
    }
  }
  
  // Create alerts for critical anomalies
  for (const anomaly of anomalies.filter(a => a.severity === 'critical')) {
    await createSystemAlert(anomaly);
  }
  
  return anomalies;
}
```

---

## 6. Enhanced Briefing Context

```typescript
// apps/web/lib/ai/context/index.ts

export async function buildBriefingContext(userId: string): Promise<BriefingContext> {
  const [user, vto, metrics, rocks, updates, alerts, anomalies] = await Promise.all([
    getTeamMember(userId),
    getVTO(),
    getMetricsWithValues(),
    getActiveRocks(),
    getRecentUpdates(24), // Last 24 hours
    getRecentAlerts(24),
    getRecentAnomalies()
  ]);
  
  return {
    user: {
      name: user.full_name,
      role: user.role,
      pillar: user.pillar,
      is_pillar_lead: user.is_pillar_lead
    },
    strategic_context: buildStrategicContext(vto),
    metrics_summary: buildMetricsSummary(metrics, anomalies),
    rocks_status: buildRocksStatus(rocks),
    updates_digest: buildUpdatesDigest(updates),
    alerts_pending: alerts,
    role_focus: getRoleFocus(user.role)
  };
}

function buildStrategicContext(vto: VTO): string {
  const today = new Date();
  const yearEnd = new Date(vto.one_year_target_date);
  const daysRemaining = Math.ceil((yearEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  // Calculate progress toward 1-year revenue goal
  // This would need current revenue from metrics
  
  return `
Strategic Context:
- 10-Year Target: ${vto.ten_year_target}
- 3-Year Picture: $${vto.three_year_revenue?.toLocaleString()} revenue by ${vto.three_year_target_date}
- 1-Year Plan: $${vto.one_year_revenue?.toLocaleString()} revenue, ${daysRemaining} days remaining
- Core Focus: ${vto.purpose} | ${vto.niche}
  `.trim();
}
```

---

## 7. Implementation Sequence

Execute in this order to manage dependencies:

### Week 1: Foundation
1. **Day 1-2:** Run migrations 004-007
2. **Day 2-3:** Create team_members, pillars tables and API routes
3. **Day 3-4:** Build Clerk webhook handler for user activation
4. **Day 4-5:** Create `/team` pages with invite flow
5. **Day 5:** Create `/vision` page with V/TO display and edit

### Week 2: Integrations
1. **Day 1:** Set up HubSpot private app, add credentials
2. **Day 1-2:** Build `lib/integrations/hubspot/` client and metrics
3. **Day 2:** Set up BigQuery service account, add credentials  
4. **Day 2-3:** Build `lib/integrations/bigquery/` client
5. **Day 3-4:** Build Inngest sync jobs
6. **Day 4-5:** Add metric source configuration UI in Scorecard settings

### Week 3: Intelligence
1. **Day 1-2:** Build anomaly detection in `sync/anomaly.ts`
2. **Day 2-3:** Wire anomalies to auto-create Alerts
3. **Day 3-4:** Enhance briefing context builders
4. **Day 4-5:** Add role-aware briefing customization

### Week 4: Polish
1. **Day 1-2:** New user onboarding flow
2. **Day 2-3:** L10 pre-meeting synthesis
3. **Day 3-4:** Dashboard refinements
4. **Day 5:** Testing and bug fixes

---

## 8. Environment Variables to Add

```bash
# .env.local additions

# HubSpot
HUBSPOT_ACCESS_TOKEN=pat-na1-xxxxxxxx
HUBSPOT_PORTAL_ID=xxxxxxxx

# BigQuery
BIGQUERY_PROJECT_ID=choice-digital-analytics
BIGQUERY_CREDENTIALS={"type":"service_account",...}

# Inngest
INNGEST_EVENT_KEY=xxxxx
INNGEST_SIGNING_KEY=xxxxx
```

---

## 9. Testing Strategy

### Unit Tests
- Integration clients (mock API responses)
- Anomaly detection logic
- Permission checking utilities
- Briefing context builders

### Integration Tests
- Inngest job execution
- Clerk webhook handling
- Full sync flow with test data

### E2E Tests
- Invite → activate → first login flow
- Metric sync → anomaly → alert flow
- V/TO edit → briefing reflects change

---

## 10. Code Patterns to Follow

**Existing patterns in codebase to maintain:**
- Use `@/` path aliases
- Supabase client via `@/lib/supabase`
- Clerk auth via `@clerk/nextjs`
- API routes return `NextResponse.json()`
- Components use shadcn/ui primitives
- Forms use React Hook Form + Zod validation

**New patterns to establish:**
- Integration clients in `lib/integrations/{provider}/`
- Background jobs in `lib/integrations/sync/`
- AI context builders in `lib/ai/context/`
- All new tables have RLS enabled
- Migrations numbered sequentially (004, 005, etc.)
