# Cadence Enhancement Plan
## Leadership Alignment Engine — Phase 2

**Version:** 1.0  
**Date:** December 2025  
**Status:** Planning

---

## 1. Current State

Cadence v1 delivers the core EOS operating rhythm:
- **Scorecard** — Manual KPI entry with goals and trends
- **Rocks** — Quarterly initiative tracking
- **Issues & To-Dos** — IDS workflow support
- **Updates** — Video/text with Mux hosting and Deepgram transcription
- **Morning Briefing** — AI-generated daily synthesis via Claude
- **Private Notes** — Confidential executive communication
- **Alerts** — Interrupt-driven notifications

**What's missing:** The system operates on manually-entered data and lacks the strategic foundation (V/TO) that gives EOS its coherence. The briefing synthesizes *activity* but can't yet synthesize *progress toward goals*.

---

## 2. Enhancement Vision

Transform Cadence from a **rhythm tool** into a **complete EOS operating system** by adding:

1. **Strategic Foundation** — V/TO as the anchor for all other modules
2. **Live Data Integration** — HubSpot and BigQuery replacing manual metric entry
3. **Team Architecture** — Roles, pillars, and accountability mapping
4. **Intelligent Signals** — AI that understands context, not just content

**Success State:** A new SLT member can open Cadence and understand Choice Digital's vision, their role in it, what's on/off track, and what needs their attention today—without asking anyone.

---

## 3. Feature Specifications

### 3.1 Vision/Traction Organizer (V/TO)

The V/TO is EOS's strategic backbone. Every other module references it.

**Components to capture:**

| Component | Description | Update Cadence |
|-----------|-------------|----------------|
| Core Values | 3-5 values that define culture | Rarely (years) |
| Core Focus | Purpose + Niche | Rarely |
| 10-Year Target | Big, audacious goal | Annual review |
| Marketing Strategy | Target market, 3 uniques, proven process, guarantee | Annual |
| 3-Year Picture | Revenue, profit, measurables, "what does it look like" | Annual |
| 1-Year Plan | Revenue, profit, goals for the year | Annual |
| Quarterly Rocks | Already exists in Cadence | Quarterly |
| Issues List | Already exists in Cadence | Ongoing |

**How it connects:**
- Rocks should explicitly link to 1-Year Plan goals
- Scorecard metrics should map to 3-Year Picture measurables
- AI briefing references V/TO for context ("We're 67% to our 1-Year revenue goal with 4 months remaining")
- New team member onboarding starts with V/TO

**UX approach:**
- `/vision` page with clean, readable V/TO display
- Edit mode for Admins only (Jay, Martae)
- Annual planning workflow prompt in Q4
- V/TO components surfaced contextually throughout app (hover states, briefing references)

---

### 3.2 Data Integration Layer

**Philosophy:** Metrics should flow automatically. Humans add *context*, not *numbers*.

#### HubSpot Integration (P0)

| Data Type | Use Case | Polling Frequency |
|-----------|----------|-------------------|
| Deal Pipeline | Pipeline coverage, weighted forecast | 15 min |
| CSAT/NPS Scores | Customer health metrics | 15 min |
| Support Tickets | Volume, resolution time, backlog | 15 min |
| Contact Activity | Engagement signals | Hourly |

**Configuration model:** Each Scorecard metric with `source_type: 'hubspot'` stores a `source_config` specifying the HubSpot property, object type, and any aggregation logic.

#### BigQuery Integration (P0)

| Data Type | Use Case | Polling Frequency |
|-----------|----------|-------------------|
| Disbursement Volume | Core business metric | 15 min |
| Transaction Success Rate | Operational health | 15 min |
| Client-level metrics | Per-client health scoring | Hourly |
| Revenue/margin data | Financial scorecard | Daily |

**Configuration model:** Each metric with `source_type: 'bigquery'` stores a SQL query template. Variables like `{{period_start}}` and `{{period_end}}` are injected at runtime.

#### Signal Processing

Raw data becomes useful through:

1. **Threshold alerts** — CSAT drops below 4.2 → auto-create Alert
2. **Anomaly detection** — Volume 25% below trailing 7-day average → flag in briefing
3. **Trend calculation** — Store trailing values, compute direction and velocity
4. **Composite scores** — Client health = f(volume trend, CSAT, ticket velocity, engagement)

---

### 3.3 Team & Pillar Architecture

**Current gap:** Clerk handles auth but knows nothing about EOS structure.

#### Organizational Model

```
Organization (Choice Digital)
├── Pillars (functional areas)
│   ├── Executive (Jay, Martae)
│   ├── Growth (Theresa)
│   ├── Customer (Judd)
│   ├── Product (Mike, Brooke, Nanda)
│   ├── Operations (Chad, Brian)
│   ├── Finance (Luke)
│   └── People (Evan)
└── Team Members
    ├── Role (admin / elt / slt / consumer)
    ├── Pillar assignment
    ├── Seat accountabilities
    └── Permissions
```

#### Role Permissions

| Permission | Admin | ELT | SLT | Consumer |
|------------|-------|-----|-----|----------|
| Edit V/TO | ✓ | — | — | — |
| Create/edit Rocks | ✓ | ✓ | Own | — |
| Edit Scorecard structure | ✓ | ✓ | — | — |
| Enter metric values | ✓ | ✓ | Own | — |
| Post Updates | ✓ | ✓ | ✓ | — |
| Create Alerts | ✓ | ✓ | ✓ | — |
| Send Private Notes | ✓ | ✓ | ✓ | — |
| View everything | ✓ | ✓ | ✓ | ✓ |
| Comment | ✓ | ✓ | ✓ | ✓ |
| Manage team | ✓ | — | — | — |

#### Invite Flow

1. Admin creates team member record (name, email, role, pillar)
2. System generates Clerk invitation
3. User accepts, creates Clerk account
4. On first login, Clerk webhook links `clerk_user_id` to team member record
5. User sees onboarding: V/TO overview → their pillar → their Rocks

---

### 3.4 Enhanced AI Briefing

**Current:** Synthesizes updates, alerts, and manually-entered metrics.

**Enhanced:** Adds strategic context and live data intelligence.

#### New Briefing Inputs

| Signal | Source | Example Output |
|--------|--------|----------------|
| V/TO context | Internal | "Q4 revenue goal: $2.1M. Current pace: $1.8M (86%)" |
| Live metrics | HubSpot/BQ | "Pipeline coverage dropped to 2.8x (target: 3.5x)" |
| Threshold breaches | Signal processor | "CSAT at 4.1 — below 4.2 threshold for 3 consecutive days" |
| Anomalies | Signal processor | "Disbursement volume 31% below 7-day average" |
| Rock deadlines | Internal | "2 Rocks due in 14 days, both showing 'At Risk'" |
| Missing updates | Internal | "No update from Operations pillar in 8 days" |

#### Role-Aware Synthesis

| Role | Briefing Focus |
|------|----------------|
| Jay (CEO) | Strategic posture, decisions needed, external context |
| Martae (CoS) | Triage view, routing recommendations, meeting prep |
| Pillar Leads | Domain depth + adjacent awareness |
| Stefanie (EA) | Calendar conflicts, logistics, follow-up tracking |

#### Action Tags

Every briefing item tagged:
- **Inform** — Awareness only
- **Watch** — Monitor, may need discussion
- **Decide** — Requires leadership judgment today
- **Delegate** — Route to owner

---

### 3.5 L10 Meeting Support

**Pre-meeting synthesis** (generated 2 hours before scheduled L10):
- Scorecard status with context for any red/yellow
- Rock check-in preview
- Issues ranked by AI for IDS prioritization
- Suggested headlines based on updates

**During-meeting capture** (Phase 2+):
- Quick issue creation
- To-do assignment with owner
- Decisions logged with context

**Post-meeting summary**:
- Auto-generated meeting notes
- To-dos with owners and due dates
- Issues created/resolved

---

## 4. Implementation Phases

### Phase 2A: Foundation (Week 1)
- [ ] V/TO data model and basic UI
- [ ] Team member schema extending Clerk
- [ ] Pillar structure
- [ ] Invite flow

### Phase 2B: Live Data (Week 2)
- [ ] HubSpot integration
- [ ] BigQuery integration  
- [ ] Metric source configuration UI
- [ ] Background sync jobs (Inngest)

### Phase 2C: Intelligence (Week 3)
- [ ] Threshold alerting
- [ ] Anomaly detection
- [ ] Enhanced briefing with V/TO context
- [ ] Role-aware briefing customization

### Phase 2D: Polish (Week 4)
- [ ] Onboarding flow for new users
- [ ] L10 pre-meeting synthesis
- [ ] Dashboard refinements
- [ ] Mobile experience optimization

---

## 5. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Manual metric entry | → 0 | All scorecard metrics auto-populated |
| Briefing usefulness | >4.5/5 | Weekly pulse from SLT |
| Meeting prep time | -50% | Self-reported |
| Time-to-context (new member) | <30 min | Onboarding observation |
| Update compliance | >90% | Weekly update completion rate |

---

## 6. Open Questions

1. **Historical data migration** — Do we backfill HubSpot/BigQuery data, or start fresh?
2. **Metric ownership** — Can a metric have multiple owners, or strictly one?
3. **Guest access** — Will board members or advisors ever need read access?
4. **Mobile priority** — Is native iOS still planned, or PWA sufficient for now?
5. **Slack integration** — Pull activity signals, or keep Cadence self-contained?
