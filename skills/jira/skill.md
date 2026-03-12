# Jira Skill

> **Last validated:** 2026-02-19 | **API:** Jira Cloud REST API v3
> **Base URL:** `https://{your-domain}.atlassian.net/rest/api/3/`
> **Assumed product:** Jira Cloud (Software or Service Management). Note differences from Jira Data Center where applicable.
>
> **⚠️ Breaking changes in 2026:**
> - `GET /rest/api/3/search` is **deprecated** — migrate to `POST /rest/api/3/search/jql` which uses `nextPageToken` pagination (see Recipe 2).
> - Field configuration scheme APIs will be **removed July 2026** — avoid building on `fieldconfigurationscheme` endpoints.
> - Atlassian Connect reaches **end of support December 2026** — migrate to Atlassian Forge for new apps.

---

## What this skill enables

- Create, triage, and route issues automatically from external events (alerts, support tickets, form submissions).
- Transition issues through workflow states programmatically, respecting required fields per transition.
- Search and filter issues using JQL (Jira Query Language) with full pagination and incremental sync.
- Log activity, decisions, and context as structured comments using Atlassian Document Format (ADF).
- Sync status bidirectionally between Jira and other tools (Zendesk, ServiceNow, Monday.com).
- Subscribe to real-time issue events via webhooks to drive downstream automation without polling.
- Manage labels, components, and sprints to keep project metadata current from external systems.

---

## Best-fit use cases

| Use case | Why it matters | Primary objects/entities | Typical trigger | Success criteria |
|----------|---------------|--------------------------|-----------------|------------------|
| Create bug from monitoring alert | Auto-triage production issues without manual work | Issue (Bug type) | Alert fired (PagerDuty, Datadog, etc.) | Issue created with severity label, component, and alert link |
| Triage unassigned issues | Ensure no issue sits unassigned for >1h | Issue | Scheduled job | Issues older than threshold have assignees set |
| Workflow transition on external event | Keep Jira status in sync with deployment or CRM event | Issue, Transition | Deploy pipeline success, deal closed | Issue moved to correct status with required fields |
| Sync Zendesk ticket → Jira bug | Bidirectional link between support and engineering | Issue | Zendesk ticket escalated | Jira bug created; Zendesk ticket ID stored in issue |
| Sprint management | Auto-add issues to active sprint | Issue, Sprint | Issue created with priority = Critical | Issue added to active sprint on the correct board |
| Component/label batch update | Keep categorization clean | Issue | Weekly cleanup job | All matching issues have labels/components corrected |
| Comment with runbook link | Provide context for assignees | Issue Comment | Issue assigned to on-call | Comment posted with runbook and dashboard links |
| Attachment — attach log file | Evidence trail for bugs | Issue Attachment | Bug created by automation | Log file attached; size <10MB |
| Webhook-driven issue routing | Assign issues to correct team without polling | Issue | Issue created event | Assignee and component set within 5s |
| Report issues updated today | Incremental sync for reporting tool | Issue | Scheduled daily pull | All issues modified in last 24h retrieved and processed |
| Epic→Story linking | Auto-create stories under the correct epic | Issue (Story), Epic | Epic created by planning tool | Stories created with `customfield_10014` (Epic Link) set |
| Failed deploy → incident ticket | Auto-create incident from CI/CD failure | Issue (Incident type) | Pipeline failure webhook | Incident created with pipeline URL and failure log |

---

## Key concepts & data model

### Core objects

| Object | Description | Identified by |
|--------|-------------|---------------|
| **Project** | Container for issues; has a key (e.g., `PROJ`) and a numeric ID | String `key` (e.g., `PROJ`) or integer `id` |
| **Issue** | The main work item (Story, Bug, Task, Epic, etc.) | String `key` (e.g., `PROJ-42`) or string `id` |
| **Issue Type** | Category of issue (Epic, Story, Task, Bug, Sub-task, etc.) | Integer `id`; string `name` |
| **Status** | Current workflow state (To Do, In Progress, Done) | Integer `id`; string `name` |
| **Transition** | Allowed move from one status to another | Integer `id`; string `name` |
| **Priority** | Urgency level (Highest, High, Medium, Low, Lowest) | String `name` or integer `id` |
| **Component** | Sub-area of a project (e.g., "API", "Frontend") | Integer `id`; string `name` |
| **Label** | Free-form tag on an issue | String |
| **Sprint** | Time-boxed iteration (Jira Software) | Integer `id`; stored in custom field `customfield_10020` |
| **Comment** | Activity entry on an issue | Integer `id` |
| **Attachment** | File linked to an issue | Integer `id` |
| **User** | Jira account | String `accountId` (not username) |

### Issue relationships

```
Project
  └── Issue (many)
        ├── Issue Type (Epic, Story, Bug, Task, Sub-task)
        ├── Status (from project workflow)
        ├── Priority
        ├── Assignee (User)
        ├── Reporter (User)
        ├── Components []
        ├── Labels []
        ├── Fix Versions []
        ├── Comment []
        ├── Attachment []
        ├── Sub-tasks [] (child issues)
        └── Epic Link (parent Epic, via customfield_10014 or "parent")
```

### Custom fields

Jira custom fields use IDs like `customfield_10014`. The mapping varies per Jira instance. Always introspect:

```bash
# List all fields with their IDs
GET /rest/api/3/field
```

Common custom field IDs (Jira Cloud defaults — verify for your instance):
- `customfield_10014`: Epic Link (on Story/Task)
- `customfield_10020`: Sprint
- `customfield_10016`: Story Points (may be `story_points` or `customfield_10028`)

### ADF (Atlassian Document Format)

All `description` and `comment` bodies use ADF JSON (not plain text or Markdown):

```json
{
  "type": "doc",
  "version": 1,
  "content": [
    {
      "type": "paragraph",
      "content": [
        { "type": "text", "text": "This is a bug reproduced at " },
        { "type": "text", "text": "https://example.com/error", "marks": [{ "type": "link", "attrs": { "href": "https://example.com/error" } }] }
      ]
    }
  ]
}
```

---

## Authentication & permissions

### Supported auth methods

| Method | Use case | Notes |
|--------|----------|-------|
| **API Token + Basic Auth** | Server-to-server integrations | Recommended for automation. Token acts as password. |
| **OAuth 2.0 (3LO)** | User-context apps | Required for acting on behalf of users. |
| **OAuth 2.0 (2LO / Client Credentials)** | App-level, no user context | Only for Forge apps currently. |

### API Token + Basic Auth (most common for automation)

1. Generate an API token: https://id.atlassian.com/manage-profile/security/api-tokens
2. Base64-encode `{email}:{api_token}`.

```bash
TOKEN=$(echo -n "user@example.com:your_api_token" | base64)

curl -s "https://yourdomain.atlassian.net/rest/api/3/myself" \
  -H "Authorization: Basic $TOKEN" \
  -H "Accept: application/json"
```

### OAuth 2.0 (3LO) scopes

| Scope | Purpose |
|-------|---------|
| `read:jira-work` | Read issues, projects, comments |
| `write:jira-work` | Create/update issues, comments |
| `manage:jira-project` | Manage project settings, components |
| `manage:jira-configuration` | Manage Jira configuration (webhooks, etc.) |
| `offline_access` | Obtain refresh tokens |

**Least privilege for automation:** `read:jira-work write:jira-work offline_access`

### Token storage

- API tokens do not expire but can be revoked. Rotate periodically or immediately after personnel changes.
- OAuth access tokens expire in ~1 hour. Use refresh tokens for long-running services.
- Store tokens in environment variables or secrets manager — never in code or logs.

### Multi-tenant

- Each Jira Cloud site has a unique subdomain (`yourdomain.atlassian.net`). OAuth `cloudId` identifies the specific site.
- For multi-site apps, store `cloudId` + tokens per site.

---

## Common workflows (recipes)

### Recipe 1: Create an issue

**Goal:** Create a Bug in a specific project with description, priority, and component.

```bash
BASE="https://yourdomain.atlassian.net"
AUTH="Basic $(echo -n 'user@example.com:api_token' | base64)"

curl -s -X POST "$BASE/rest/api/3/issue" \
  -H "Authorization: $AUTH" \
  -H "Content-Type: application/json" \
  -d '{
    "fields": {
      "project": { "key": "PROJ" },
      "summary": "NPE in UserService.getById() under high load",
      "issuetype": { "name": "Bug" },
      "priority": { "name": "High" },
      "description": {
        "type": "doc", "version": 1,
        "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Reproduced 3x in production. See attached log." }] }]
      },
      "components": [{ "name": "API" }],
      "labels": ["production", "critical"],
      "assignee": { "accountId": "5b10a2844c20165700ede21g" }
    }
  }'
# Response: {"id": "10023", "key": "PROJ-42", "self": "https://..."}
```

**Edge cases:**
- Issue type name must match exactly what exists in the project. Verify via `GET /rest/api/3/issuetype`.
- Component must already exist in the project. Creating a new component requires `POST /rest/api/3/component`.
- Required custom fields vary per project/issue type. If you get a 400 with "Field required", introspect via `GET /rest/api/3/issue/createmeta?projectKeys=PROJ&expand=projects.issuetypes.fields`.

---

### Recipe 2: Search issues with JQL and paginate

**Goal:** Find all open Bugs in PROJ modified in the last 24 hours.

> **⚠️ Deprecation notice:** `GET /rest/api/3/search` is deprecated. Use the new `POST /rest/api/3/search/jql` endpoint with `nextPageToken` cursor-based pagination. The old endpoint still works but will be removed — migrate now.

**New recommended approach (POST + nextPageToken):**

```bash
# Initial request — no nextPageToken on first call
curl -s -X POST "$BASE/rest/api/3/search/jql" \
  -H "Authorization: $AUTH" \
  -H "Content-Type: application/json" \
  -d '{
    "jql": "project = PROJ AND issuetype = Bug AND status != Done AND updated >= -1d ORDER BY updated DESC",
    "fields": ["id", "key", "summary", "status", "assignee", "priority", "updated"],
    "maxResults": 50
  }'
```

**Response (new format):**
```json
{
  "total": 312,
  "isLast": false,
  "nextPageToken": "eyJhbGciOiJIUzI1NiJ9...",
  "issues": [...]
}
```

**Pagination loop (Python) — new cursor approach:**
```python
import requests

all_issues = []
next_page_token = None

while True:
    body = {
        "jql": "project = PROJ AND status != Done ORDER BY updated ASC",
        "fields": ["id", "key", "summary", "status", "updated"],
        "maxResults": 50
    }
    if next_page_token:
        body["nextPageToken"] = next_page_token

    resp = requests.post(
        f"{BASE}/rest/api/3/search/jql",
        headers={"Authorization": AUTH, "Content-Type": "application/json"},
        json=body
    )
    data = resp.json()
    all_issues.extend(data.get("issues", []))

    if data.get("isLast", True) or not data.get("nextPageToken"):
        break
    next_page_token = data["nextPageToken"]
```

**Legacy approach (still works, deprecated):**
```bash
# Use only if you haven't migrated yet
curl -s -G "$BASE/rest/api/3/search" \
  --data-urlencode 'jql=project = PROJ AND issuetype = Bug AND status != Done' \
  --data-urlencode 'fields=id,key,summary,status,assignee,priority,updated' \
  --data-urlencode 'maxResults=50' \
  --data-urlencode 'startAt=0' \
  -H "Authorization: $AUTH"
# Response: {"total": 312, "startAt": 0, "maxResults": 50, "issues": [...]}
```

**JQL quick reference:**

```sql
-- Issues assigned to me
assignee = currentUser()

-- Updated in last N days
updated >= -7d

-- Specific status
status in ("In Progress", "In Review")

-- Priority
priority in (High, Highest)

-- Label
labels in ("production")

-- Epic children
"Epic Link" = PROJ-10

-- Sprint
sprint in openSprints()

-- Unassigned
assignee is EMPTY
```

---

### Recipe 3: Transition an issue to a new status

**Goal:** Move issue PROJ-42 from "In Progress" to "In Review".

**Step 1:** Get available transitions:
```bash
curl -s "$BASE/rest/api/3/issue/PROJ-42/transitions" \
  -H "Authorization: $AUTH"
# Response: {"transitions": [{"id": "21", "name": "Start Review", "to": {"name": "In Review"}}, ...]}
```

**Step 2:** Execute the transition:
```bash
curl -s -X POST "$BASE/rest/api/3/issue/PROJ-42/transitions" \
  -H "Authorization: $AUTH" \
  -H "Content-Type: application/json" \
  -d '{
    "transition": { "id": "21" },
    "update": {
      "comment": [{
        "add": {
          "body": {
            "type": "doc", "version": 1,
            "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Moving to review after fix deployed to staging." }] }]
          }
        }
      }]
    }
  }'
# 204 No Content on success
```

**Pitfall:** Transition IDs are project-specific and change if the workflow is edited. Never hardcode transition IDs — always fetch them dynamically. Cache them for a short period (minutes) if you need performance.

**Required fields on transition:** If a transition requires a resolution or other field, include it in the `fields` object of the transition request. If required fields are missing, Jira returns 400 with specific field errors.

---

### Recipe 4: Add a comment to an issue

**Goal:** Post a structured internal note with context.

```bash
curl -s -X POST "$BASE/rest/api/3/issue/PROJ-42/comment" \
  -H "Authorization: $AUTH" \
  -H "Content-Type: application/json" \
  -d '{
    "body": {
      "type": "doc",
      "version": 1,
      "content": [
        {
          "type": "paragraph",
          "content": [
            { "type": "text", "text": "Linked from Zendesk ticket " },
            { "type": "text", "text": "#ZD-7891", "marks": [{ "type": "strong" }] },
            { "type": "text", "text": ". Customer affected: Acme Corp. Priority escalated." }
          ]
        }
      ]
    },
    "visibility": {
      "type": "role",
      "value": "Service Desk Team"
    }
  }'
```

Omit `visibility` for public comments (visible to all project members).

---

### Recipe 5: Attach a file to an issue

```bash
curl -s -X POST "$BASE/rest/api/3/issue/PROJ-42/attachments" \
  -H "Authorization: $AUTH" \
  -H "X-Atlassian-Token: no-check" \
  -F "file=@/path/to/error.log"
# Response: [{"id": "10044", "filename": "error.log", "size": 4096, ...}]
```

> **Required:** `X-Atlassian-Token: no-check` header must be present. Omitting it returns 403.

File size limit: 10 MB by default on Jira Cloud. Check your instance limits.

---

### Recipe 6: Register a webhook for issue events

```bash
curl -s -X POST "$BASE/rest/webhooks/1.0/webhook" \
  -H "Authorization: $AUTH" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Integration Webhook",
    "url": "https://your-server.example.com/jira-webhook",
    "events": ["jira:issue_created", "jira:issue_updated", "jira:issue_deleted"],
    "filters": {
      "issue-related-events-section": "project = PROJ AND issuetype in (Bug, Incident)"
    },
    "excludeBody": false
  }'
```

**Available events:** `jira:issue_created`, `jira:issue_updated`, `jira:issue_deleted`, `comment_created`, `comment_updated`, `jira:worklog_updated`, `sprint_created`, `sprint_closed`.

**Webhook payload (issue_updated excerpt):**
```json
{
  "timestamp": 1708357200000,
  "webhookEvent": "jira:issue_updated",
  "user": { "accountId": "5b10a..." },
  "issue": { "id": "10023", "key": "PROJ-42", "fields": { "status": {...}, "summary": "..." } },
  "changelog": {
    "items": [
      { "field": "status", "fromString": "In Progress", "toString": "Done" }
    ]
  }
}
```

**Webhook security:** Jira Cloud webhooks do not send a signature by default. Use a secret token in the URL path or query string (e.g., `?secret=abc123`) and verify it in your handler.

---

### Recipe 7: Update an issue (labels, assignee, custom fields)

```bash
curl -s -X PUT "$BASE/rest/api/3/issue/PROJ-42" \
  -H "Authorization: $AUTH" \
  -H "Content-Type: application/json" \
  -d '{
    "fields": {
      "assignee": { "accountId": "5b10a2844c20165700ede21g" },
      "labels": ["production", "critical", "needs-hotfix"],
      "priority": { "name": "Highest" },
      "customfield_10014": "PROJ-10"
    }
  }'
# 204 No Content on success
```

**Array fields (labels, components):** PUT replaces the entire array. To append, first GET the current values, then PUT the merged array.

---

### Recipe 8: Get all transitions and validate workflow

```bash
# Useful for building a status-to-transition-ID map
curl -s "$BASE/rest/api/3/issue/PROJ-42/transitions?expand=transitions.fields" \
  -H "Authorization: $AUTH"
```

The `expand=transitions.fields` parameter returns the fields required for each transition — use this to avoid 400 errors when transitioning.

---

### Cross-tool recipe: Zendesk Ticket -> Jira Bug escalation

**Goal:** Create or update a Jira Bug when a Zendesk ticket meets escalation criteria.

**Escalation trigger examples:**
- Zendesk ticket priority becomes `urgent`
- Tag includes `engineering`
- Custom field indicates product defect

**Flow:**
1. Receive the Zendesk webhook or poll Incremental Export.
2. Build a deterministic external key, for example `zendesk:{ticket_id}`.
3. Search Jira for an existing issue with that external key in a custom field or label.
4. If found, update severity, assignee, and status. If not found, create a Bug with the Zendesk URL in the description.
5. Post the Jira issue key back to Zendesk as an internal note or custom field.

**Minimum field mapping:**

| Zendesk | Jira |
|---|---|
| `subject` | `summary` |
| `description` / latest public comment | `description` (ADF) |
| `priority` | `priority` |
| `ticket id` | custom external ID field |
| `tags` | `labels` |

**Status sync recommendation:**
- One-way sync into Jira is safer initially.
- Add reverse Jira -> Zendesk status updates only after you define an explicit state map and conflict rules.

## Query patterns & filtering

### JQL incremental sync

```sql
-- Changed in last sync window (store max updatedDate as next boundary)
updated >= "2026-02-18 14:00" ORDER BY updated ASC

-- Using UNIX timestamp (milliseconds not supported — use date string)
updated >= "2026-02-18"
```

### Pagination limits

- **New endpoint:** `POST /rest/api/3/search/jql` with `nextPageToken` cursor — preferred, no offset degradation.
- **Legacy endpoint:** `GET /rest/api/3/search` with `startAt`/`maxResults` — deprecated; max `maxResults` = 100 (default 50).
- For very large result sets (>10,000), cursor-based `nextPageToken` is more reliable than high `startAt` offsets.

### Handling duplicates

- Issue keys (e.g., `PROJ-42`) are globally unique within a project. Store the key in your external system as the canonical reference.
- Before creating, search: `summary ~ "your-dedup-key" AND project = PROJ` — if found, update instead of create.
- Use a dedicated text custom field (e.g., `External ID`) for reliable deduplication.

---

## Reliability: rate limits, retries, idempotency

### Rate limits (Jira Cloud)

Jira Cloud does not publish hard req/s limits. The platform uses adaptive throttling. Practical guidance:
- Stay under ~10 req/s per token for sustained operations.
- Burst up to ~50 req/s briefly without issues.
- 429 responses include a `Retry-After` header.

```python
import time
import requests

def jira_request(method, url, **kwargs):
    for attempt in range(5):
        resp = requests.request(method, url, **kwargs)
        if resp.status_code == 429:
            retry_after = int(resp.headers.get("Retry-After", 30))
            time.sleep(retry_after)
            continue
        resp.raise_for_status()
        return resp
    raise Exception("Max retries exceeded")
```

### Retry vs fail-fast

| Status | Action |
|--------|--------|
| 200/201/204 | Success |
| 400 Bad Request | Fail fast — fix payload |
| 401 Unauthorized | Refresh token and retry once |
| 403 Forbidden | Fail fast — fix permissions |
| 404 Not Found | Fail fast — check issue key/ID |
| 429 Too Many Requests | Retry after `Retry-After` seconds |
| 503 Service Unavailable | Retry with exponential backoff |

### Idempotency

- **Issue creation:** Use a custom External ID field. Query before creating — if found, update; if not, create.
- **Transitions:** Attempting a transition that's already in the target state returns a 400 — treat this as "already done" (idempotent success).
- **Comments:** No idempotency key. Include a machine-readable marker (e.g., `[automation-id: abc123]`) in the comment body; check for it before posting.

---

## Error handling & troubleshooting

### Common errors

| HTTP Status + Message | Meaning | Fix |
|----------------------|---------|-----|
| 400 `Field 'X' is required` | Required field missing on create/transition | Add the field; use `createmeta` to discover required fields |
| 400 `The issue type 'X' is not valid` | Issue type doesn't exist in project | Verify via `GET /rest/api/3/issuetype` for the project |
| 400 `Transition is not valid` | Transition not available from current status | Fetch transitions first; verify current status |
| 401 | Token invalid or expired | Regenerate API token or refresh OAuth token |
| 403 | User lacks project permission | Check project role in Jira UI |
| 404 | Issue key/ID doesn't exist | Verify the key; check if issue is in a different project |
| 429 | Rate limited | Back off per `Retry-After` header |

### "If you see X, do Y" playbook

- **ADF validation error (400 with "Content must be a doc"):** Your description/comment body is plain text, not ADF. Wrap it.
- **`accountId` not found (400):** User is not a member of the Jira site. Use `GET /rest/api/3/user/search?query=email` to look up the correct `accountId`.
- **Webhook stops firing:** Check the webhook URL is reachable. Jira disables webhooks that fail 3+ times. Re-create via API if disabled.
- **Custom field 400 (`Field X cannot be set`):** Field is read-only or managed by automation. Remove it from the request.

---

## Security, privacy, compliance

- **PII in issues:** Issue descriptions/comments may contain PII (customer names, emails). Log field names, not values.
- **Data minimization:** Only request `fields=` parameters you actually need — reduces response size and accidental PII exposure in logs.
- **Audit trail:** Jira issue history provides a full audit trail of field changes. For compliance, avoid bulk-deleting issues — use status changes instead.
- **Admin tokens:** Never use site admin credentials for integrations. Use a dedicated service account with the minimum project roles (Jira Software: "Developer" role is sufficient for CRUD; "Administrators" role only for project config).
- **Webhook URL security:** Use a secret in the URL and rotate it. Jira Cloud does not sign webhook payloads natively.
- **OAuth tokens:** Restrict scopes to `read:jira-work write:jira-work`. Do not request `manage:jira-configuration` unless you need to modify Jira settings.

---

## Testing checklist

- [ ] **Auth test:** `GET /rest/api/3/myself` returns the integration user's account details.
- [ ] **CRUD test:** Create issue → read by key → update assignee → add comment → transition status → verify at each step.
- [ ] **Pagination test:** JQL query returning >100 issues; loop through all pages; count matches `total`.
- [ ] **Transition test:** Fetch transitions for an issue; execute a valid transition; verify status changed; attempt transition from incorrect state and confirm 400.
- [ ] **Attachment test:** Upload a file; verify it appears in issue; download it.
- [ ] **Webhook test:** Register webhook; create an issue; verify payload received within 5s; confirm changelog contains expected fields.
- [ ] **Permission test:** Attempt to create an issue in a project the service account doesn't have access to — confirm 403.
- [ ] **Negative tests:**
  - Invalid issue key → 404
  - Missing required field → 400 with field name in error
  - Invalid ADF in description → 400
  - Revoked token → 401

---

## Sources

- Jira Cloud REST API v3 reference: https://developer.atlassian.com/cloud/jira/platform/rest/v3/
- JQL syntax reference: https://support.atlassian.com/jira-software-cloud/docs/use-advanced-search-with-jira-query-language-jql/
- Atlassian Document Format (ADF): https://developer.atlassian.com/cloud/jira/platform/apis/document/structure/
- Webhooks: https://developer.atlassian.com/cloud/jira/platform/webhooks/
- OAuth 2.0 (3LO): https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/
- Create Issue Meta: https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/#api-rest-api-3-issue-createmeta-get
- Jira Cloud API Changelog: https://developer.atlassian.com/cloud/jira/platform/changelog/
- Rate Limits: https://developer.atlassian.com/cloud/jira/platform/rate-limiting/
