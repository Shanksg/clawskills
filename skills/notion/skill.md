# Notion Skill

> **Last validated:** 2026-03-02 | **API version:** `2025-09-03` (latest stable)
> **REST base URL:** `https://api.notion.com/v1/`
> **Assumed product:** Notion (cloud). The `Notion-Version: 2025-09-03` header is required on every request. This version introduced multi-source databases — see the Key concepts section for migration notes.

---

## What this skill enables

- Create and update pages (docs, notes, tasks, CRM records) programmatically inside any Notion workspace.
- Query databases with filters, sorts, and pagination — pull structured data from any Notion table, board, or calendar.
- Write rich page content: headings, paragraphs, lists, callouts, code blocks, and more via the Blocks API.
- Sync external data into Notion: push records from CRMs, issue trackers, or alert systems into Notion databases.
- Search across all workspace content (pages and databases) that the integration has access to.
- Build lightweight internal tools: project trackers, content calendars, CRM boards, on-call runbooks — without leaving Notion.

---

## Best-fit use cases

| Use case | Why it matters | Primary objects | Typical trigger | Success criteria |
|----------|---------------|-----------------|-----------------|-----------------|
| Sync CRM deals to Notion pipeline | Sales visibility in Notion without manual entry | Database page, properties | HubSpot/Salesforce webhook on deal stage change | Notion database row created/updated with correct stage, owner, amount |
| Create incident runbook page | Auto-generate a structured runbook when PagerDuty alert fires | Page, Blocks | PagerDuty/Alertmanager webhook | Page created with headings, checklist, and links |
| Content calendar entry | Marketing team manages publishing schedule in Notion | Database page, date property | CMS or manual trigger | Page created with title, publish date, status, assignee |
| Bug/task tracker | Engineering team tracks work in Notion instead of or alongside Jira | Database page, select, relation | CI failure, Sentry alert | Page created in backlog with priority, assignee, reproduction steps |
| Weekly digest / standup | Summarise activity from GitHub/Jira/Slack into a Notion doc | Page, Blocks | Cron job (Monday morning) | Structured page with bullet points per team member |
| Knowledge base article | Auto-create docs from templates when a product feature ships | Page, Blocks | GitHub release webhook | Page created in wiki database with correct tags and cover |
| Meeting notes capture | Push structured meeting notes from an AI summary into Notion | Page, Blocks | Calendly/Zoom webhook on meeting end | Page in meetings database with attendees, action items, summary |
| Search-and-update pipeline | Find pages by title/tag and bulk-update a property | Search, PATCH page | Scheduled job | All matching pages updated; `last_edited_time` advances |
| Onboarding checklist | Create a personal checklist page for each new hire | Page, to_do blocks | HRIS onboarding event | Page with pre-checked and unchecked tasks, assigned to new hire |
| Incremental data sync | Pull all Notion pages modified since last run into a data warehouse | Database query, `last_edited_time` filter | Scheduled ETL job | Every modified page captured; no duplicates |

---

## Key concepts & data model

### Core objects

| Object | Description | Identified by |
|--------|-------------|---------------|
| **Page** | A document in Notion; also functions as a row in a database | UUIDv4 `id`, e.g. `"a1b2c3d4-..."` |
| **Database** | A collection of pages sharing a property schema; can be inline or full-page | UUIDv4 `id` |
| **Block** | A unit of page content (paragraph, heading, list item, image, etc.) | UUIDv4 `id` |
| **User** | A workspace member or integration bot | UUIDv4 `id` |
| **Comment** | A discussion thread on a page or block | UUIDv4 `id` |

All IDs are UUIDv4 strings. Notion returns them with hyphens: `"a1b2c3d4-e5f6-7890-abcd-ef1234567890"`. When passing IDs in URL paths you can use either format (with or without hyphens).

### Page vs database row

In Notion, a "row" in a database is just a Page whose `parent` is the database. Create rows by creating pages with `"parent": {"database_id": "..."}`. Every Page has a `properties` object whose shape is defined by the parent database's schema.

### Parent types

| `parent.type` | Meaning |
|---------------|---------|
| `"database_id"` | Page is a row in a database |
| `"page_id"` | Page is a sub-page of another page |
| `"workspace"` | Top-level page in the workspace |
| `"block_id"` | Page is embedded inside a block |

### Version 2025-09-03 — multi-source databases

Version `2025-09-03` introduced **multi-source databases** (databases that aggregate rows from multiple linked data sources). For single-source databases (the vast majority), nothing changes. If your database uses multiple data sources, creating pages requires a `data_source_id` in the parent object:

```json
"parent": { "type": "data_source_id", "data_source_id": "the-source-uuid" }
```

For all standard databases, continue using `"database_id"`. The query endpoint `POST /v1/databases/{id}/query` continues to work unchanged.

### Property types

| Type | Writable? | Notes |
|------|-----------|-------|
| `title` | ✅ | Required on every database page; every database has exactly one |
| `rich_text` | ✅ | Up to 2,000 characters per value |
| `number` | ✅ | Integer or float |
| `select` | ✅ | Single option; pass `{"name": "..."}` (creates option if new) |
| `multi_select` | ✅ | Array of `{"name": "..."}` objects; max 100 options |
| `date` | ✅ | `{"start": "YYYY-MM-DD", "end": null}` or with time zone |
| `people` | ✅ | Array of `{"object": "user", "id": "..."}` |
| `files` | ✅ | External URLs only via API; Notion-hosted files read-only |
| `checkbox` | ✅ | Boolean |
| `url` | ✅ | String URL |
| `email` | ✅ | String |
| `phone_number` | ✅ | String |
| `relation` | ✅ | Array of `{"id": "page-uuid"}` — links to pages in related database |
| `formula` | ❌ | Read-only; computed by Notion |
| `rollup` | ❌ | Read-only; aggregated from relations |
| `created_time` | ❌ | Read-only |
| `created_by` | ❌ | Read-only |
| `last_edited_time` | ❌ | Read-only |
| `last_edited_by` | ❌ | Read-only |

### Rich text object

Used inside `title`, `rich_text`, block content, and more:

```json
{
  "type": "text",
  "text": {
    "content": "Hello, world",
    "link": null
  },
  "annotations": {
    "bold": false,
    "italic": false,
    "strikethrough": false,
    "underline": false,
    "code": false,
    "color": "default"
  },
  "plain_text": "Hello, world"
}
```

When **writing** rich text, only `text.content` (and optionally `text.link.url` and `annotations`) are required. `plain_text` is ignored on writes.

---

## Authentication & permissions

### Integration types

| Type | Token prefix | Use |
|------|-------------|-----|
| **Internal integration** | `secret_` | Single workspace; simplest setup; no OAuth needed |
| **Public integration (OAuth)** | `ntn_` | Multi-workspace; requires OAuth 2.0 flow |

### Internal integration setup

1. Go to **notion.so/my-integrations** → New integration → fill in name and select workspace.
2. Copy the **Internal Integration Secret** (`secret_...`).
3. **Share the page or database** with the integration: open the page in Notion → … menu → Connections → add your integration. Without this step every API call returns `object_not_found`.

```bash
curl https://api.notion.com/v1/users/me \
  -H "Authorization: Bearer secret_abc123..." \
  -H "Notion-Version: 2025-09-03"
```

### Integration capabilities

When creating an integration, select only the capabilities you need:

| Capability | What it allows |
|------------|---------------|
| Read content | GET pages, databases, blocks, comments |
| Update content | PATCH pages and blocks |
| Insert content | POST pages, blocks, comments |
| Read user information (no email) | GET /v1/users (names and avatars only) |
| Read user email addresses | GET /v1/users (includes email — restricted capability) |

### OAuth 2.0 (public integrations)

Used when your app accesses multiple users' workspaces:

```
1. Redirect user → https://api.notion.com/v1/oauth/authorize
     ?client_id=<your-client-id>
     &response_type=code
     &owner=user
     &redirect_uri=<your-callback-url>

2. User approves → Notion redirects back with ?code=<auth-code>

3. Exchange code for token:
   POST https://api.notion.com/v1/oauth/token
   Authorization: Basic base64(client_id:client_secret)
   Content-Type: application/json
   {"grant_type": "authorization_code", "code": "...", "redirect_uri": "..."}

4. Response: {"access_token": "ntn_...", "workspace_id": "...", "workspace_name": "...", "bot_id": "..."}
```

Use `access_token` as the Bearer token for all subsequent requests on behalf of that workspace.

### Required headers on every request

```
Authorization: Bearer <token>
Notion-Version: 2025-09-03
Content-Type: application/json   (for POST/PATCH)
```

---

## Common workflows (recipes)

### 1. Create a database row (page with properties)

```bash
curl -X POST https://api.notion.com/v1/pages \
  -H "Authorization: Bearer secret_..." \
  -H "Notion-Version: 2025-09-03" \
  -H "Content-Type: application/json" \
  -d '{
    "parent": { "database_id": "your-database-uuid" },
    "properties": {
      "Name": {
        "title": [{ "text": { "content": "Fix login bug" } }]
      },
      "Status": {
        "select": { "name": "In Progress" }
      },
      "Priority": {
        "select": { "name": "High" }
      },
      "Due Date": {
        "date": { "start": "2026-03-15" }
      },
      "Assignee": {
        "people": [{ "object": "user", "id": "user-uuid-here" }]
      }
    }
  }'
```

**Response** (key fields):

```json
{
  "object": "page",
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "url": "https://www.notion.so/Fix-login-bug-a1b2c3d4e5f6...",
  "properties": { ... },
  "created_time": "2026-03-02T10:00:00.000Z",
  "last_edited_time": "2026-03-02T10:00:00.000Z"
}
```

---

### 2. Query a database with filters and sorts

```python
import requests

NOTION_TOKEN = "secret_..."
DATABASE_ID = "your-database-uuid"

headers = {
    "Authorization": f"Bearer {NOTION_TOKEN}",
    "Notion-Version": "2025-09-03",
    "Content-Type": "application/json",
}

def query_database(filters=None, sorts=None):
    pages = []
    body = {"page_size": 100}
    if filters:
        body["filter"] = filters
    if sorts:
        body["sorts"] = sorts

    while True:
        resp = requests.post(
            f"https://api.notion.com/v1/databases/{DATABASE_ID}/query",
            headers=headers,
            json=body,
        )
        resp.raise_for_status()
        data = resp.json()
        pages.extend(data["results"])
        if not data["has_more"]:
            break
        body["start_cursor"] = data["next_cursor"]
    return pages

# Example: all high-priority open tasks due this week
results = query_database(
    filters={
        "and": [
            {"property": "Status", "select": {"equals": "In Progress"}},
            {"property": "Priority", "select": {"equals": "High"}},
            {"property": "Due Date", "date": {"next_week": {}}},
        ]
    },
    sorts=[{"property": "Due Date", "direction": "ascending"}],
)
```

---

### 3. Update page properties

```bash
curl -X PATCH https://api.notion.com/v1/pages/page-uuid \
  -H "Authorization: Bearer secret_..." \
  -H "Notion-Version: 2025-09-03" \
  -H "Content-Type: application/json" \
  -d '{
    "properties": {
      "Status": { "select": { "name": "Done" } },
      "Due Date": { "date": { "start": "2026-03-20" } }
    }
  }'
```

To archive (move to trash) a page:

```bash
curl -X PATCH https://api.notion.com/v1/pages/page-uuid \
  -H "Authorization: Bearer secret_..." \
  -H "Notion-Version: 2025-09-03" \
  -H "Content-Type: application/json" \
  -d '{ "in_trash": true }'
```

---

### 4. Create a page with rich content (blocks)

```python
blocks = [
    {
        "type": "heading_1",
        "heading_1": {
            "rich_text": [{"type": "text", "text": {"content": "Incident Runbook"}}]
        },
    },
    {
        "type": "callout",
        "callout": {
            "rich_text": [{"type": "text", "text": {"content": "P1 — all hands"}}],
            "icon": {"emoji": "🚨"},
            "color": "red_background",
        },
    },
    {
        "type": "heading_2",
        "heading_2": {
            "rich_text": [{"type": "text", "text": {"content": "Checklist"}}]
        },
    },
    {
        "type": "to_do",
        "to_do": {
            "rich_text": [{"type": "text", "text": {"content": "Acknowledge alert in PagerDuty"}}],
            "checked": False,
        },
    },
    {
        "type": "to_do",
        "to_do": {
            "rich_text": [{"type": "text", "text": {"content": "Notify #incidents Slack channel"}}],
            "checked": False,
        },
    },
    {
        "type": "code",
        "code": {
            "rich_text": [{"type": "text", "text": {"content": "kubectl get pods -n production"}}],
            "language": "shell",
        },
    },
]

response = requests.post(
    "https://api.notion.com/v1/pages",
    headers=headers,
    json={
        "parent": {"page_id": "parent-page-uuid"},
        "properties": {
            "title": [{"text": {"content": "Incident: DB latency spike 2026-03-02"}}]
        },
        "children": blocks,
    },
)
page = response.json()
print(page["url"])
```

**Limits:** Max 100 blocks per `children` array in a single request. For longer pages, create the page first then append in batches (Recipe #5).

---

### 5. Append blocks to an existing page

```python
def append_blocks(page_id: str, blocks: list, batch_size: int = 100) -> None:
    """Append blocks in batches of up to 100."""
    for i in range(0, len(blocks), batch_size):
        batch = blocks[i : i + batch_size]
        resp = requests.patch(
            f"https://api.notion.com/v1/blocks/{page_id}/children",
            headers=headers,
            json={"children": batch},
        )
        resp.raise_for_status()
```

Use `"after": "block-uuid"` in the request body to insert at a specific position instead of at the end.

---

### 6. Read all blocks from a page (recursive)

```python
def get_all_blocks(block_id: str) -> list:
    """Fetch all blocks recursively, handling pagination and nesting."""
    blocks = []
    params = {"page_size": 100}
    while True:
        resp = requests.get(
            f"https://api.notion.com/v1/blocks/{block_id}/children",
            headers=headers,
            params=params,
        )
        resp.raise_for_status()
        data = resp.json()
        for block in data["results"]:
            blocks.append(block)
            if block.get("has_children"):
                block["children"] = get_all_blocks(block["id"])
        if not data["has_more"]:
            break
        params["start_cursor"] = data["next_cursor"]
    return blocks
```

**Note:** Notion does NOT return nested block content automatically — you must recurse for every block with `has_children: true`.

---

### 7. Search for pages and databases

```python
def search_notion(query: str, filter_type: str = None) -> list:
    """
    filter_type: "page" | "database" | None (returns both)
    Searches titles only — does not full-text search page content.
    """
    body = {"query": query, "page_size": 100}
    if filter_type:
        body["filter"] = {"value": filter_type, "property": "object"}

    results = []
    while True:
        resp = requests.post(
            "https://api.notion.com/v1/search",
            headers=headers,
            json=body,
        )
        resp.raise_for_status()
        data = resp.json()
        results.extend(data["results"])
        if not data["has_more"]:
            break
        body["start_cursor"] = data["next_cursor"]
    return results
```

**Important:** Search only covers pages and databases **shared with your integration**. Content inside pages (block text) is not indexed by the search endpoint.

---

### 8. Incremental sync — pages modified since last run

```python
from datetime import datetime, timezone

def get_modified_pages(database_id: str, since: datetime) -> list:
    """Fetch all database rows edited after `since`."""
    return query_database(
        filters={
            "timestamp": "last_edited_time",
            "last_edited_time": {
                "after": since.isoformat().replace("+00:00", "Z")
            },
        },
        sorts=[{"timestamp": "last_edited_time", "direction": "ascending"}],
    )

# Example — pull everything modified in the last hour
since = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
pages = get_modified_pages("your-database-uuid", since)
```

---

### 9. List workspace users

```bash
curl https://api.notion.com/v1/users \
  -H "Authorization: Bearer secret_..." \
  -H "Notion-Version: 2025-09-03"
```

Response includes `type: "person"` (workspace members) and `type: "bot"` (integrations). The `person` type includes `person.email` only if your integration has the **Read user email addresses** capability.

---

### 10. Retrieve a page and read its properties

```python
resp = requests.get(
    f"https://api.notion.com/v1/pages/{page_id}",
    headers=headers,
)
page = resp.json()

# Extract title (works for any database page)
title_prop = next(
    v for v in page["properties"].values() if v["type"] == "title"
)
title = "".join(rt["plain_text"] for rt in title_prop["title"])

# Read a select property
status = page["properties"].get("Status", {}).get("select", {}).get("name")

# Read a date property
due_date = page["properties"].get("Due Date", {}).get("date", {}).get("start")
```

---

## Query patterns & filtering

### Filter structure

Filters are composed of **property filters** (test a specific property) combined with `"and"` / `"or"` arrays:

```json
{
  "filter": {
    "and": [
      {
        "property": "Status",
        "select": { "equals": "In Progress" }
      },
      {
        "or": [
          { "property": "Priority", "select": { "equals": "High" } },
          { "property": "Priority", "select": { "equals": "Critical" } }
        ]
      }
    ]
  }
}
```

### Property filter operators by type

| Property type | Operators |
|---------------|-----------|
| `rich_text` | `equals`, `does_not_equal`, `contains`, `does_not_contain`, `starts_with`, `ends_with`, `is_empty`, `is_not_empty` |
| `number` | `equals`, `does_not_equal`, `greater_than`, `less_than`, `greater_than_or_equal_to`, `less_than_or_equal_to`, `is_empty`, `is_not_empty` |
| `select` | `equals`, `does_not_equal`, `is_empty`, `is_not_empty` |
| `multi_select` | `contains`, `does_not_contain`, `is_empty`, `is_not_empty` |
| `date` | `equals`, `before`, `after`, `on_or_before`, `on_or_after`, `is_empty`, `is_not_empty`, `past_week`, `past_month`, `past_year`, `next_week`, `next_month`, `next_year` |
| `checkbox` | `equals` (true/false) |
| `people` | `contains`, `does_not_contain`, `is_empty`, `is_not_empty` |
| `relation` | `contains`, `does_not_contain`, `is_empty`, `is_not_empty` |
| `files` | `is_empty`, `is_not_empty` |

### Timestamp filters (not a property — built-in page timestamps)

```json
{
  "filter": {
    "timestamp": "last_edited_time",
    "last_edited_time": { "after": "2026-03-01T00:00:00Z" }
  }
}
```

Use `"timestamp": "created_time"` or `"last_edited_time"`.

### Sorts

```json
{
  "sorts": [
    { "property": "Due Date", "direction": "ascending" },
    { "property": "Priority", "direction": "descending" }
  ]
}
```

Sort by timestamp: `{ "timestamp": "last_edited_time", "direction": "descending" }`.

### Pagination

| Parameter | Default | Max | Notes |
|-----------|---------|-----|-------|
| `page_size` | 100 | 100 | Maximum is 100 for database queries and block children |
| `start_cursor` | — | — | Value of `next_cursor` from the previous response |
| `has_more` | — | — | `false` when there are no more pages |

Always paginate using `start_cursor` + `has_more` — do not assume 100 results means there are more.

---

## Reliability: rate limits, retries, idempotency

### Rate limits

| Limit | Value | Notes |
|-------|-------|-------|
| Global | **3 req/sec average** | Burst above this is allowed; sustained throughput is ~3/sec |
| Response on limit | HTTP `429`, code `"rate_limited"` | |
| Backoff header | `Retry-After` (integer seconds) | Always honour this value |

There is no separate rate limit per endpoint — it's a single workspace-level budget.

### Retry with exponential backoff

```python
import time
import requests

def notion_request(method: str, url: str, **kwargs) -> dict:
    headers = kwargs.pop("headers", {})
    headers.update({
        "Authorization": f"Bearer {NOTION_TOKEN}",
        "Notion-Version": "2025-09-03",
        "Content-Type": "application/json",
    })
    for attempt in range(5):
        resp = requests.request(method, url, headers=headers, **kwargs)
        if resp.status_code == 429:
            wait = int(resp.headers.get("Retry-After", 2 ** attempt))
            time.sleep(wait)
            continue
        if resp.status_code in (500, 502, 503, 504):
            time.sleep(2 ** attempt)
            continue
        resp.raise_for_status()
        return resp.json()
    raise RuntimeError(f"Failed after 5 attempts: {url}")
```

### Request size limits

| Limit | Value |
|-------|-------|
| Blocks per request (`children` array) | 100 |
| Total request payload | 500 KB |
| Rich text field | 2,000 characters |
| URL / email / phone_number fields | 2,000 / 200 / 200 characters |
| Multi-select options | 100 |
| Relation links | 100 per property |
| People mentions per property | 100 |

### Idempotency

The Notion API does **not** provide an idempotency key mechanism. To avoid duplicate pages, query the database first (filter on a unique external ID stored in a `rich_text` or `url` property) before creating:

```python
def upsert_page(database_id: str, external_id: str, properties: dict) -> dict:
    existing = query_database(
        filters={"property": "External ID", "rich_text": {"equals": external_id}}
    )
    if existing:
        page_id = existing[0]["id"]
        return notion_request("PATCH", f"https://api.notion.com/v1/pages/{page_id}", json={"properties": properties})
    return notion_request("POST", "https://api.notion.com/v1/pages", json={
        "parent": {"database_id": database_id},
        "properties": {**properties, "External ID": {"rich_text": [{"text": {"content": external_id}}]}},
    })
```

---

## Error handling & troubleshooting

### Error object structure

```json
{
  "object": "error",
  "status": 404,
  "code": "object_not_found",
  "message": "Could not find database with ID: a1b2c3d4-..."
}
```

### Status → code → action

| Status | Code | Meaning | Fix |
|--------|------|---------|-----|
| 400 | `invalid_json` | Request body is not valid JSON | Check JSON encoding; ensure `Content-Type: application/json` |
| 400 | `invalid_request_url` | URL is malformed | Verify endpoint path and UUID format |
| 400 | `invalid_request` | Operation not supported | Read the API docs for this endpoint |
| 400 | `validation_error` | Parameter shape is wrong | Check `message` for the specific field; verify property type JSON |
| 400 | `missing_version` | `Notion-Version` header absent | Add `Notion-Version: 2025-09-03` to all requests |
| 401 | `unauthorized` | Token invalid or expired | Verify token prefix (`secret_` or `ntn_`); check it wasn't revoked |
| 403 | `restricted_resource` | Integration lacks capability | Add the required capability in notion.so/my-integrations |
| 404 | `object_not_found` | Page/DB not found or not shared | Share the page/database with your integration in Notion UI |
| 409 | `conflict_error` | Concurrent write collision | Retry the request; consider optimistic locking with `last_edited_time` |
| 429 | `rate_limited` | Too many requests | Wait `Retry-After` seconds; use exponential backoff |
| 500 | `internal_server_error` | Notion server error | Retry with backoff; check https://status.notion.so |
| 503 | `service_unavailable` | Notion offline or request timed out (60s limit) | Retry; break up large block payloads |
| 503 | `database_connection_unavailable` | Notion DB unreachable | Retry with backoff |
| 504 | `gateway_timeout` | Request processing timed out | Reduce payload size; retry |

### Common issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| `object_not_found` on a valid ID | Integration not shared with the page | Open page in Notion → … → Connections → add integration |
| `restricted_resource` on read | Integration missing "Read content" capability | Edit integration at notion.so/my-integrations |
| `validation_error` on property write | Wrong JSON structure for property type | Copy exact write structure from Key concepts section |
| Empty `results` array from query | Database not shared, or filter matches nothing | Check sharing first; test with no filter |
| `missing_version` on every request | `Notion-Version` header not set | Add header; if using a framework, set it as a default |
| Blocks truncated | Response only returns first level | Recurse on `has_children: true` blocks |
| New page missing in search | Search indexes with a delay | Wait a few seconds; query the database directly for freshness |
| 503 on large page create | Request payload > 500 KB or > 100 blocks | Split into create + append batches |

---

## Security & compliance

### Token storage

- Store integration tokens in environment variables or a secrets manager — never hardcode in source.
- Internal integration secrets (`secret_...`) have no expiry — rotate them manually in notion.so/my-integrations if compromised.
- OAuth access tokens (`ntn_...`) may expire depending on workspace settings — implement refresh logic if building a public integration.

### Least-privilege capabilities

Only enable the capabilities your integration actually needs:

| Use case | Required capabilities |
|----------|----------------------|
| Read-only reporting / sync | Read content only |
| Creating pages / blocks | Read content + Insert content |
| Updating existing pages | Read content + Update content |
| User lookup (names only) | Read user information (no email) |
| User lookup with emails | Read user email addresses |

### Data access scope

Notion integrations only access what is explicitly shared with them. A page or database must be shared with the integration before the API can see it — there is no "access all workspace content" mode for internal integrations. This is a security feature: scope access narrowly by sharing only the databases your automation needs.

### PII considerations

Notion databases often hold PII (names, emails, phone numbers). Ensure:
- API responses containing PII are not logged in plaintext.
- Access tokens are scoped to only the databases needed.
- Data written to Notion from external sources is sanitised (rich text supports no HTML injection risk, but verify URL fields).

### Audit trail

All integration activity is visible in **Notion → Settings → Connections** (workspace owners). Use meaningful integration names (e.g., "CRM Sync Bot") so admins can identify the source of changes.

---

## Testing checklist

### Setup for testing

1. Create a test workspace (free plan) or a test section in your workspace.
2. Create an internal integration at notion.so/my-integrations.
3. Create a test database and share it with the integration.
4. Store the integration token and database ID in environment variables.

### QA checklist

- [ ] `GET /v1/users/me` returns the bot user with correct name → confirms token is valid
- [ ] `POST /v1/pages` with a `title` property creates a row in the test database
- [ ] `POST /v1/databases/{id}/query` returns the newly created page
- [ ] `POST /v1/databases/{id}/query` with a `select` filter returns only matching pages
- [ ] `POST /v1/databases/{id}/query` with `page_size=1` returns `has_more: true`; cursor retrieves next page
- [ ] `PATCH /v1/pages/{id}` updates a `select` property; `GET` confirms new value
- [ ] `PATCH /v1/pages/{id}` with `"in_trash": true` removes page; subsequent `GET` returns archived page
- [ ] `PATCH /v1/blocks/{id}/children` appends a paragraph block; `GET /v1/blocks/{id}/children` returns it
- [ ] `POST /v1/search` with `query: "<page title>"` finds the test page
- [ ] Request sent without `Notion-Version` header returns `400` with code `missing_version`
- [ ] Request to a page not shared with integration returns `404` with code `object_not_found`
- [ ] Rapid requests (>3/sec) trigger `429`; `Retry-After` header is present; retry succeeds
- [ ] Payload with 101 blocks in `children` returns `validation_error`
- [ ] Upsert pattern: create, then call upsert again with same external ID → updates, does not duplicate

---

## Sources

- [Notion API Reference — Introduction](https://developers.notion.com/reference/intro)
- [Notion Versioning (current: 2025-09-03)](https://developers.notion.com/reference/versioning)
- [Upgrade Guide: 2025-09-03](https://developers.notion.com/docs/upgrade-guide-2025-09-03)
- [Authentication](https://developers.notion.com/reference/authentication)
- [Create a Page](https://developers.notion.com/reference/post-page)
- [Retrieve a Page](https://developers.notion.com/reference/retrieve-a-page)
- [Update Page Properties](https://developers.notion.com/reference/patch-page)
- [Query a Database](https://developers.notion.com/reference/post-database-query)
- [Working with Databases](https://developers.notion.com/docs/working-with-databases)
- [Page Property Values](https://developers.notion.com/reference/page-property-values)
- [Block Object](https://developers.notion.com/reference/block)
- [Working with Page Content](https://developers.notion.com/docs/working-with-page-content)
- [Append Block Children](https://developers.notion.com/reference/patch-block-children)
- [Search](https://developers.notion.com/reference/post-search)
- [Request Limits (rate limits)](https://developers.notion.com/reference/request-limits)
- [Error Codes](https://developers.notion.com/reference/errors)
- [API Status](https://status.notion.so)
