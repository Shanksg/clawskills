# Monday.com Skill

> **Last validated:** 2026-05-11 | **API:** monday.com GraphQL API | **Current version:** `2026-04` (April 1, 2026)
> **Note:** monday.com uses GraphQL exclusively — not REST. All requests go to a single endpoint.
> **Versions:** RC=`2026-07` | Current=`2026-04` | Maintenance=`2026-01` | Deprecated: `2025-10`, `2025-01`, `2024-10` (routed to `2025-04` as of Feb 15, 2026)
>
> **⚠️ Changed 2026-04-01:** `2026-04` is now the stable Current version. If you were pinning `2026-01`, that version moved to Maintenance — bug fixes only, no new features. Plan migration before its deprecation window opens.

---

## What this skill enables

- Convert external events (form submissions, alerts, emails) into board items automatically, eliminating manual intake work.
- Keep cross-tool status synchronized by reading and writing Monday column values from any system.
- Log structured activity (updates/comments) against items for audit trails and @mention notifications.
- Trigger downstream automations when column values change, without polling.
- Build approval workflows by updating status columns and notifying assignees programmatically.
- Manage project data at scale: create, search, move, and bulk-update items across boards and groups.
- Extract board/item data for reporting pipelines and dashboards.

---

## Best-fit use cases

| Use case | Why it matters | Primary objects/entities | Typical trigger | Success criteria |
|----------|---------------|--------------------------|-----------------|------------------|
| Intake form → item creation | Eliminates manual ticket creation from email or spreadsheets | Board, Group, Item, Column values | Form submission / webhook from external tool | Item created in correct group with all fields populated |
| Status sync from external system | Keeps project board accurate without manual updates | Item, Status column | External system state change | Status column value updated; item assignee notified |
| Approval workflow tracking | Centralized visibility on approvals without email chains | Item, Status column (Approved/Rejected/Pending) | Approval request submitted | Approver notified; status updated on decision |
| Cross-board project reporting | Aggregate progress across multiple boards | Board, Item, Group | Scheduled report job | All items fetched with column values; exported to BI tool |
| Incident escalation board | Ops team needs high-visibility board for P1/P2 issues | Board, Item | ServiceNow/PagerDuty alert | Item created with priority, assignee, and SLA due date |
| Sprint/project tracking | Sync delivery status from Jira to Monday visibility board | Board, Item, Status, Date | Jira issue status change | Monday item status and dates match Jira issue |
| Client onboarding automation | Auto-create onboarding project items when deal closes in CRM | Board, Group, Item, People column | CRM deal closed-won event | Full item set created from template; client contact assigned |
| Resource allocation tracking | Know who is over/under-allocated across projects | Item, People column, Timeline column | Weekly schedule review | People columns updated with current assignments |
| Task dependency management | Block downstream work until prerequisites are complete | Item, dependency column | Item status change | Dependency chain reflected correctly |
| SLA / due date tracking | Catch approaching deadlines before they breach | Item, Date column | Scheduled daily check | Items with due dates within 24h surfaced and notified |
| Subitem management for complex tasks | Break large deliverables into trackable subtasks | Item, Subitem | Project kickoff | Subitems created under parent; assignees set |
| Form-to-CRM handoff | Enrich Monday items with CRM data after intake | Item, column values | Item created event | CRM fields (account, contact ID) written back to item |

---

## Key concepts & data model

### Core objects

| Object | Description | Identified by |
|--------|-------------|---------------|
| **Board** | Container for items; has columns and groups | Integer `id` (e.g., `1234567890`) |
| **Group** | Named section within a board (e.g., "This Week", "Done") | String `id` within a board (e.g., `"topics"`, `"new_group"`) |
| **Item** | The main record (row) on a board | Integer `id` |
| **Column** | A field definition on a board | String `id` within a board (e.g., `"status"`, `"date4"`, `"person"`) |
| **Column value** | The value of a column for a specific item | Embedded in item's `columnValues` array |
| **Update** | A comment/activity entry on an item | Integer `id`; belongs to an item |
| **Subitem** | An item nested under a parent item | Integer `id`; linked via `parent_item` |
| **User** | A monday.com account user | Integer `id`; referenced in people columns |
| **Workspace** | Top-level container for boards | Integer `id` |

### Column value types and JSON shapes

Column values are **not uniform** — each column type has a different JSON shape. This is the most common source of bugs.

```
Type: status
Write: { "label": "In Progress" }           # Use label text
Read:  { "label": "In Progress", "index": 1 }

Type: text
Write: "Some text value"                     # Plain string
Read:  "Some text value"

Type: numbers
Write: "42"                                  # String representation of number
Read:  "42"

Type: date
Write: { "date": "2026-03-15", "time": "10:00:00" }
Read:  { "date": "2026-03-15", "changed_at": "2026-01-01T..." }

Type: people
Write: { "personsAndTeams": [{ "id": 12345678, "kind": "person" }] }
Read:  { "personsAndTeams": [{ "id": 12345678, "kind": "person" }] }

Type: dropdown
Write: { "labels": ["Option A", "Option B"] }
Read:  { "values": [{ "id": 1, "name": "Option A" }] }

Type: timeline
Write: { "from": "2026-03-01", "to": "2026-03-15" }
Read:  { "from": "2026-03-01", "to": "2026-03-15" }

Type: checkbox
Write: { "checked": "true" }                # String "true", not boolean
Read:  { "isChecked": true }

Type: link
Write: { "url": "https://example.com", "text": "Click here" }
Read:  { "url": "https://example.com", "text": "Click here" }

Type: email
Write: { "email": "user@example.com", "text": "User" }

Type: phone
Write: { "phone": "+15551234567", "countryShortName": "US" }
```

> **Pitfall:** Column IDs are set when the column is created and can be customized. Never assume `"status"` is the status column ID — always introspect the board's columns first.

### Relationships

```
Workspace
  └── Board (many per workspace)
        ├── Column definitions (schema)
        ├── Group (many per board)
        │     └── Item (many per group)
        │           ├── Column values
        │           ├── Update (comments)
        │           └── Subitem (nested items)
        └── Webhook (board-level)
```

---

## Authentication & permissions

### Supported auth methods

| Method | Use case | How to obtain |
|--------|----------|---------------|
| **Personal API Token** | Server-to-server, scripts, automations | Profile → Admin → API → Personal Token |
| **OAuth 2.0** | Multi-tenant apps, user-context | App registration at https://developer.monday.com |

### API endpoint

All requests (both auth methods) go to:
```
POST https://api.monday.com/v2
Content-Type: application/json
Authorization: Bearer {token}
```

Or with API version header (recommended — always pin a specific version):
```
API-Version: 2026-04
```

> **Important:** Always pin a version header in production. Without it, requests default to `Current`, which changes quarterly and can break your integration. Current as of 2026-05-11: `2026-04`.

### OAuth 2.0 scopes (least privilege)

| Scope | Purpose |
|-------|---------|
| `boards:read` | Read board structure and items |
| `boards:write` | Create/update items, columns |
| `updates:read` | Read comments/updates |
| `updates:write` | Post comments/updates |
| `users:read` | Read user info (for people columns) |
| `webhooks:write` | Register webhooks |
| `workspaces:read` | Read workspace info |

**Principle:** Request only `boards:read` for read-only integrations; add `boards:write` + `updates:write` for write operations.

### Token storage

- Store tokens in environment variables or a secrets manager (never in code).
- Personal API tokens do not expire but can be revoked from the UI.
- OAuth access tokens expire; use the refresh token to obtain new access tokens. Refresh tokens are long-lived but rotate on use.

### Multi-tenant

- Each monday.com account is isolated. Tokens are account-scoped.
- For multi-account apps, store a token per account and map `account_id` (returned in OAuth response) to the token.

---

## Common workflows (recipes)

### Recipe 1: Create an item in a specific board and group

**Goal:** Add a new row to a board with predefined column values.

**Preconditions:** Board ID and Group ID known; column IDs known.

**Steps:**
1. Query the board to confirm column IDs (one-time setup).
2. Send a `create_item` mutation with `column_values` JSON string.

```graphql
# Step 1 — discover column IDs (run once per board)
query {
  boards(ids: [1234567890]) {
    columns {
      id
      title
      type
    }
    groups {
      id
      title
    }
  }
}
```

```bash
# Step 2 — create item
curl -s -X POST https://api.monday.com/v2 \
  -H "Authorization: Bearer $MONDAY_TOKEN" \
  -H "Content-Type: application/json" \
  -H "API-Version: 2026-04" \
  -d '{
    "query": "mutation ($boardId: ID!, $groupId: String!, $itemName: String!, $colVals: JSON!) { create_item(board_id: $boardId, group_id: $groupId, item_name: $itemName, column_values: $colVals) { id name } }",
    "variables": {
      "boardId": "1234567890",
      "groupId": "topics",
      "itemName": "New Support Request",
      "colVals": "{\"status\": {\"label\": \"New\"}, \"date4\": {\"date\": \"2026-03-15\"}, \"person\": {\"personsAndTeams\": [{\"id\": 98765432, \"kind\": \"person\"}]}}"
    }
  }'
```

**Response:**
```json
{ "data": { "create_item": { "id": "9876543210", "name": "New Support Request" } } }
```

**Edge cases:**
- `column_values` must be a JSON string, not a JSON object — stringify it before embedding.
- If the group ID doesn't exist, Monday returns a generic error. Validate group IDs from Step 1.
- If a required column has no value, Monday accepts the item but the column is blank (no error).

**Validation:** Query the returned item ID and verify column values are set correctly.

---

### Recipe 2: Read/search items on a board

**Goal:** Fetch items matching criteria (e.g., status = "In Progress").

**Preconditions:** Board ID known; column ID for the filter column known.

```graphql
query {
  boards(ids: [1234567890]) {
    items_page(limit: 50, cursor: null, query_params: {
      rules: [{ column_id: "status", compare_value: ["1"] }]
    }) {
      cursor
      items {
        id
        name
        group { id title }
        column_values {
          id
          text
          value
        }
        updated_at
      }
    }
  }
}
```

**Pagination:** The response includes a `cursor` value. Pass it as `cursor: "abc123"` in the next request until `cursor` is `null`.

```bash
curl -s -X POST https://api.monday.com/v2 \
  -H "Authorization: Bearer $MONDAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query ($board: ID!, $cursor: String) { boards(ids: [$board]) { items_page(limit: 50, cursor: $cursor) { cursor items { id name updated_at column_values { id text value } } } } }",
    "variables": { "board": "1234567890", "cursor": null }
  }'
```

**Edge cases:**
- `compare_value` for status is the numeric index of the label, not the label string. Look up the index via board column settings.
- `items_page` replaces the deprecated `items` field. Use `items_page` for production.

---

### Recipe 3: Update a column value on an existing item

**Goal:** Change a status column to "Done" when external task completes.

```bash
curl -s -X POST https://api.monday.com/v2 \
  -H "Authorization: Bearer $MONDAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation ($itemId: ID!, $boardId: ID!, $colId: String!, $val: JSON!) { change_column_value(item_id: $itemId, board_id: $boardId, column_id: $colId, value: $val) { id } }",
    "variables": {
      "itemId": "9876543210",
      "boardId": "1234567890",
      "colId": "status",
      "val": "{\"label\": \"Done\"}"
    }
  }'
```

**Multiple columns at once** (preferred — fewer API calls):
```graphql
mutation {
  change_multiple_column_values(
    item_id: 9876543210,
    board_id: 1234567890,
    column_values: "{\"status\": {\"label\": \"Done\"}, \"date4\": {\"date\": \"2026-02-19\"}}"
  ) { id }
}
```

**Validation:** Re-query the item and check `column_values` to confirm the update took effect.

---

### Recipe 4: Add an update (comment) to an item

**Goal:** Post a structured activity log entry or @mention notification.

```bash
curl -s -X POST https://api.monday.com/v2 \
  -H "Authorization: Bearer $MONDAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation ($itemId: ID!, $body: String!) { create_update(item_id: $itemId, body: $body) { id } }",
    "variables": {
      "itemId": "9876543210",
      "body": "Status synced from Jira. Ticket JRA-4521 transitioned to Done at 2026-02-19T14:32:00Z."
    }
  }'
```

**Edge cases:**
- HTML is supported in `body` for formatting.
- To @mention a user: `"body": "Hey <a href=\"profile/12345678\">@Username</a>, this is ready for review."`
- Updates cannot be edited via API — only deleted and re-created.

---

### Recipe 5: Upload a file to an item

**Goal:** Attach a file to an item (e.g., report PDF, screenshot).

Monday file uploads use multipart form data with a GraphQL query embedded.

```bash
curl -s -X POST https://api.monday.com/v2/file \
  -H "Authorization: Bearer $MONDAY_TOKEN" \
  -F 'query=mutation ($file: File!) { add_file_to_update(update_id: 1122334455, file: $file) { id } }' \
  -F 'variables={"file": null}' \
  -F 'map={"file": ["variables.file"]}' \
  -F 'file=@/path/to/report.pdf'
```

To attach directly to an item column (file column):
```bash
-F 'query=mutation ($file: File!) { add_file_to_column(item_id: 9876543210, column_id: "files", file: $file) { id } }'
```

**Pitfall:** The file upload endpoint is `/v2/file`, not `/v2`. Using the wrong endpoint returns a 404.

---

### Recipe 6: Register a webhook for item status changes

**Goal:** Receive push notifications when items change status (avoid polling).

```bash
curl -s -X POST https://api.monday.com/v2 \
  -H "Authorization: Bearer $MONDAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation ($boardId: ID!, $url: String!, $event: WebhookEventType!) { create_webhook(board_id: $boardId, url: $url, event: $event) { id board_id } }",
    "variables": {
      "boardId": "1234567890",
      "url": "https://your-server.example.com/monday-webhook",
      "event": "change_column_value"
    }
  }'
```

**Available webhook events:**
- `create_item`, `change_name`, `change_column_value`, `change_status_column_value`
- `create_update`, `delete_update`
- `create_subitem`, `change_subitem_column_value`

**Webhook payload example (column change):**
```json
{
  "event": {
    "type": "change_column_value",
    "boardId": 1234567890,
    "groupId": "topics",
    "itemId": 9876543210,
    "columnId": "status",
    "previousValue": { "label": "In Progress", "index": 1 },
    "value": { "label": "Done", "index": 7 },
    "userId": 12345678,
    "changedAt": 1708357200
  }
}
```

**Validation:** Respond with HTTP 200 within 5 seconds. Monday retries on non-200.

**Security:** Validate the `Authorization` header in the incoming request (Monday sends a secret header if configured during webhook creation — use the `config` parameter).

---

### Recipe 7: Bulk-create items (multiple mutations in one request)

**Goal:** Create 10–50 items in one API call.

Monday supports multiple named mutations in a single GraphQL request:

```graphql
mutation {
  item1: create_item(board_id: 1234567890, group_id: "topics", item_name: "Task A",
    column_values: "{\"status\": {\"label\": \"New\"}}") { id }
  item2: create_item(board_id: 1234567890, group_id: "topics", item_name: "Task B",
    column_values: "{\"status\": {\"label\": \"New\"}}") { id }
  item3: create_item(board_id: 1234567890, group_id: "topics", item_name: "Task C",
    column_values: "{\"status\": {\"label\": \"New\"}}") { id }
}
```

**Complexity consideration:** Each `create_item` mutation costs ~2 complexity points. A single request can include many mutations, but stay under the per-request complexity limit (10,000 points max per query by default).

**For large batches (>50 items):** Split into multiple requests and sleep 1–2s between batches to avoid hitting the per-minute complexity budget.

---

### Recipe 8: Move an item to a different group

**Goal:** Represent a stage change by moving an item to a different group (e.g., "Backlog" → "In Progress").

```graphql
mutation {
  move_item_to_group(item_id: 9876543210, group_id: "in_progress_group") {
    id
  }
}
```

**Validation:** Query the item and verify `group.id` matches the target group.

---

## Query patterns & filtering

### Searching items

```graphql
# Search by text across item names (global search)
query {
  items_by_name_or_column(board_id: 1234567890, column_type: text, column_value: "customer name") {
    id name
  }
}

# Filter by column value using items_page query_params
query {
  boards(ids: [1234567890]) {
    items_page(limit: 50, query_params: {
      rules: [
        { column_id: "status", compare_value: ["1"], operator: any_of },
        { column_id: "date4", compare_value: ["2026-02-01"], compare_attribute: "from", operator: greater_than_or_equals }
      ],
      operator: and
    }) {
      cursor
      items { id name updated_at }
    }
  }
}
```

### Pagination

Use cursor-based pagination with `items_page`:
```
page 1: items_page(limit: 50, cursor: null)          → returns cursor "abc123"
page 2: items_page(limit: 50, cursor: "abc123")      → returns cursor "def456"
...until cursor is null (last page)
```

### Incremental sync (items updated since timestamp)

```graphql
query {
  boards(ids: [1234567890]) {
    items_page(limit: 50, query_params: {
      rules: [{ column_id: "__last_updated__", compare_value: ["2026-02-18"], operator: greater_than }]
    }) {
      cursor
      items { id name updated_at }
    }
  }
}
```

### Handling duplicates

- Monday does not prevent duplicate item names. Use a dedicated text column (e.g., `external_id`) to store the originating system's ID.
- Before creating, search by that column value: if found, update the existing item; if not, create new.

---

## Reliability: rate limits, retries, idempotency

### Rate limits (verified 2026-02-19)

Monday.com uses **complexity points** for query weight limits, plus separate per-minute query caps, daily call limits, and concurrency limits.

#### Complexity budget (per minute)

| Token type | Complexity limit / min |
|-----------|----------------------|
| Personal API tokens (paid plans) | **10,000,000 points** |
| Personal API tokens (free/trial/NGO) | 1,000,000 points |
| App tokens | 5,000,000 points per app |
| Single query max | 5,000,000 points |

Simple item creation ≈ 2–5 points. A deeply nested query (items + column values + updates + subitems) can cost 500–5,000 points. Use the `complexity` field in your query to measure cost before going to production:

```graphql
query {
  complexity { before after query reset_in_x_seconds }
  boards(ids: [1234567890]) { items_page(limit: 50) { items { id name } } }
}
```

#### Per-minute query limits (request count, not complexity)

| Plan | Queries/minute |
|------|---------------|
| Enterprise | 5,000 |
| Pro | 2,500 |
| Basic / Standard | 1,000 |

Error when exceeded: `Minute limit rate exceeded`

#### Daily call limits (resets midnight UTC)

| Plan | Daily limit | Type |
|------|------------|------|
| Free / Trial | 200 | Hard |
| Basic / Standard | 1,000 | Hard |
| Pro | 10,000 | Soft |
| Enterprise | 25,000 | Soft |

Error when exceeded: `DAILY_LIMIT_EXCEEDED`

#### Concurrency limits

| Plan | Max concurrent requests |
|------|------------------------|
| Enterprise | 250 |
| Pro | 100 |
| Basic / Standard | 40 |

#### IP rate limit

5,000 requests per 10 seconds per IP address. Error: `IP_RATE_LIMIT_EXCEEDED`

### Backoff strategy

Monday returns rate limit errors as HTTP 200 with errors in the GraphQL `errors[]` array, **not** as HTTP 429 (though 429 can occur for IP limits). Check both:

```python
import time
import requests

def monday_request(payload, headers, max_retries=5):
    for attempt in range(max_retries):
        resp = requests.post("https://api.monday.com/v2", json=payload, headers=headers)

        # IP-level rate limit (HTTP 429)
        if resp.status_code == 429:
            retry_after = int(resp.headers.get("Retry-After", 10))
            time.sleep(retry_after)
            continue

        data = resp.json()
        errors = data.get("errors", [])
        if errors:
            error_msg = str(errors)
            # Complexity or minute-limit exhausted — wait for reset
            if "ComplexityException" in error_msg or "Minute limit" in error_msg:
                retry_in = None
                for err in errors:
                    retry_in = err.get("extensions", {}).get("retry_in_seconds")
                    if retry_in:
                        break
                time.sleep(float(retry_in) if retry_in else 10)
                continue
            # Daily limit — don't retry until reset at midnight UTC
            if "DAILY_LIMIT_EXCEEDED" in error_msg:
                raise Exception("Daily API limit reached. Retry after midnight UTC.")
            raise Exception(f"GraphQL errors: {errors}")

        return data
    raise Exception("Max retries exceeded")
```

### Idempotency

- Monday has no native idempotency keys.
- **Pattern:** Store the Monday item ID in your source system after creation. Before creating, check if an ID is already stored → skip creation if so.
- For updates: always read the current value before writing — skip the write if the value is already correct (saves complexity points).

### Concurrency

No ETag/version conflict system. Last write wins. For concurrent updates to the same item, serialize writes or use distributed locking in your integration layer.

---

## Error handling & troubleshooting

### Common errors

| Error / Code | Meaning | Fix |
|-------------|---------|-----|
| `ComplexityException` | Per-minute complexity budget exceeded | Use `retry_in_seconds` from error extensions; reduce query depth |
| `DAILY_LIMIT_EXCEEDED` | Daily call limit reached | Wait until midnight UTC; upgrade plan if recurring |
| `Minute limit rate exceeded` | Per-minute query count exceeded | Back off 60s; reduce request frequency |
| `IP_RATE_LIMIT_EXCEEDED` | IP-level limit (5,000 req/10s) | Distribute load across IPs or reduce burst rate |
| `UserUnauthorizedException` | Token lacks required scope | Re-authenticate with correct scopes |
| `InvalidBoardIdException` | Board ID doesn't exist or not accessible | Verify board ID; check token account |
| `InvalidColumnIdException` | Column ID doesn't exist on this board | Re-introspect board columns |
| `InvalidValueException` | Column value JSON shape is wrong | Check the column type and fix the JSON shape |
| HTTP 429 | Rate limited | Respect `X-RateLimit-Reset` header and back off |
| HTTP 500 | Monday internal error | Retry with exponential backoff (safe to retry) |
| `ColumnValueException` | Value violates column constraints | Check allowed labels/options for the column |

### "If you see X, do Y" playbook

- **Empty `data` with `errors` array:** Parse each error's `extensions.code` — do not treat the whole response as failure.
- **`null` item returned after create:** The item was created but a column value was invalid. Check `errors` field even when status is 200.
- **Webhook stops firing:** Check that the webhook endpoint returned 200. Monday disables webhooks after repeated failures. Re-create via API.
- **Column values return empty `text` field:** Request `value` instead of `text` — not all column types populate `text`.

### Debug logging

Log: request payload (sanitize token), response status, response `errors` array, `X-RateLimit-*` headers.
Do NOT log: Authorization token, `column_values` if they contain PII (email, phone, name fields).

---

## Security, privacy, compliance

- **PII in columns:** People columns store user IDs (not names/emails), but text/email/phone columns may store PII. Apply data minimization — only write PII columns when necessary.
- **Token scope:** Use the minimum scopes needed. Read-only integrations should never have `boards:write`.
- **Audit trail:** Monday's activity log (Updates) provides an audit trail per item. For compliance, prefer appending structured updates over overwriting column values.
- **Admin tokens:** Personal API tokens have the full permissions of the user who created them. Use a dedicated service account with restricted board access for integrations.
- **Data residency:** Monday.com offers EU data residency for Enterprise plans. Verify with the account admin before storing sensitive data.
- **Webhook secrets:** Always configure a webhook signing secret and verify it on inbound requests to prevent spoofing.

---

## Testing checklist

- [ ] **Auth test:** POST a `{ query: "{ me { id name } }" }` query — returns a valid user object.
- [ ] **CRUD test:** Create an item → read it back by ID → update a column → verify update → delete the item (or archive via `archive_item` mutation).
- [ ] **Pagination test:** Create 55+ items on a test board, then paginate through `items_page` and verify all are retrieved (cursor reaches `null`).
- [ ] **Rate limit test:** Send 100 rapid requests and verify 429 handling with `X-RateLimit-Reset` backoff.
- [ ] **Webhook test:** Register a webhook, change a column value, verify payload is received within 10s at your endpoint; verify HTTP 200 response suppresses retries.
- [ ] **Column type test:** Test each column type used in production (status, date, people, text, numbers) with valid and invalid JSON shapes.
- [ ] **Permission test:** Use a read-only scoped token and attempt a write mutation — expect `UserUnauthorizedException`.
- [ ] **Negative tests:**
  - Invalid board ID → `InvalidBoardIdException`
  - Wrong column value JSON → `InvalidValueException` or `ColumnValueException`
  - Revoked token → `UserUnauthorizedException`
  - Non-existent item ID → null response with error

---

## Sources

- Monday.com GraphQL API reference: https://developer.monday.com/api-reference/docs
- API Versioning (current version, lifecycle): https://developer.monday.com/api-reference/docs/api-versioning
- Rate limits (verified 2026-02-19): https://developer.monday.com/api-reference/docs/rate-limits
- Migrating to 2025-04 (deprecation of 2024-10, 2025-01): https://developer.monday.com/api-reference/docs/migrating-to-version-2025-04
- API Changelog: https://developer.monday.com/api-reference/changelog
- Column types and values: https://developer.monday.com/api-reference/docs/column-types-data-structure
- Webhooks: https://developer.monday.com/api-reference/docs/webhooks
- Authentication: https://developer.monday.com/api-reference/docs/authentication
- OAuth: https://developer.monday.com/apps/docs/oauth
- File uploads: https://developer.monday.com/api-reference/docs/file-column
- items_page query: https://developer.monday.com/api-reference/reference/items-page
