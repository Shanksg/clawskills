# Skills Index

A curated library of integration skill documents for the most common SaaS platforms used in go-to-market and operations workflows. Each skill doc teaches an agent or automation builder how to reliably use that platform's API for high-value, production-grade workflows.

→ See [ROADMAP.md](./ROADMAP.md) for the prioritized build plan, phased milestones, and governance model.

---

## Tools Covered

| Tool | Skill Doc | Primary Persona | Top Strength |
|------|-----------|-----------------|--------------|
| Monday.com | [monday/skill.md](./monday/skill.md) | Project Manager, RevOps | Visual project & intake tracking via GraphQL |
| Salesforce | [salesforce/skill.md](./salesforce/skill.md) | RevOps, Sales Engineer | CRM of record; lead/opportunity/activity management |
| Jira | [jira/skill.md](./jira/skill.md) | Project Manager, Support Ops | Issue tracking, workflow transitions, JQL search |
| Microsoft Dynamics 365 | [dynamics365/skill.md](./dynamics365/skill.md) | RevOps, Sales Engineer | Enterprise CRM with Azure AD auth and OData Web API |
| HubSpot | [hubspot/skill.md](./hubspot/skill.md) | RevOps, Marketing Ops | CRM + marketing automation with rich Associations API |
| ServiceNow | [servicenow/skill.md](./servicenow/skill.md) | Support Ops, IT Ops | ITSM platform; incident/change/CMDB management |
| Zendesk | [zendesk/skill.md](./zendesk/skill.md) | Support Ops | Customer support ticketing with rich webhook + export APIs |
| Asana | [asana/skill.md](./asana/skill.md) | Project Manager, RevOps | Task and project management with portfolio tracking |
| GitHub | [github/skill.md](./github/skill.md) | Engineering, DevOps | Source control, PRs, CI/CD automation via REST + GraphQL |
| Figma | [figma/skill.md](./figma/skill.md) | Design, Product, DevOps | Design file inspection, asset export, webhooks, design-to-dev handoff |
| Slack | [slack/skill.md](./slack/skill.md) | All teams | Real-time messaging, notifications, event-driven automation via Web API |
| Stripe | [stripe/skill.md](./stripe/skill.md) | Engineering, Finance, RevOps | Payments, subscriptions, refunds, webhooks, and Connect for platforms |
| Notion | [notion/skill.md](./notion/skill.md) | Product, Engineering, Ops | Docs, databases, and blocks API for knowledge base and project automation |

---

## Top Workflows per Tool

### Monday.com → [skill.md](./monday/skill.md)
1. Create a board item from an external form submission or webhook
2. Update item status column and notify assignee
3. Search items by column value (e.g., all "In Progress" items on a board)
4. Add an update (comment) to an item with @mentions
5. Set up a webhook trigger on column value change
6. Create subitems under a parent item
7. Fetch all items in a group with column values
8. Move an item to a different group (stage change)
9. Bulk-create items from a CSV/array via multiple mutations
10. Read board structure (groups, columns, column types)

---

### Salesforce → [skill.md](./salesforce/skill.md)
1. Create a Lead and check for duplicates before inserting
2. Convert a Lead to Contact + Account + Opportunity in one operation
3. Query Opportunities by stage and close date using SOQL
4. Update Opportunity stage + amount + close date
5. Log a Task (call/email activity) against a Contact or Opportunity
6. Create a Case and assign to a queue
7. Bulk upsert 10,000+ records via Bulk API v2
8. Query recently modified records (LastModifiedDate >= yesterday)
9. Upload a file (ContentVersion) and link to a record
10. Subscribe to real-time record changes via Change Data Capture

---

### Jira → [skill.md](./jira/skill.md)
1. Create an issue (Bug, Story, Task) in a specific project
2. Search issues using JQL with pagination
3. Transition an issue through workflow (e.g., "In Progress" → "Done")
4. Add a comment in Atlassian Document Format (ADF)
5. Attach a file to an issue
6. Assign/reassign an issue to a user
7. Register a webhook for issue-created/updated events
8. Fetch all issues updated in the last 24 hours (incremental sync)
9. Update custom fields on an issue
10. Get all available transitions for an issue's current status

---

### Microsoft Dynamics 365 → [skill.md](./dynamics365/skill.md)
1. Upsert a Contact (create or update by email) using PATCH + If-None-Match
2. Create an Opportunity linked to an Account
3. Update Opportunity `estimatedvalue` and `stepname` (stage)
4. Log a Phone Call activity against a Contact
5. Search Accounts with OData `$filter` and `$select`
6. Expand related records in one call using `$expand`
7. Use `$batch` to create multiple entities in one HTTP request
8. Query leads modified since a given timestamp (`modifiedon ge`)
9. Register a webhook via Plugin Registration Tool
10. Retrieve custom field values using publisher-prefixed names

---

### HubSpot → [skill.md](./hubspot/skill.md)
1. Create or update a Contact (upsert by email)
2. Create a Company and associate it with a Contact
3. Create a Deal and move it through pipeline stages
4. Log a Note, Call, or Email as an Engagement on a Contact/Deal
5. Search Contacts by property value (CRM Search API)
6. Batch read 100 Contacts by IDs in one call
7. Subscribe to a webhook for `contact.creation` or `deal.propertyChange`
8. Import a CSV of contacts via the Import API
9. Retrieve all custom properties for an object type
10. List all Deals associated with a Company via Associations API

---

### ServiceNow → [skill.md](./servicenow/skill.md)
1. Create an Incident from an external alert (Table API POST)
2. Update Incident state, priority, and assignment group
3. Add a work note (internal) vs a comment (customer-visible) to an Incident
4. Query Incidents using encoded query syntax (`sysparm_query`)
5. Fetch a CMDB Configuration Item by name or sys_id
6. Attach a file to a record (Attachment API)
7. Bulk-insert records via Import Set + Transform Map
8. Set up an Outbound REST message triggered by a Business Rule
9. Paginate through large result sets (sysparm_limit + sysparm_offset)
10. Look up a user (sys_user) by email for assignment

---

### Zendesk → [skill.md](./zendesk/skill.md)
1. Create a ticket with requester, subject, description, tags, and custom fields
2. Update ticket status, priority, and assignee
3. Add an internal note (private comment) to a ticket
4. Add a public reply to a ticket
5. Bulk update ticket status for a list of ticket IDs (update_many)
6. Incrementally export all tickets updated since a Unix timestamp
7. Search tickets using the Search API (`type:ticket status:open assignee:me`)
8. Upload an attachment and include it in a ticket comment
9. Register a webhook and attach it to a Trigger
10. Validate incoming webhook signature (X-Zendesk-Webhook-Signature-256)

---

### Asana → [skill.md](./asana/skill.md)
1. Create a task in a specific project and section
2. Create a subtask under a parent task
3. Update task assignee, due date, and custom fields
4. Add a comment (Story) to a task
5. Move a task to a different section (workflow stage update)
6. Search tasks in a workspace by keyword or custom field value
7. Register a webhook for task.created / task.changed events
8. Handle X-Hook-Secret handshake for webhook registration
9. List all tasks in a project with specific opt_fields (avoid N+1)
10. Mark a task complete and trigger downstream automation

---

### Figma → [skill.md](./figma/skill.md)
1. Read a file's full node tree (document, pages, frames, components)
2. Fetch specific nodes by ID (avoid downloading the full file)
3. Export nodes as PNG/SVG/PDF via the Images API
4. List and post comments on a file
5. List all published components in a team with pagination
6. Extract design tokens (styles + variables) from a file
7. List team projects and files
8. Register a webhook (FILE_VERSION_UPDATE, FILE_COMMENT, DEV_MODE_STATUS_UPDATE, etc.)
9. Get file version history and fetch a file at a specific version
10. Create dev resources (Storybook/GitHub links) attached to nodes for handoff

---

### GitHub → [skill.md](./github/skill.md)
1. Create a branch and open a pull request programmatically
2. Search issues and pull requests with the Search API
3. Update issue labels, assignees, and milestone
4. Post a comment on an issue or pull request
5. Create or update a file in a repository (base64 + SHA pattern)
6. Register a webhook and validate HMAC-SHA256 signatures
7. Trigger a workflow dispatch event and poll for the run result
8. Post a commit status or create a Check Run for CI integration
9. Create a release with auto-generated release notes
10. Rotate a repository secret using PyNaCl sealed-box encryption

---

### Slack → [skill.md](./slack/skill.md)
1. Post a rich Block Kit message to a channel
2. Reply in a thread using `thread_ts`
3. Send a direct message (open DM channel + postMessage)
4. Look up a user by email address
5. Update a message in place as status changes
6. Upload a file using the two-step external upload API
7. Add a reaction to a message
8. List all channels and build a name → ID cache
9. Read channel history incrementally using cursor pagination
10. Receive, verify, and process Events API payloads

---

### Notion → [skill.md](./notion/skill.md)
1. Create a database row (page with properties: title, select, date, people)
2. Query a database with AND/OR filters and sorts, paginating all results
3. Update page properties (select, date, checkbox, rich_text)
4. Archive (trash) a page
5. Create a page with rich content blocks (headings, callout, to-do, code)
6. Append blocks to an existing page in batches of 100
7. Read all blocks from a page recursively (handling has_children)
8. Search for pages and databases by title
9. Incremental sync — query pages modified since a given timestamp
10. Upsert pattern — create-or-update using an external ID property

---

### Stripe → [skill.md](./stripe/skill.md)
1. Create a PaymentIntent for a one-time charge and confirm with Stripe.js
2. Save a card for future off-session charges (SetupIntent → attach PaymentMethod)
3. Create a recurring subscription (Customer + Price + Subscription)
4. Launch a hosted Checkout Session and fulfil on `checkout.session.completed`
5. Issue a full or partial refund
6. Handle a failed subscription payment: notify customer, update payment method, retry invoice
7. Receive and verify webhooks (Stripe-Signature HMAC-SHA256 verification)
8. Stripe Connect: create a connected account, generate onboarding link, destination charge
9. List all charges for a customer with cursor pagination
10. Cancel a subscription at period end

---

## Common Cross-Tool Patterns

These scenarios span multiple skill docs — reference both tools:

| Scenario | Source | Destination | Notes |
|----------|--------|-------------|-------|
| Support ticket → engineering bug | Zendesk | Jira | Map Zendesk ticket ID as Jira external link |
| Sales deal won → onboarding project | HubSpot / Salesforce | Asana | Trigger on `dealstage = closedwon` |
| Alert fired → incident created | Any monitoring tool | ServiceNow / Jira | Use webhook receiver pattern |
| Marketing lead → CRM contact | HubSpot | Salesforce / Dynamics 365 | Dedup on email; map lifecycle stage |
| Delivery handoff → project board | Salesforce / Dynamics 365 | Monday.com / Jira | Trigger on Opportunity Closed Won |
| Incident escalation → ops board | ServiceNow | Monday.com | Priority P1/P2 → high-visibility board item |
| New customer → support org | Salesforce | Zendesk | Sync Account → Organization, Contact → User |
| Jira issue merged → PR linked | Jira | GitHub | Post commit status / Check Run on Jira transition |
| Bug report → GitHub issue + PR | Zendesk / ServiceNow | GitHub | Auto-create issue, label, assign; link ticket ID in body |
| Design ready → engineering task | Figma | Jira / Asana / GitHub | `DEV_MODE_STATUS_UPDATE` webhook → create/update issue with frame link |
| Asset pipeline | Figma | S3 / CDN | `FILE_VERSION_UPDATE` webhook → export frames as PNG, upload to storage |
| Payment succeeded → CRM deal closed | Stripe | Salesforce / HubSpot | `payment_intent.succeeded` webhook → update deal stage to Closed Won |
| Deal closed → Notion project page | Salesforce / HubSpot | Notion | Closed Won trigger → create onboarding project row in Notion database |
| GitHub release → Notion changelog | GitHub | Notion | `release` event → append block to changelog database page |
| Alert fired → Notion runbook page | PagerDuty / any webhook | Notion | Incident fires → create structured runbook page with checklist blocks |
| Subscription cancelled → support ticket | Stripe | Zendesk / Jira | `customer.subscription.deleted` → create ticket for churn review |
| Invoice paid → project provisioned | Stripe | Asana / Monday.com | `invoice.paid` webhook → create onboarding project or board item |

---

## Quick Reference: Auth Methods

| Tool | Primary Auth (Server-to-Server) | Token Type | Scopes Required |
|------|---------------------------------|------------|-----------------|
| Monday.com | API Token (Personal or OAuth2) | Bearer token | `boards:read`, `boards:write`, etc. |
| Salesforce | OAuth 2.0 JWT Bearer Flow | Access token (short-lived) | Defined per Connected App |
| Jira Cloud | API Token + Basic Auth | Base64(email:token) | N/A (token inherits user permissions) |
| Dynamics 365 | Azure AD Client Credentials | Bearer (Azure AD JWT) | `https://org.crm.dynamics.com/.default` |
| HubSpot | Private App Token | Bearer token | Per-object scopes selected at app creation |
| ServiceNow | OAuth 2.0 Client Credentials | Bearer token | Role-based (itil, admin, etc.) |
| Zendesk | API Token + Basic Auth | Base64(email/token:token) | Role-based (agent, admin) |
| Asana | Personal Access Token (PAT) | Bearer token | Inherits user permissions |
| GitHub | Fine-grained PAT or GitHub App installation token | Bearer token | Per-resource permissions (contents, issues, pull_requests, etc.) |
| Figma | Personal Access Token (PAT) or OAuth 2.0 | `X-Figma-Token` (PAT) / `Authorization: Bearer` (OAuth) | Granular scopes: `file_content:read`, `webhooks:write`, etc. |
| Slack | Bot token (OAuth 2.0 app install) | `xoxb-...` Bearer token | Per-method scopes: `chat:write`, `channels:read`, `users:read`, etc. |
| Stripe | Secret API key or Restricted key | `Authorization: Bearer sk_live_...` | Per-resource scopes on restricted keys (None / Read / Write) |
| Notion | Internal Integration Secret or OAuth token | `Authorization: Bearer secret_...` | Per-capability: Read/Insert/Update content, Read users |

---

## Quick Reference: Rate Limits

| Tool | Limit | Window | Backoff Header |
|------|-------|--------|----------------|
| Monday.com | 10M complexity pts/min (paid); 1M (free). Query cap: 5k/min (Enterprise), 2.5k/min (Pro), 1k/min (other). Daily: 200–25,000 calls. | Per minute + daily | `retry_in_seconds` in GraphQL error; HTTP 429 for IP limit |
| Salesforce | 1,000–5,000 API calls/licensed user/day (by edition) | 24 hours rolling | `Sforce-Limit-Info: api-usage=X/Y` |
| Jira Cloud | ~10 req/s per token (adaptive throttling) | Sliding | `Retry-After` on 429 |
| Dynamics 365 | 6,000 req / 5 min per user | 5 minutes | `Retry-After` on 429 |
| HubSpot | Free/Starter: 100/10s · Pro: **190/10s** · Enterprise: **190/10s** | 10 seconds + daily | `X-HubSpot-RateLimit-Remaining` / `Reset` |
| ServiceNow | ~3,000 req/hr default (Yokohama, configurable by admin) | 1 hour | `Retry-After` on 429 |
| Zendesk | Enterprise: 700/min · Professional: 400/min · Team/Essential: 200/min | 1 minute | `Retry-After` on 429 |
| Asana | 1,500 req/min + 150 concurrent | 1 minute | `Retry-After` on 429 |
| GitHub | PAT: 5,000/hr · GitHub App: 5k–12.5k/hr · Enterprise Cloud: 15,000/hr · Secondary: 900 pts/min, 80 create/min | 1 hour (primary) + sliding (secondary) | `x-ratelimit-remaining` / `x-ratelimit-reset`; 403 or 429 |
| Figma | Starter: 10/min (T1), 25/min (T2) · Professional: 15/min (T1), 50/min (T2) · Org: 20/min (T1), 100/min (T2) | Per minute (leaky bucket) | `Retry-After` / `X-Figma-Rate-Limit-Type` / `X-Figma-Plan-Tier` |
| Slack | Tier 1: 1/min · Tier 2: 20/min · Tier 3: 50/min · Tier 4: 100/min · `chat.postMessage`: 1/sec/channel sub-limit | Per method per workspace | HTTP 429 + `Retry-After` header (seconds) |
| Stripe | Live: **100 req/sec** · Sandbox: **25 req/sec** · Search: 20/sec | Per account | HTTP 429 + `Stripe-Rate-Limited-Reason` header |
| Notion | **3 req/sec average** (burst allowed) | Per workspace | HTTP 429 + `Retry-After` header (seconds) |

---

*Last updated: 2026-03-02 (Notion skill added) | See [ROADMAP.md](./ROADMAP.md) for versioning and governance details.*

### API version reference (as of 2026-02-22)

| Tool | Current version | Notes |
|------|----------------|-------|
| Monday.com | `2026-01` | RC: `2026-04`. Always pin `API-Version` header. |
| Salesforce | v66.0 (Spring '26) | Use `/services/data/v66.0/` |
| Jira Cloud | REST API v3 | `GET /search` deprecated → use `POST /search/jql` |
| Dynamics 365 | Web API v9.2 | Stable; no breaking changes v9.0→v9.2 |
| HubSpot | CRM API v3 (date-based `2025-09` in beta) | Burst raised to 190 req/10s (Pro/Enterprise) |
| ServiceNow | Yokohama (March 2025) | Previous: Xanadu |
| Zendesk | Support API v2 | Implicit/password OAuth deprecated Feb 2025 |
| Asana | REST API 1.0 | No breaking changes; always use `opt_fields` |
| GitHub | REST API + GraphQL v4 | Pin `X-GitHub-Api-Version: 2022-11-28`; fine-grained PATs recommended |
| Figma | REST API v1 / Webhooks V2 | Path-based versioning (`/v1/`, `/v2/`); `files:read` scope deprecated — use granular scopes |
| Slack | Web API (no versioned path) | Always check `ok` field (HTTP 200 even on errors); `files.upload` deprecated — use `files.getUploadURLExternal` |
| Stripe | `2026-02-25.clover` | Pin with `Stripe-Version` header; amounts in smallest currency unit (cents); never log raw card data |
| Notion | `2025-09-03` | `Notion-Version` header required on every request; share pages with integration before API access works |
