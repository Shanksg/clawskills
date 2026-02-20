# Skills Roadmap

## Objectives

This skill set enables end-to-end automation and integration across the most commonly used SaaS platforms in modern go-to-market and operations stacks. Concretely, it allows an agent or automation builder to:

- **Capture and route work** — convert external events (alerts, form submissions, emails) into tickets, tasks, or records in the right system.
- **Synchronize data** — keep CRM, project, and support systems consistent without manual re-entry.
- **Automate handoffs** — trigger downstream actions when records change status, owner, or stage.
- **Log activity** — append structured notes, calls, and comments for audit and reporting purposes.
- **Report and surface insights** — pull pipeline, queue, and project data into dashboards or summaries.

---

## Prioritization Framework

Each skill/recipe is scored on five dimensions (1–5 each):

| Dimension | Description |
|-----------|-------------|
| **Impact** | Business value if automated (revenue, hours saved, error reduction) |
| **Frequency** | How often the workflow runs daily/weekly |
| **Complexity** | Inverse score — simpler = higher priority for Phase 1 |
| **Risk** | Inverse score — lower risk of data loss/compliance issue = higher priority |
| **Dependencies** | Whether other workflows or skills depend on this one being stable first |

**Priority score = (Impact × 2) + (Frequency × 1.5) + Complexity + Risk + Dependencies**

Phases are ordered by descending average priority score within a theme.

---

## Phased Plan

### Phase 1 — Foundation: Auth + Core CRUD (Weeks 1–4)

**Theme:** Get the basics right. Every subsequent skill depends on reliable authentication and basic object manipulation.

**Deliverables:**
- All 8 `skill.md` files: Authentication & Permissions section fully validated against live environments
- Core CRUD recipes for each tool (Create, Read by ID, Update, List/Search)
- Error handling playbook (auth errors, 429s, 5xx retries)
- Shared retry/backoff library or pattern documented

**Cross-tool dependencies:**
- OAuth 2.0 / token management pattern established first (applies to Salesforce JWT, Dynamics Azure AD, HubSpot Private Apps, Jira API Token, Asana PAT/OAuth, Zendesk API Token, ServiceNow OAuth, Monday token)
- Secret storage convention agreed (env vars, vault reference) before any recipe is productionized

**Acceptance criteria:**
- [ ] Each tool: auth flow documented end-to-end with working curl example
- [ ] Each tool: create + read + update recipe tested against sandbox/dev environment
- [ ] 429 rate-limit retry returns success within 3 attempts for all tools
- [ ] No credentials stored in code or logs

**Definition of done:** A developer unfamiliar with any given tool can authenticate and perform a basic CRUD operation in under 30 minutes using only the skill doc.

---

### Phase 2 — High-Frequency Workflows (Weeks 5–10)

**Theme:** The top 5 daily workflows per tool, covering the scenarios that save the most manual effort.

**Deliverables:**
- Monday.com: Intake form → item creation, status sync, approval tracking
- Salesforce: Lead capture & dedup, opportunity stage update, activity logging (Task/Event)
- Jira: Ticket creation from external event, JQL search + triage, workflow transition with required fields
- Dynamics 365: Contact/Account upsert, opportunity pipeline update, activity logging
- HubSpot: Contact/Company sync, Deal stage update, Engagement logging (call/email/note)
- ServiceNow: Incident create from alert, state transition + work notes, assignment group routing
- Zendesk: Ticket creation, status/priority update, internal note vs public reply
- Asana: Task creation in project/section, status update, comment/story append

**Cross-tool dependencies:**
- Phase 1 auth foundation must be stable
- Dedup/idempotency patterns (Phase 1) applied to all create recipes

**Acceptance criteria:**
- [ ] Each recipe has a validated request/response example
- [ ] Pagination tested to >1 page of results
- [ ] Incremental sync (updated_since / cursor) demonstrated for at least one search per tool
- [ ] Dedup logic documented and tested (same input twice = no duplicate record)

**Definition of done:** Each recipe can be executed end-to-end by an automation builder without consulting external docs.

---

### Phase 3 — Event-Driven & Real-Time (Weeks 11–15)

**Theme:** Replace polling with push. Webhooks and event triggers for real-time automation.

**Deliverables:**
- Monday.com: Webhook setup, column-change events, item-status triggers
- Salesforce: Platform Events / Change Data Capture (CDC) basics; Outbound Messaging for simpler cases
- Jira: Webhook registration (UI + API), issue-updated event structure, filtering by project/type
- Dynamics 365: Webhooks via Plugin Registration Tool / Azure Service Bus; OData notifications
- HubSpot: Webhook subscriptions, event types (contact.creation, deal.propertyChange), signature verification
- ServiceNow: Outbound REST + Business Rules as webhook equivalent; Flow Designer basics
- Zendesk: Webhook + Trigger setup, event payload structure, signature validation (X-Zendesk-Webhook-Signature)
- Asana: Webhook registration, X-Hook-Secret handshake, event filtering

**Cross-tool dependencies:**
- Phase 2 update recipes required (webhooks trigger updates cross-system)
- Shared webhook receiver pattern: signature verification, deduplication by event ID, idempotent handler

**Acceptance criteria:**
- [ ] Each tool: webhook registered, test event fired, handler receives and validates payload
- [ ] Signature verification implemented and tested (reject tampered payload)
- [ ] Idempotent event handler: same event delivered twice = processed once
- [ ] Retry/dead-letter behavior documented per tool

**Definition of done:** End-to-end event flow demonstrated: source system change → webhook delivery → target system update, with no polling.

---

### Phase 4 — Bulk & Advanced Operations (Weeks 16–20)

**Theme:** Scale up. Handle large datasets, bulk operations, and complex cross-tool orchestration.

**Deliverables:**
- Salesforce: Bulk API v2 (CSV ingest), SOQL aggregate queries, Composite API for multi-step
- HubSpot: Batch create/update/read (up to 100 per batch), Import API for CSV
- Jira: Bulk label/component updates, sprint management, custom field batch updates
- ServiceNow: Import Sets with transform maps, batch table API calls
- Zendesk: Bulk ticket update (update_many), Incremental Export API for full sync
- Monday.com: Multiple mutations in single request, board duplication, subitems
- Dynamics 365: $batch endpoint, FetchXML for complex aggregations
- Asana: Parallel task creation patterns (respecting rate limits), Portfolio batch reads

**Cross-tool dependencies:**
- All Phase 2 & 3 recipes stable
- Rate limit / backoff patterns from Phase 1 must handle burst scenarios

**Acceptance criteria:**
- [ ] Bulk create tested with ≥500 records per supported tool
- [ ] Bulk job status polling recipe documented (for async APIs: Salesforce Bulk, ServiceNow Import Set)
- [ ] Memory/time complexity noted for large payloads
- [ ] Error partial-success handling documented (some rows fail, some succeed)

**Definition of done:** An integration can process a 10,000-row export from one system and upsert into another using bulk APIs, with error reporting per failed row.

---

### Phase 5 — Cross-Tool Orchestration & AI-Ready Patterns (Weeks 21–28)

**Theme:** Connect the systems. Build the integration recipes that span multiple tools, and prepare data flows for AI enrichment.

**Deliverables:**
- Cross-tool recipes (documented separately or as appendices in relevant skill.md files):
  - Salesforce Lead → HubSpot Contact sync
  - Zendesk Ticket → Jira Bug creation (bidirectional status)
  - ServiceNow Incident → Monday.com item (ops escalation board)
  - HubSpot Deal Won → Asana project creation (onboarding workflow)
  - Dynamics 365 Opportunity → Jira Epic (delivery handoff)
- Enrichment patterns: append AI-generated summaries to ticket/task descriptions
- Reporting aggregation: pull data from multiple tools into unified payload

**Cross-tool dependencies:**
- All Phase 1–4 skills stable
- Canonical data model (shared field mapping table) agreed across tools

**Acceptance criteria:**
- [ ] Each cross-tool recipe: end-to-end tested in staging environments
- [ ] Canonical IDs (external_id / reference fields) used to link records across systems
- [ ] No data loss on failure (dead-letter queue or retry log)
- [ ] Latency < 30s for real-time cross-tool sync

**Definition of done:** A single external event (e.g., new support ticket) can automatically create linked records in 2+ systems with correct field mapping, documented in a runbook.

---

## Deliverables by Tool

| Tool | Phase | Deliverable | Notes | Dependencies |
|------|-------|-------------|-------|--------------|
| All tools | 1 | Auth + Core CRUD skill sections | Sandbox environments required | None |
| Monday.com | 1 | Auth (token + OAuth), Board/Item CRUD | GraphQL API — different pattern from REST tools | None |
| Monday.com | 2 | Intake workflow, status sync, approval tracking | Column value JSON shapes per type | Phase 1 |
| Monday.com | 3 | Webhook setup + column-change events | Webhooks require HTTPS endpoint | Phase 1 |
| Monday.com | 4 | Multi-mutation requests, subitems | Complexity points budget management | Phase 2 |
| Salesforce | 1 | Connected App, OAuth JWT, REST CRUD | Sandbox org required | None |
| Salesforce | 2 | Lead capture, Opportunity update, Task logging | Validation rules awareness | Phase 1 |
| Salesforce | 3 | Platform Events / CDC / Outbound Messaging | Streaming API is separate product | Phase 2 |
| Salesforce | 4 | Bulk API v2, Composite API, SOQL aggregates | Bulk API best for >1000 rows | Phase 2 |
| Salesforce | 5 | Lead → HubSpot sync, Opp → Jira Epic | Canonical field mapping required | Phase 4 |
| Jira | 1 | API Token auth, Issue CRUD | Cloud vs Server distinction | None |
| Jira | 2 | JQL search, workflow transitions, triage | ADF for rich text comments | Phase 1 |
| Jira | 3 | Webhook registration + issue-updated events | Webhook URL must be publicly reachable | Phase 2 |
| Jira | 4 | Bulk label/component updates, sprint ops | No native bulk create — workarounds needed | Phase 2 |
| Jira | 5 | Zendesk Ticket → Jira Bug (bidirectional) | Status mapping table required | Phase 4 |
| Dynamics 365 | 1 | Azure AD app registration, Web API CRUD | Azure tenant required; security roles | None |
| Dynamics 365 | 2 | Account/Contact upsert, Opportunity update, Activity log | Solution prefix awareness | Phase 1 |
| Dynamics 365 | 3 | Plugin/webhook setup, OData change notifications | Plugin Registration Tool needed | Phase 2 |
| Dynamics 365 | 4 | $batch endpoint, FetchXML complex queries | FetchXML for anything OData can't express | Phase 2 |
| Dynamics 365 | 5 | Opportunity → Jira Epic handoff | Canonical ID linking | Phase 4 |
| HubSpot | 1 | Private App token, OAuth, CRM Object CRUD | Scopes per object type | None |
| HubSpot | 2 | Contact/Company sync, Deal updates, Engagement logging | Properties API for custom fields | Phase 1 |
| HubSpot | 3 | Webhook subscriptions + event handling | App registration required for webhooks | Phase 2 |
| HubSpot | 4 | Batch APIs, Import API for CSV | 100-record batch limit | Phase 2 |
| HubSpot | 5 | Salesforce Lead → HubSpot Contact sync | Dedup on email field | Phase 4 |
| ServiceNow | 1 | Basic auth + OAuth, Table API CRUD | Dev instance recommended | None |
| ServiceNow | 2 | Incident create/update, work notes, assignment | State values are integers — verify per instance | Phase 1 |
| ServiceNow | 3 | Outbound REST + Business Rule webhooks | Flow Designer alternative | Phase 2 |
| ServiceNow | 4 | Import Sets + transform maps, batch GETs | Transform map must be configured in UI | Phase 2 |
| ServiceNow | 5 | Incident → Monday.com escalation board | State-to-status mapping required | Phase 4 |
| Zendesk | 1 | API Token, OAuth, Ticket CRUD | Subdomain required for all calls | None |
| Zendesk | 2 | Ticket create/update, note vs reply, bulk update | Status machine strictly enforced | Phase 1 |
| Zendesk | 3 | Webhook + Trigger setup, signature verification | New webhook API vs deprecated HTTP targets | Phase 2 |
| Zendesk | 4 | Bulk update_many, Incremental Export API | Incremental API requires Enterprise or above | Phase 2 |
| Zendesk | 5 | Zendesk Ticket → Jira Bug (bidirectional) | Requires external_id / tag mapping | Phase 4 |
| Asana | 1 | PAT + OAuth, Task/Project CRUD | opt_fields required for all reads | None |
| Asana | 2 | Task creation in section, status update, story/comment | Memberships array for project placement | Phase 1 |
| Asana | 3 | Webhook registration + X-Hook-Secret handshake | Webhook events are coarse-grained | Phase 2 |
| Asana | 4 | Parallel task creation, Portfolio reads | No native bulk — rate limit math required | Phase 2 |
| Asana | 5 | HubSpot Deal Won → Asana project (onboarding) | Template project duplication | Phase 4 |

---

## Quality Bar & Governance

### Keeping docs accurate

- **Version pinning:** Each skill.md must note the API version it was validated against (e.g., Salesforce API v62.0, Jira REST API v3, Dynamics 365 v9.2). Update the version header when re-validating.
- **Quarterly review cycle:** Each skill.md has a `Last validated:` date in its header. Docs older than 90 days are flagged for re-review.
- **Changelog section:** Major API changes (new auth flows, deprecated endpoints, rate limit changes) are logged in a `## Changelog` section at the bottom of each skill.md.

### Validation approach

- **Automated smoke tests:** For each tool, maintain a minimal test script (curl or SDK) that hits auth, a read, and a write. Run weekly in CI against sandbox environments. Failure triggers a doc-review issue.
- **Breaking change monitoring:** Subscribe to each vendor's developer changelog / API release notes. Sources:
  - Monday: https://developer.monday.com/changelog
  - Salesforce: https://help.salesforce.com/s/articleView?id=release-notes.salesforce_release_notes.htm
  - Jira: https://developer.atlassian.com/cloud/jira/platform/changelog/
  - Dynamics 365: https://learn.microsoft.com/en-us/dynamics365/release-plans/
  - HubSpot: https://developers.hubspot.com/changelog
  - ServiceNow: https://developer.servicenow.com/dev.do (release notes per version)
  - Zendesk: https://developer.zendesk.com/api-reference/ticketing/introduction/#api-changelog
  - Asana: https://developers.asana.com/docs/changelog

### Handling deprecations

1. When a deprecation notice is detected, create a tracking issue with the sunset date.
2. Update the affected recipe with a `> ⚠️ DEPRECATED as of [date]: use [new approach] instead.` callout.
3. Re-test and update the recipe before the sunset date.
4. Remove the deprecated recipe/example once the endpoint is gone.

### Contribution process

- PRs to skill.md files require: (a) reference to official doc, (b) tested curl/pseudocode example, (c) updated `Last validated:` date.
- All changes reviewed by at least one person who has tested against the live API.

---

## Backlog (Nice-to-Have)

These items are out of scope for Phases 1–5 but worth tracking for future investment:

| Item | Tool(s) | Value | Complexity |
|------|---------|-------|------------|
| AI-powered ticket summarization (append GPT summary to description) | Zendesk, Jira, ServiceNow | High | Medium |
| Automated lead scoring sync | Salesforce, HubSpot | High | Medium |
| Revenue analytics aggregation (pull pipeline across CRMs) | Salesforce, HubSpot, Dynamics 365 | High | High |
| Admin automation: user provisioning / deprovisioning | All tools | Medium | Medium |
| Compliance export (GDPR data subject requests) | Zendesk, Salesforce, HubSpot | Medium | High |
| Monday → Asana project migration utility | Monday, Asana | Low | Medium |
| Jira custom field schema introspection | Jira | Medium | Low |
| Dynamics 365 Power Automate connector alternatives | Dynamics 365 | Medium | Low |
| ServiceNow CMDB auto-discovery integration | ServiceNow | High | High |
| Zendesk → Salesforce Case sync (bidirectional) | Zendesk, Salesforce | High | High |
| HubSpot Sequences → Outreach/Salesloft parity | HubSpot | Medium | Medium |
| Monday dashboards → BI tool (Looker/Tableau) export | Monday | Medium | Medium |
| Multi-workspace / multi-org management recipes | All tools | Medium | High |
| Token rotation automation (refresh before expiry) | All OAuth tools | High | Low |
| Audit log export to SIEM | Salesforce, Zendesk, ServiceNow | Medium | Medium |
