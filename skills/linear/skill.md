# Linear Skill

> **Last validated:** 2026-08-02 | **API:** GraphQL (no versioned URL path)
> **GraphQL endpoint:** `https://api.linear.app/graphql`
> **Assumed product:** Linear (cloud). The same API powers all Linear workspaces.
> **⚠️ OAuth note:** Apps created after October 1, 2025 issue short-lived access tokens (24 hr) and require refresh token rotation. Apps created before that date used long-lived tokens until the April 1, 2026 migration deadline, which has now passed — the migration endpoint `POST /oauth/migrate_old_token` returns **`410 Gone`** as of May 21, 2026. Un-migrated apps must re-authorize from scratch.
>
> **⚠️ Schema changes since 2026-05:**
> - **`Team.private` is deprecated** in favour of the `Team.visibility` enum (2026-05-21). Read `visibility`; `private` still resolves but will be removed.
> - **`AiPrompt` query/mutation roots are deprecated**; parallel `AgentSkill` types were added alongside them (2026-05-21). Migrate skill-related calls to `AgentSkill`.
> - **Cycle validation tightened** (2026-07-23): `cycleCreate` and `cycleUpdate` now reject overlapping schedules and validate dates against neighbouring cycles. Sprint-automation code that created back-to-back or overlapping cycles will now error — see Recipes.
> - **`templateCreate` / `templateUpdate`** reject unsupported form-field payloads (2026-06-18).
> - **Duplicate issues** must now link to the original; marking an issue duplicate moves its customer requests and attachments to the canonical issue (2026-05-21).
> - **Webhooks:** the actor union gained an external-user variant, and data-change payloads now include a top-level `url` field on remove actions (2026-07-02).

---

## What this skill enables

- Create, update, and triage issues programmatically — from CI pipelines, alerts, CRMs, or support tools.
- Query issues with rich filters (state, assignee, priority, label, project, cycle) and paginate large result sets.
- Move issues through workflow states to automate sprint boards and status syncs.
- Manage projects and cycles: create sprints, assign issues, track progress.
- Post comments on issues from external systems (Slack alerts, deploy scripts, monitoring tools).
- Subscribe to real-time changes via webhooks: react when issues are created, updated, or completed.
- Build two-way syncs: push GitHub PRs, Sentry errors, or Zendesk tickets into Linear and reflect status changes back.

---

## Best-fit use cases

| Use case | Why it matters | Primary objects | Typical trigger | Success criteria |
|----------|---------------|-----------------|-----------------|-----------------|
| Auto-create issue from error alert | Zero-manual triage for Sentry/PagerDuty alerts | Issue, Team | Error monitoring webhook | Issue created in correct team with priority, description, and error link |
| Sync GitHub PR → Linear issue status | Keep engineering board accurate without manual updates | Issue, WorkflowState | GitHub PR opened/merged webhook | Issue moves to "In Review" on PR open, "Done" on merge |
| CI failure → Linear bug | Surface broken builds as actionable issues | Issue, Label, Team | GitHub Actions / CI webhook | Bug created with branch, build URL, error log in description |
| Zendesk ticket → Linear issue | Escalate customer bugs to engineering | Issue, Comment, Attachment | Zendesk trigger on tag/priority | Linear issue created with Zendesk ticket URL; comment posted on status change |
| Sprint planning automation | Populate next cycle with backlog issues | Cycle, Issue | Scheduled job or project milestone | Issues added to new cycle; priority and assignee set |
| Weekly engineering digest | Summarise completed/open issues per team | Issue, WorkflowState | Cron job | Structured report of issues completed/started/blocked this week |
| SLA breach escalation | Auto-raise priority of issues open too long | Issue | Scheduled job | Issues open > N days escalated to Urgent; assignee notified |
| Cross-tool status sync | Reflect Linear issue state in Notion/Jira | Issue, WorkflowState | Webhook `update` event on state change | External system updated within seconds of Linear state change |
| Onboarding tasks | Create a personal issue list for new team members | Issue, Team, User | HRIS onboarding event | Set of issues assigned to new hire in their team |
| Release tracking | Create a project per release, link issues | Project, Issue | Deployment pipeline | Project created; relevant issues linked; progress visible in Linear |

---

## Key concepts & data model

### Core objects

| Object | Description | ID formats |
|--------|-------------|------------|
| **Issue** | A unit of work; the central object in Linear | UUID (`9cfb482a-...`) **or** shorthand (`ENG-123`) |
| **Team** | A group of people; issues always belong to a team | UUID; `key` field holds the prefix (e.g. `"ENG"`) |
| **WorkflowState** | A status step in a team's workflow (Backlog → Done) | UUID |
| **User** | A workspace member | UUID |
| **Project** | A milestone or initiative grouping multiple issues | UUID |
| **Cycle** | A time-boxed sprint; contains a set of issues | UUID |
| **Label** | A tag applied to issues for categorisation | UUID |
| **Comment** | A comment thread entry on an issue | UUID |
| **Attachment** | A link attached to an issue (PR, ticket, etc.) | UUID |
| **Webhook** | An outbound event subscription | UUID |

### Issue fields reference

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID string | Permanent identifier |
| `identifier` | string | Shorthand, e.g. `"ENG-42"` — accepts in mutations too |
| `title` | string | Required on create |
| `description` | string | Markdown supported |
| `priority` | integer | 0=None, 1=Urgent, 2=High, 3=Medium, 4=Low |
| `state` | WorkflowState | Current workflow status |
| `assignee` | User | `null` if unassigned |
| `labels` | Label[] | Array of tags |
| `project` | Project | Parent project, if any |
| `cycle` | Cycle | Active cycle, if any |
| `team` | Team | Required; every issue belongs to exactly one team |
| `createdAt` | ISO 8601 datetime | Set by Linear |
| `updatedAt` | ISO 8601 datetime | Set by Linear |
| `completedAt` | ISO 8601 datetime | Non-null when state type is `completed` |
| `canceledAt` | ISO 8601 datetime | Non-null when state type is `canceled` |
| `dueDate` | ISO 8601 date string | Optional target date |
| `estimate` | float | Story points / estimate value |
| `url` | string | Deep link to the issue in Linear |

### WorkflowState types

| `type` | Meaning |
|--------|---------|
| `triage` | Initial review queue (if triage enabled) |
| `backlog` | Not yet scheduled |
| `unstarted` | Scheduled but not started |
| `started` | Actively being worked on |
| `completed` | Done — terminal success state |
| `canceled` | Cancelled — terminal failure state |

### GraphQL response envelope

Every request returns:

```json
{
  "data": { ... },
  "errors": [ { "message": "...", "extensions": { "code": "..." } } ]
}
```

A `200 OK` can still contain errors in the `errors` array — always check it. `data` and `errors` can coexist (partial success).

---

## Authentication & permissions

### Personal API key (server-to-server, simplest)

Create in **Linear → Settings → Security & privacy → API keys**.

```bash
curl -X POST https://api.linear.app/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: YOUR_API_KEY" \
  -d '{"query": "{ viewer { id name email } }"}'
```

Note: API keys use the header **without** the `Bearer` prefix. The key inherits the permissions of the user who created it.

### OAuth 2.0 (multi-workspace apps)

```
1. Redirect user →
   https://linear.app/oauth/authorize
     ?client_id=<CLIENT_ID>
     &redirect_uri=<CALLBACK_URL>
     &response_type=code
     &scope=read,issues:create,comments:create

2. Exchange code →
   POST https://api.linear.app/oauth/token
   Content-Type: application/x-www-form-urlencoded
   Body: code=...&client_id=...&client_secret=...
         &redirect_uri=...&grant_type=authorization_code

3. Use access token →
   Authorization: Bearer <ACCESS_TOKEN>
```

**Scopes:**

| Scope | Access |
|-------|--------|
| `read` | Read all workspace data (default) |
| `write` | Modify all workspace data |
| `issues:create` | Create issues and attachments only |
| `comments:create` | Post comments only |
| `timeSchedule:write` | Manage time schedules |
| `admin` | Full admin-level access (use sparingly) |

**Token lifetimes (post-October 2025 apps):**

- Access token: **24 hours** (`expires_in: 86399`)
- Refresh token: long-lived; use to obtain a new access token before expiry

```bash
# Refresh access token
curl -X POST https://api.linear.app/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=refresh_token&refresh_token=<REFRESH_TOKEN>&client_id=<CLIENT_ID>&client_secret=<CLIENT_SECRET>"
```

> **Migration note:** Apps created before October 1, 2025 use 10-year tokens. These must migrate to refresh token rotation by **April 1, 2026**.

---

## Common workflows (recipes)

### 1. Create an issue

```graphql
mutation IssueCreate {
  issueCreate(input: {
    title: "Login page throws 500 on Safari"
    description: "## Steps to reproduce\n1. Open Safari\n2. Navigate to /login\n\n**Error:** Internal Server Error\n\n[Sentry link](https://sentry.io/...)"
    teamId: "9cfb482a-81e3-4154-b5b9-2c805e70a02d"
    priority: 2
    stateId: "state-uuid-for-backlog"
    assigneeId: "user-uuid"
    labelIds: ["label-uuid-bug"]
    projectId: "project-uuid"
  }) {
    success
    issue {
      id
      identifier
      url
    }
  }
}
```

```python
import requests

def linear_query(query: str, variables: dict = None) -> dict:
    resp = requests.post(
        "https://api.linear.app/graphql",
        headers={
            "Authorization": API_KEY,
            "Content-Type": "application/json",
        },
        json={"query": query, "variables": variables or {}},
    )
    resp.raise_for_status()
    data = resp.json()
    if data.get("errors"):
        raise RuntimeError(data["errors"])
    return data["data"]
```

---

### 2. Update an issue (state, priority, assignee)

You can use either the UUID or the shorthand identifier (`ENG-123`) in mutations:

```graphql
mutation IssueUpdate {
  issueUpdate(
    id: "ENG-123"
    input: {
      stateId: "state-uuid-in-review"
      priority: 1
      assigneeId: "user-uuid"
      dueDate: "2026-03-15"
    }
  ) {
    success
    issue {
      id
      identifier
      state { name }
      priority
    }
  }
}
```

To update labels, pass the **full desired array** (not a delta — Linear replaces the label list):

```graphql
input: { labelIds: ["label-uuid-bug", "label-uuid-urgent"] }
```

---

### 3. Query issues with filters and pagination

```graphql
query IssueList($teamId: String!, $cursor: String) {
  issues(
    first: 50
    after: $cursor
    filter: {
      team: { id: { eq: $teamId } }
      state: { type: { in: ["started", "unstarted"] } }
      priority: { lte: 2 }
    }
    orderBy: updatedAt
  ) {
    pageInfo {
      hasNextPage
      endCursor
    }
    nodes {
      id
      identifier
      title
      priority
      state { name type }
      assignee { name email }
      createdAt
      updatedAt
    }
  }
}
```

```python
def get_all_issues(team_id: str) -> list:
    query = """..."""  # as above
    issues, cursor = [], None
    while True:
        data = linear_query(query, {"teamId": team_id, "cursor": cursor})
        page = data["issues"]
        issues.extend(page["nodes"])
        if not page["pageInfo"]["hasNextPage"]:
            break
        cursor = page["pageInfo"]["endCursor"]
    return issues
```

---

### 4. Get workflow states for a team

Before creating or updating issues you need state UUIDs. Fetch them once and cache:

```graphql
query TeamStates($teamId: String!) {
  team(id: $teamId) {
    states {
      nodes {
        id
        name
        type
        position
      }
    }
  }
}
```

Map `type` to find the right state: use `"backlog"` for new issues, `"started"` for in-progress, `"completed"` for done.

---

### 5. Post a comment on an issue

```graphql
mutation CommentCreate {
  commentCreate(input: {
    issueId: "ENG-123"
    body: "Deployed fix in PR #456. Monitoring for 30 minutes before closing."
  }) {
    success
    comment {
      id
      createdAt
    }
  }
}
```

---

### 6. Create an attachment (link an external resource)

Link a Sentry issue, GitHub PR, or Zendesk ticket to a Linear issue:

```graphql
mutation AttachmentCreate {
  attachmentCreate(input: {
    issueId: "ENG-123"
    title: "Sentry: NullPointerException in AuthService"
    url: "https://sentry.io/organizations/acme/issues/12345/"
    iconUrl: "https://sentry.io/favicon.ico"
    subtitle: "10 occurrences · 5 users affected"
  }) {
    success
    attachment { id }
  }
}
```

---

### 7. Incremental sync — issues updated since last run

```graphql
query UpdatedIssues($since: DateTimeOrDuration!) {
  issues(
    filter: { updatedAt: { gt: $since } }
    orderBy: updatedAt
    first: 250
    includeArchived: true
  ) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id
      identifier
      title
      state { name type }
      updatedAt
      archivedAt
    }
  }
}
```

Pass an ISO 8601 timestamp or a relative duration string (`"PT1H"` = last hour, `"P1D"` = last day):

```python
from datetime import datetime, timezone

since = datetime.now(timezone.utc).replace(minute=0, second=0).isoformat()
data = linear_query(QUERY, {"since": since})
```

---

### 8. Register a webhook

```graphql
mutation WebhookCreate {
  webhookCreate(input: {
    url: "https://your-server.com/webhooks/linear"
    teamId: "9cfb482a-81e3-4154-b5b9-2c805e70a02d"
    resourceTypes: ["Issue", "Comment", "IssueLabel"]
    label: "My Integration"
    secret: "your-signing-secret"
  }) {
    success
    webhook {
      id
      url
      enabled
    }
  }
}
```

---

### 9. Webhook receiver — verify and dispatch

```python
import hashlib, hmac, time
from flask import Flask, request, jsonify

app = Flask(__name__)
WEBHOOK_SECRET = "your-signing-secret"

@app.post("/webhooks/linear")
def linear_webhook():
    sig = request.headers.get("Linear-Signature", "")
    body = request.data

    # Verify HMAC-SHA256 signature
    expected = hmac.new(
        WEBHOOK_SECRET.encode(),
        body,
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(sig, expected):
        return jsonify(error="invalid signature"), 400

    payload = request.json

    # Replay attack prevention — reject events > 5 minutes old
    ts = payload.get("webhookTimestamp", 0) / 1000  # ms → s
    if abs(time.time() - ts) > 300:
        return jsonify(error="stale event"), 400

    action = payload["action"]   # "create" | "update" | "remove"
    event_type = payload["type"] # "Issue" | "Comment" | etc.
    data = payload["data"]
    updated_from = payload.get("updatedFrom", {})  # previous values on "update"

    match (event_type, action):
        case ("Issue", "create"):
            handle_issue_created(data)
        case ("Issue", "update"):
            handle_issue_updated(data, updated_from)
        case ("Comment", "create"):
            handle_comment_created(data)

    return jsonify(ok=True), 200
```

**Key rules:**
- Always verify `Linear-Signature` before processing.
- Use `updatedFrom` on `"update"` events to detect what specifically changed (e.g. `"stateId"` in `updatedFrom` means the state changed).
- Return `200` quickly — do heavy work in a background job.
- Make handlers **idempotent** — Linear retries up to 3 times.

---

### 10. Add an issue to a cycle (sprint)

```graphql
mutation IssueUpdate {
  issueUpdate(
    id: "ENG-123"
    input: { cycleId: "cycle-uuid" }
  ) {
    success
    issue { id cycle { number name } }
  }
}
```

To get current/upcoming cycles for a team:

```graphql
query TeamCycles($teamId: String!) {
  team(id: $teamId) {
    cycles(
      filter: { completedAt: { null: true } }
      orderBy: createdAt
    ) {
      nodes {
        id
        number
        name
        startsAt
        endsAt
      }
    }
  }
}
```

---

## Query patterns & filtering

### Filter operators

| Operator | Types | Example |
|----------|-------|---------|
| `eq` / `neq` | any | `priority: { eq: 1 }` |
| `in` / `nin` | any | `state: { type: { in: ["started", "unstarted"] } }` |
| `lt` / `lte` / `gt` / `gte` | number, date | `priority: { lte: 2 }` |
| `contains` / `notContains` | string | `title: { contains: "login" }` |
| `containsIgnoreCase` | string | `title: { containsIgnoreCase: "ERROR" }` |
| `startsWith` / `endsWith` | string | `title: { startsWith: "[BUG]" }` |
| `null` | optional fields | `assignee: { null: true }` (unassigned) |

### AND / OR logic

Filters are AND by default. Use the `or` key for OR conditions:

```graphql
filter: {
  or: [
    { priority: { eq: 1 } }
    { priority: { eq: 2 } }
  ]
}
```

Mix AND and OR:

```graphql
filter: {
  team: { id: { eq: "..." } }
  or: [
    { assignee: { email: { eq: "alice@example.com" } } }
    { assignee: { email: { eq: "bob@example.com" } } }
  ]
}
```

### Relation filters

Filter on related object properties directly:

```graphql
# Issues assigned to a specific user by email
filter: { assignee: { email: { eq: "alice@example.com" } } }

# Issues with a specific label
filter: { labels: { name: { eq: "bug" } } }

# Issues in a specific project
filter: { project: { name: { containsIgnoreCase: "Q1" } } }
```

### Relative date filters

Use ISO 8601 durations for dynamic date windows:

```graphql
# Issues updated in the last 2 weeks
filter: { updatedAt: { gt: "P2W" } }

# Issues due in the next 7 days
filter: { dueDate: { lt: "P7D" } }
```

### Pagination parameters

| Parameter | Default | Max | Notes |
|-----------|---------|-----|-------|
| `first` | 50 | 250 | Items per page (forward pagination) |
| `after` | — | — | `endCursor` from previous `pageInfo` |
| `last` | — | 250 | Items per page (backward pagination) |
| `before` | — | — | `startCursor` from previous `pageInfo` |
| `includeArchived` | `false` | — | Set `true` to include archived/deleted items |
| `orderBy` | `createdAt` | — | `createdAt` or `updatedAt` |

### Selecting only what you need

Linear uses complexity-based rate limiting — requesting fewer fields costs fewer complexity points. Avoid requesting deeply nested fields (e.g. `issue.project.lead.assignedIssues`) unless necessary. Use the `X-Complexity` response header to monitor cost.

---

## Reliability: rate limits, retries, idempotency

### Rate limits

| Auth type | Requests / hr | Complexity points / hr | Max per query |
|-----------|-------------|----------------------|---------------|
| API key | 5,000 | 250,000 | 10,000 pts |
| OAuth app | 5,000 | 2,000,000 | 10,000 pts |
| Unauthenticated | 60 | 10,000 | 10,000 pts |

Requests are tracked **per user** — all API keys for the same user share the quota.

### Rate limit response headers

| Header | Description |
|--------|-------------|
| `X-RateLimit-Requests-Limit` | Total allowed requests in window |
| `X-RateLimit-Requests-Remaining` | Remaining requests |
| `X-RateLimit-Requests-Reset` | Unix timestamp when window resets |
| `X-RateLimit-Complexity-Limit` | Total allowed complexity points |
| `X-RateLimit-Complexity-Remaining` | Remaining complexity points |
| `X-Complexity` | Complexity cost of the current query |

### Rate limit error

HTTP `400` with `RATELIMITED` in `extensions.code`:

```json
{
  "errors": [{
    "message": "Too many requests, please try again later",
    "extensions": {
      "code": "RATELIMITED",
      "type": "RATE_LIMITED"
    }
  }]
}
```

### Retry with exponential backoff

```python
import time, random, requests

def linear_query_with_retry(query: str, variables: dict = None, max_retries: int = 5) -> dict:
    for attempt in range(max_retries):
        resp = requests.post(
            "https://api.linear.app/graphql",
            headers={"Authorization": API_KEY, "Content-Type": "application/json"},
            json={"query": query, "variables": variables or {}},
        )
        data = resp.json()

        # Check for rate limit error (returned as HTTP 400)
        errors = data.get("errors", [])
        if any(e.get("extensions", {}).get("code") == "RATELIMITED" for e in errors):
            if attempt == max_retries - 1:
                raise RuntimeError("Rate limit exceeded after retries")
            wait = (2 ** attempt) + random.uniform(0, 1)
            time.sleep(wait)
            continue

        if resp.status_code >= 500:
            time.sleep(2 ** attempt)
            continue

        resp.raise_for_status()
        if errors:
            raise RuntimeError(errors)
        return data["data"]
```

### Idempotency

Linear GraphQL mutations are **not idempotent** — creating an issue twice creates two issues. To avoid duplicates:
- Store Linear issue IDs alongside your source records (e.g., in Sentry, store the Linear issue UUID in a custom field).
- Before creating, query for an existing issue by attachment URL or external ID:

```graphql
query FindByAttachment($url: String!) {
  issueSearch(query: $url) {
    nodes { id identifier url }
  }
}
```

Or filter by a known title pattern + team to detect duplicates before inserting.

---

## Error handling & troubleshooting

### GraphQL error structure

```json
{
  "errors": [
    {
      "message": "Entity not found: Issue - could not find Issue (id: ENG-999)",
      "extensions": {
        "code": "ENTITY_NOT_FOUND",
        "type": "ENTITY_NOT_FOUND",
        "userPresentableMessage": "Issue not found"
      },
      "path": ["issue"]
    }
  ]
}
```

### Error codes → action

| `extensions.code` | HTTP | Meaning | Fix |
|-------------------|------|---------|-----|
| `UNAUTHENTICATED` | 401 | Missing or invalid token | Check `Authorization` header format; API key = no Bearer prefix, OAuth = Bearer prefix |
| `FORBIDDEN` | 403 | Token lacks permission for this operation | Add required scope; check user's Linear permissions |
| `ENTITY_NOT_FOUND` | 200 | Object doesn't exist or isn't accessible | Verify ID; check the object belongs to the workspace |
| `RATELIMITED` | 400 | Rate limit exceeded | Retry with exponential backoff; reduce query complexity |
| `INPUT_ERROR` / `VALIDATION_ERROR` | 400 | Invalid input field | Check `message` for which field; verify UUIDs exist |
| `INTERNAL_SERVER_ERROR` | 500 | Linear server error | Retry with backoff; check https://linearstatus.com |
| `NETWORK_ERROR` | — | Connection failure | Retry with backoff |

### Common issues

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `UNAUTHENTICATED` with valid key | Wrong header format | API key: `Authorization: <KEY>` (no Bearer). OAuth: `Authorization: Bearer <TOKEN>` |
| `ENTITY_NOT_FOUND` on valid issue ID | Issue belongs to a different workspace | Verify the API key / token matches the workspace |
| Mutation returns `success: false` | Invalid state/user/label UUID | Fetch valid IDs first; UUIDs are workspace-specific |
| Empty `nodes` in query | No matching results or wrong filter | Test without filter first; verify team ID |
| `RATELIMITED` on API key | Personal key shares user's 5k req/hr quota | Switch to OAuth app (2M complexity pts/hr); reduce request frequency |
| Webhook not firing | Webhook disabled after repeated failures | Re-enable in Linear settings; check your endpoint returns 2xx |
| `updatedFrom` missing on webhook | Not an update event | `updatedFrom` only present when `action: "update"` |
| Refresh token rejected (OAuth) | Token not rotated within expiry window | Store and refresh before expiry; check migration status if pre-Oct 2025 app |

---

## Security & compliance

### Token storage

- Store API keys and OAuth tokens in environment variables or a secrets manager — never in source code.
- API keys have no expiry — rotate them in Linear settings if compromised.
- OAuth access tokens expire in 24 hours (post-Oct 2025 apps). Store both access and refresh tokens securely; never log them.

### Least-privilege scopes

Use the narrowest OAuth scope for your use case:

| Integration type | Recommended scopes |
|-----------------|-------------------|
| Read-only reporting | `read` |
| Issue creation from alerts | `read,issues:create` |
| Posting comments | `read,comments:create` |
| Full automation (create, update, transition) | `read,write` |
| Admin tooling | `read,write,admin` |

Avoid `write` when `issues:create` suffices — it limits blast radius on a compromised token.

### Webhook security

- Always verify `Linear-Signature` using HMAC-SHA256 before processing any payload.
- Validate `webhookTimestamp` is within 5 minutes to prevent replay attacks.
- Rotate webhook secrets in Linear settings if exposed.

### Data considerations

- Linear issues may contain PII (names, emails in `assignee`, comments). Ensure data passing through pipelines is handled per your privacy policy.
- Linear is SOC 2 Type II compliant. Verify your integration's data residency requirements against Linear's data processing agreement.

---

## Testing checklist

### Setup

1. Create a test workspace (or test team in your workspace).
2. Generate a personal API key: **Settings → Security & privacy → API keys**.
3. Create a test team, note its UUID.
4. Use the Apollo Studio explorer at `https://studio.apollographql.com/public/Linear-API` to explore and test queries interactively.

### QA checklist

- [ ] `{ viewer { id name email } }` returns the authenticated user → token is valid
- [ ] `teams { nodes { id name key } }` lists all accessible teams
- [ ] `issueCreate` with title + teamId → `success: true`, issue `identifier` returned (e.g. `ENG-1`)
- [ ] `issueUpdate` with shorthand ID (`ENG-1`) → `success: true`, field updated
- [ ] `issues(filter: { state: { type: { eq: "started" } } })` returns only in-progress issues
- [ ] Pagination: `first: 1` returns `hasNextPage: true`; `after: endCursor` retrieves next page
- [ ] `includeArchived: true` includes archived issues that are hidden by default
- [ ] Relative date filter `updatedAt: { gt: "P1D" }` returns only recently-modified issues
- [ ] `commentCreate` posts a comment; visible in Linear UI
- [ ] `webhookCreate` → endpoint receives test payload; `Linear-Signature` verifies correctly
- [ ] Webhook `updatedFrom` present on issue update; `action: "create"` has no `updatedFrom`
- [ ] Rate limit: burst >5,000 requests/hr with same user → `RATELIMITED` error returned; retry succeeds
- [ ] Invalid UUID in mutation → `ENTITY_NOT_FOUND` or `INPUT_ERROR`; error handled gracefully
- [ ] OAuth refresh: access token refreshed using refresh token before 24-hour expiry

---

## Sources

- [Linear GraphQL API — Getting Started](https://linear.app/developers/graphql)
- [Authentication (API keys + OAuth 2.0)](https://linear.app/developers/oauth-2-0-authentication)
- [OAuth Scopes](https://linear.app/developers/oauth-2-0-authentication)
- [Rate Limiting](https://linear.app/developers/rate-limiting)
- [Filtering](https://linear.app/developers/filtering)
- [Webhooks](https://linear.app/developers/webhooks)
- [GraphQL Schema Reference (Apollo Studio)](https://studio.apollographql.com/public/Linear-API/schema/reference?variant=current)
- [Linear GitHub — schema.graphql](https://github.com/linear/linear/blob/master/packages/sdk/src/schema.graphql)
- [API Status](https://linearstatus.com)
