# Zendesk Skill

> **Last validated:** 2026-02-19 | **API:** Zendesk Support REST API v2
> **Base URL:** `https://{subdomain}.zendesk.com/api/v2/`
>
> **⚠️ Breaking changes since 2024:**
> - OAuth **implicit grant** and **password grant** flows **deprecated as of February 17, 2025** — use Authorization Code grant only.
> - `www.zopim.com/api/v2` (legacy Zopim Chat REST API) **retired February 28, 2025** — use `{subdomain}.zendesk.com/api/v2/chat` instead.
> - Old-style HTTP Target webhooks are superseded by the Webhooks API (`/api/v2/webhooks`) — migrate any remaining HTTP targets.

## What this skill enables

- Automate ticket lifecycle management (creation, routing, status updates, closure) from any external event source without manual agent intervention.
- Deliver consistent customer experiences by programmatically applying macros, triggers, and SLA policies across all channels.
- Sync customer and organization data bidirectionally between Zendesk and CRM/ERP systems, eliminating duplicate data entry and keeping support context accurate.
- Power real-time alerting and escalation workflows by consuming Zendesk webhooks to notify downstream systems the moment ticket state changes.
- Perform high-volume historical imports and bulk operations (mass re-assignment, bulk status change, bulk tagging) at scale without hitting trigger loops.
- Build self-serve analytics and reporting pipelines using the Incremental Export API to stream all ticket changes since a known point in time.
- Enforce compliance and audit requirements by capturing every public reply, internal note, and field change through structured activity records.

---

## Best-fit use cases

| Use case | Why it matters | Primary objects/entities | Typical trigger | Success criteria |
|---|---|---|---|---|
| Create ticket from external alert | Converts monitoring, billing, or form events into trackable support work without human triage | Ticket, User (requester), Organization | Webhook from PagerDuty / Stripe / web form | Ticket created with correct priority, requester, and custom fields |
| Auto-route ticket by skill or org | Ensures the right team sees the ticket immediately, reducing first-response time | Ticket, Group, User (assignee), Trigger | Ticket created or updated | Ticket assigned to correct group within seconds |
| Sync org & user data from CRM | Keeps account context (plan tier, ARR, CSM) accurate in Zendesk for agents | Organization, User | Nightly or event-driven CRM webhook | Zendesk org fields match CRM within defined SLA |
| Add internal note / agent handoff context | Preserves institutional knowledge so the next agent does not have to re-investigate | Ticket, Comment (internal) | Agent escalation or automation | Internal comment visible to agents only; not emailed to requester |
| Bulk close resolved tickets | Keeps the queue clean; removes stale tickets from SLA reporting | Ticket (bulk update) | Scheduled automation or manager request | All target tickets moved to solved/closed; audit log entry exists |
| Webhook-driven escalation to Slack/PagerDuty | Reduces MTTR by pushing critical ticket events to on-call channels | Webhook, Trigger, Ticket | Ticket priority set to Urgent | External system receives event payload within 30 seconds |
| Historical ticket import (migration) | Moves legacy data into Zendesk without polluting live queues or firing triggers | Ticket (import API) | One-time or periodic migration job | Tickets imported with original timestamps; triggers not fired |
| Custom field reporting pipeline | Enables business-specific metrics (product area, revenue impact) via structured data | Ticket Field, Ticket, custom_fields array | Nightly incremental export | All custom field values present in data warehouse within 24 hours |
| Merge duplicate tickets | Eliminates duplicate work and consolidates requester communication | Ticket (merge) | Agent identifies duplicates or automation rule | Source ticket linked; all future replies go to target ticket |
| Attachment collection for compliance | Archives all files submitted by customers for legal/compliance review | Attachment, Upload token, Ticket | Ticket solved or tagged for compliance | Attachments downloaded and stored in audit archive |
| Multi-brand ticket handling | Routes tickets to the correct brand inbox and applies brand-specific forms | Brand, Ticket Form, Ticket | Ticket submitted via brand-specific email/widget | Ticket form and brand ID match the submission channel |
| Proactive CSAT follow-up | Triggers satisfaction surveys and logs scores back to Zendesk for reporting | Ticket, Automation, custom_fields | Ticket solved for N hours | CSAT score written to custom field; survey sent once only |

---

## Key concepts & data model

### Core objects

| Object | Description | Key identifier |
|---|---|---|
| **Ticket** | The central work item representing a customer request | `id` (integer) |
| **User** | Any person in Zendesk: requester, submitter, assignee (agent), or end user | `id` (integer); role: `end-user`, `agent`, `admin` |
| **Organization** | Groups of users, typically a company account | `id` (integer) |
| **Group** | Collection of agents who share a queue | `id` (integer) |
| **Comment** | A reply or note on a ticket. `public: true` = customer-visible; `public: false` = internal note | part of Ticket `comments` array |
| **Attachment** | File linked to a comment via an upload token | `token` (string), then `id` after attach |
| **Ticket Field** | Built-in or custom field definition | `id` (integer); `type`: text, dropdown, checkbox, date, integer, decimal, regexp, tagger, lookup |
| **Ticket Form** | Ordered set of ticket fields presented to end users | `id` (integer) |
| **Brand** | A distinct support presence (subdomain, email, widget) | `id` (integer) |
| **Macro** | Reusable set of actions applied to a ticket manually by agents | `id` (integer) |
| **Trigger** | Condition-action rule that fires automatically on ticket create/update | `id` (integer) |
| **Automation** | Time-based condition-action rule | `id` (integer) |
| **View** | Saved ticket filter for agent queues | `id` (integer) |
| **Tag** | Freeform string label on tickets or users | string value |

### Ticket status flow

```
new → open → pending → on-hold → solved → closed
```

- **new**: ticket just created, not yet assigned or touched by an agent.
- **open**: agent is actively working it.
- **pending**: waiting on the requester.
- **on-hold**: waiting on a third party (not the requester).
- **solved**: agent marked resolved; CSAT survey can fire.
- **closed**: system-sealed after a configured period; cannot be re-opened. Replies to closed tickets create a new follow-up ticket.
- Only `solved` tickets can transition to `closed` (done by automation, not API directly).
- End users can re-open a `solved` ticket by replying within the configured window.

### Ticket custom fields

Custom field values live in the ticket's `custom_fields` array:

```json
"custom_fields": [
  { "id": 360001234567, "value": "billing" },
  { "id": 360001234568, "value": true }
]
```

Use `GET /api/v2/ticket_fields` to enumerate all field definitions and map `id` to `key`/`title`.

### Side-loading

Append `?include=users,organizations,groups` to most ticket endpoints to embed related objects in a single response, avoiding N+1 requests:

```
GET /api/v2/tickets/{id}?include=users,organizations
```

Response gains `users` and `organizations` arrays at the top level.

### Naming conventions

- All resource IDs are integers. Always store as 64-bit integers.
- Timestamps are ISO 8601 UTC strings (`created_at`, `updated_at`).
- Boolean fields use `true`/`false` (JSON), never `1`/`0`.
- Tag arrays are plain string arrays: `["vip", "billing", "q1-promo"]`.

---

## Authentication & permissions

### Supported auth methods

| Method | Format | When to use |
|---|---|---|
| **API Token + Email (Basic)** | `Authorization: Basic base64(email/token:API_TOKEN)` | Server-to-server integrations, scripts, automation |
| **OAuth 2.0 — Authorization Code** | Bearer token via Authorization Code flow | Multi-tenant apps, user-delegated access (only supported grant type now) |
| **Password auth / Implicit grant** | ~~Basic with real password~~ / ~~Implicit~~ | **Deprecated** — both removed Feb 17, 2025. Do not use. |

#### API Token (most common for integrations)

1. In Zendesk Admin Center: **Apps and integrations > APIs > Zendesk API > API token**.
2. Generate a token (shown once; store securely).
3. Encode `{email}/token:{api_token}` in Base64.

```bash
curl -u "agent@example.com/token:YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  "https://{subdomain}.zendesk.com/api/v2/tickets.json"
```

#### OAuth 2.0

- Register an OAuth client under **Admin Center > Apps > OAuth Clients**.
- Redirect URI must be HTTPS.
- Authorization endpoint: `https://{subdomain}.zendesk.com/oauth/authorizations/new`
- Token endpoint: `https://{subdomain}.zendesk.com/oauth/tokens`
- Scopes are space-separated strings (see below).

### Required OAuth scopes (least privilege)

| Scope | Grants |
|---|---|
| `read` | Read all resources (tickets, users, orgs, etc.) |
| `write` | Create and update tickets, comments, users, orgs |
| `tickets:read` | Read tickets only |
| `tickets:write` | Create/update tickets only |
| `users:read` | Read users |
| `users:write` | Create/update users |
| `organizations:read` | Read organizations |
| `organizations:write` | Create/update organizations |
| `hc:read` | Read Help Center articles |
| `hc:write` | Write Help Center articles |
| `webhooks:read` | Read webhook definitions |
| `webhooks:write` | Create/update/delete webhooks |

**Principle of least privilege**: Use `tickets:read tickets:write users:read` for a ticket-management integration rather than the blanket `read write` scopes.

### Token storage & rotation

- Store API tokens and OAuth secrets in a secrets manager (e.g., AWS Secrets Manager, HashiCorp Vault). Never in source code or environment variables in CI logs.
- OAuth access tokens do not expire by default in Zendesk unless the OAuth client is configured for refresh tokens. Configure token expiry and implement refresh flows for long-lived apps.
- Rotate API tokens on a schedule (quarterly minimum) or immediately after any exposure event.
- Audit token usage via **Admin Center > Apps and integrations > APIs > API token > Activity**.

### Multi-tenant considerations

- Each Zendesk account is identified by its subdomain (`{subdomain}.zendesk.com`). All API calls are scoped to one subdomain.
- For integrations serving multiple Zendesk accounts, implement per-tenant credential storage keyed by subdomain.
- Never share OAuth tokens across tenants.
- Respect per-account rate limits independently — one tenant hitting its limit does not affect another.

---

## Common workflows (recipes)

### Recipe 1: Create a ticket from an external event

**Goal**: Create a new support ticket when an external system (e.g., billing failure, monitoring alert) fires an event.

**Preconditions**: Valid API token or OAuth token with `tickets:write` and `users:read` scopes. Requester email known.

**Steps**:

1. Optionally look up or create the requester user by email:

```bash
curl -u "agent@example.com/token:TOKEN" \
  "https://{subdomain}.zendesk.com/api/v2/users/search.json?query=email:customer@example.com"
```

2. If user not found, create them (or let Zendesk create on ticket POST by providing `requester` object).

3. POST the ticket:

```bash
curl -X POST \
  -u "agent@example.com/token:TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ticket": {
      "subject": "Payment failed for account #12345",
      "comment": { "body": "Automatic alert: payment of $499 failed at 2026-02-19T08:00:00Z." },
      "requester": { "email": "customer@example.com", "name": "Jane Smith" },
      "priority": "high",
      "tags": ["billing", "auto-created"],
      "custom_fields": [
        { "id": 360001234567, "value": "billing" }
      ]
    }
  }' \
  "https://{subdomain}.zendesk.com/api/v2/tickets.json"
```

4. Parse the response for `ticket.id` and store it for future updates.

**Edge cases / pitfalls**:
- If you provide `requester.email` and the user already exists, Zendesk links automatically. No need to pre-create.
- If `subject` is missing, Zendesk uses the first line of the comment body — always provide it explicitly.
- Avoid sending PII (full card numbers, passwords) in the ticket body.

**Validation**: `HTTP 201 Created`. Confirm `ticket.id` is present and `ticket.status` is `new`.

---

### Recipe 2: Search and retrieve tickets

**Goal**: Find open billing tickets assigned to a specific group, for reporting or routing.

**Preconditions**: Token with `tickets:read`. Know the group ID.

**Steps**:

1. Use the Search API:

```bash
curl -u "agent@example.com/token:TOKEN" \
  "https://{subdomain}.zendesk.com/api/v2/search.json?query=type:ticket+status:open+group_id:12345+tags:billing&sort_by=created_at&sort_order=desc"
```

2. Iterate through `results` array. Paginate using `next_page` URL from response.

3. For incremental sync (polling for changes since last run), use the Incremental Export API instead:

```bash
curl -u "agent@example.com/token:TOKEN" \
  "https://{subdomain}.zendesk.com/api/v2/incremental/tickets.json?start_time=1708300800"
```

`start_time` is a Unix timestamp (seconds). Response includes `end_time` — store this as your next `start_time`.

4. To get a single ticket with related data:

```bash
curl -u "agent@example.com/token:TOKEN" \
  "https://{subdomain}.zendesk.com/api/v2/tickets/98765.json?include=users,organizations"
```

**Edge cases / pitfalls**:
- The Search API returns a maximum of 1000 results. For full exports, use the Incremental Export API.
- The Incremental Export API enforces a minimum `start_time` of 5 minutes in the past (to allow indexing).
- Search queries are URL-encoded; spaces become `+`.

**Validation**: Confirm `count` field in search response matches expected number. For incremental, confirm `end_time` advances on each call.

---

### Recipe 3: Update ticket status, priority, and assignee

**Goal**: Move a ticket to `pending` after sending a customer reply, and reassign it.

**Preconditions**: Token with `tickets:write`. Know `ticket_id` and `assignee_id`.

**Steps**:

1. PUT to the ticket endpoint:

```bash
curl -X PUT \
  -u "agent@example.com/token:TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ticket": {
      "status": "pending",
      "assignee_id": 445566,
      "priority": "normal",
      "comment": {
        "body": "Hi Jane, could you confirm the billing email on file?",
        "public": true
      }
    }
  }' \
  "https://{subdomain}.zendesk.com/api/v2/tickets/98765.json"
```

2. Confirm `HTTP 200 OK` and check `ticket.status` in response.

**Edge cases / pitfalls**:
- Setting `status: closed` directly via PUT is not supported; tickets go `solved → closed` via automation.
- You cannot re-open a `closed` ticket — replies create a new follow-up ticket automatically.
- If you include a `comment` in a PUT, it is added atomically with the update (single audit event).

**Validation**: Response `ticket.status` equals `"pending"`. `ticket.assignee_id` equals `445566`.

---

### Recipe 4: Add a public reply vs. an internal note

**Goal**: Add an internal note (not visible to the requester) for agent handoff context.

**Preconditions**: Token with `tickets:write`.

**Steps**:

1. PUT the ticket with a comment where `public: false`:

```bash
curl -X PUT \
  -u "agent@example.com/token:TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ticket": {
      "comment": {
        "body": "INTERNAL: Customer confirmed they are on the Enterprise plan. Escalate to Tier 2 if not resolved in 2h.",
        "public": false
      }
    }
  }' \
  "https://{subdomain}.zendesk.com/api/v2/tickets/98765.json"
```

2. For a **public reply**, set `"public": true` (or omit `public` — it defaults to `true`).

**Edge cases / pitfalls**:
- Accidentally setting `public: true` on an internal note sends an email to the customer. Always be explicit.
- HTML formatting in `body` is supported via `html_body` field. Plain `body` strips HTML.
- Mentions (`@agent_name`) in internal notes do not send notifications via the API — Trigger configuration handles notifications.

**Validation**: GET the ticket comments and confirm the new comment has `public: false` in the response.

```bash
curl -u "agent@example.com/token:TOKEN" \
  "https://{subdomain}.zendesk.com/api/v2/tickets/98765/comments.json"
```

---

### Recipe 5: Upload and attach a file to a ticket

**Goal**: Attach a PDF invoice to a ticket reply.

**Preconditions**: Token with `tickets:write`. File available locally or as bytes.

**Steps**:

1. Upload the file to get an upload token:

```bash
curl -X POST \
  -u "agent@example.com/token:TOKEN" \
  -H "Content-Type: application/pdf" \
  --data-binary @invoice_12345.pdf \
  "https://{subdomain}.zendesk.com/api/v2/uploads.json?filename=invoice_12345.pdf"
```

Response:
```json
{
  "upload": {
    "token": "6bk3gql82em5nmf",
    "attachment": { "id": 498483, "file_name": "invoice_12345.pdf", ... }
  }
}
```

2. Use the upload token in a ticket comment:

```bash
curl -X PUT \
  -u "agent@example.com/token:TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ticket": {
      "comment": {
        "body": "Please find your invoice attached.",
        "public": true,
        "uploads": ["6bk3gql82em5nmf"]
      }
    }
  }' \
  "https://{subdomain}.zendesk.com/api/v2/tickets/98765.json"
```

**Edge cases / pitfalls**:
- Upload tokens expire after 7 days if not attached to a ticket.
- Maximum attachment size is 50 MB per file by default (account setting may lower this).
- Multiple files: pass multiple tokens in the `uploads` array.
- The upload endpoint accepts any `Content-Type` header matching the file's MIME type.

**Validation**: GET the ticket comments and confirm the comment's `attachments` array contains the file.

---

### Recipe 6: Create and manage webhooks

**Goal**: Receive real-time notifications when a ticket is marked urgent.

**Preconditions**: Token with `webhooks:write`. HTTPS endpoint that can receive POST requests.

**Steps**:

1. Create the webhook:

```bash
curl -X POST \
  -u "agent@example.com/token:TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "webhook": {
      "name": "Urgent Ticket Alert",
      "endpoint": "https://hooks.example.com/zendesk/urgent",
      "http_method": "POST",
      "request_format": "json",
      "status": "active",
      "subscriptions": ["conditional_ticket_events"]
    }
  }' \
  "https://{subdomain}.zendesk.com/api/v2/webhooks"
```

2. Note the returned `webhook.id`.

3. Create a Trigger in Admin Center (or via API) that fires on `ticket.priority = urgent` and uses the webhook as the action target. Triggers are the event source; the webhook is the delivery mechanism.

4. Validate delivery: use `GET /api/v2/webhooks/{webhook_id}/invocations` to inspect recent calls and their response codes.

5. To rotate the signing secret: `PATCH /api/v2/webhooks/{webhook_id}/signing_secret`.

**Edge cases / pitfalls**:
- Zendesk signs webhook payloads with an HMAC-SHA256 signature in the `X-Zendesk-Webhook-Signature` header. Always verify this on your receiver.
- Your endpoint must respond with `2xx` within 5 seconds or Zendesk marks the invocation as failed.
- Zendesk retries failed webhook deliveries with exponential backoff — ensure your endpoint is idempotent.
- The older "HTTP Target" mechanism is deprecated; use the `/api/v2/webhooks` endpoint for new integrations.

**Validation**: Send a test event via **Admin Center > Webhooks > Test** or by manually triggering the condition. Confirm your endpoint receives the payload and returns `200`.

---

### Recipe 7: Bulk ticket update

**Goal**: Reassign 200 tickets from a departing agent to a new agent.

**Preconditions**: Token with `tickets:write`. List of ticket IDs.

**Steps**:

1. Collect ticket IDs (via search or incremental export).

2. PUT to bulk update endpoint (max 100 IDs per request):

```bash
curl -X PUT \
  -u "agent@example.com/token:TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ticket": {
      "assignee_id": 778899
    }
  }' \
  "https://{subdomain}.zendesk.com/api/v2/tickets/update_many.json?ids=100,101,102,103"
```

3. Response is a **Job Status** object (async):

```json
{ "job_status": { "id": "8b726e606741012fce25026b5d53c60", "status": "queued", ... } }
```

4. Poll job status:

```bash
curl -u "agent@example.com/token:TOKEN" \
  "https://{subdomain}.zendesk.com/api/v2/job_statuses/8b726e606741012fce25026b5d53c60.json"
```

5. Repeat until `status` is `completed` or `failed`.

**Edge cases / pitfalls**:
- Maximum 100 IDs per `update_many` request. Batch your list accordingly.
- Job status polling: wait at least 2–5 seconds between polls to avoid rate limit consumption.
- If any ticket in the batch fails, the job may still complete partially — check `results` array in the completed job status for per-ticket success/failure.
- For historical imports that should bypass triggers, use `POST /api/v2/imports/tickets` (bulk import) instead.

**Validation**: Poll job status to `completed`. Spot-check 5 random ticket IDs from the batch to confirm `assignee_id` updated correctly.

---

### Recipe 8: Manage agent permissions and group membership

**Goal**: Add a new agent to a support group and verify their access.

**Preconditions**: Admin-level token. Know `user_id` and `group_id`.

**Steps**:

1. Create a group membership:

```bash
curl -X POST \
  -u "admin@example.com/token:TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "group_membership": {
      "user_id": 112233,
      "group_id": 445566
    }
  }' \
  "https://{subdomain}.zendesk.com/api/v2/group_memberships.json"
```

2. Optionally set as default group for the user:

```bash
curl -X PUT \
  -u "admin@example.com/token:TOKEN" \
  "https://{subdomain}.zendesk.com/api/v2/group_memberships/{membership_id}/make_default.json"
```

3. Verify:

```bash
curl -u "admin@example.com/token:TOKEN" \
  "https://{subdomain}.zendesk.com/api/v2/users/112233/group_memberships.json"
```

**Edge cases / pitfalls**:
- Only admins can manage group memberships via API.
- A user can belong to multiple groups. Ticket routing via Trigger can use `group_id` to fan-out correctly.
- Removing an agent from a group does not re-assign their open tickets — do this explicitly.

**Validation**: List group members and confirm the new user appears: `GET /api/v2/groups/445566/memberships.json`.

---

## Query patterns & filtering

### Search API

Endpoint: `GET /api/v2/search.json?query={query_string}`

| Query fragment | Meaning |
|---|---|
| `type:ticket` | Only tickets (vs users, orgs) |
| `status:open` | Filter by status |
| `priority:urgent` | Filter by priority |
| `tags:billing` | Tickets with tag |
| `organization_id:123` | By org |
| `assignee:agent@example.com` | By assignee email |
| `created>2026-01-01` | Created after date |
| `updated<2026-02-01` | Updated before date |
| `fieldvalue:360001234567:billing` | Custom field value |

Combined example:
```
query=type:ticket+status:open+priority:urgent+tags:billing&sort_by=created_at&sort_order=desc
```

### Pagination

Zendesk supports two pagination styles:

**Cursor-based (recommended for large result sets):**

```
GET /api/v2/tickets.json?page[size]=100
```

Response includes `meta.after_cursor`. Use it for the next page:

```
GET /api/v2/tickets.json?page[size]=100&page[after]={after_cursor}
```

Continue until `meta.has_more` is `false`.

**Offset-based (legacy):**

```
GET /api/v2/tickets.json?per_page=100&page=2
```

Max `per_page` is 100. Max offset pages: 100 (10,000 records). For more, use cursor or Incremental Export.

### Incremental Export API (for sync)

```
GET /api/v2/incremental/tickets.json?start_time=1708300800
```

- `start_time`: Unix epoch seconds. Store `end_time` from response as next `start_time`.
- Returns up to 1000 records per call. Keep calling until `count < 1000` (end of stream).
- Also available for users and organizations: `/api/v2/incremental/users.json`, `/api/v2/incremental/organizations.json`.
- Events include `deleted` tickets — check `status` field.

### Sorting

Search API: `&sort_by=created_at&sort_order=asc` (or `desc`).
List endpoints: `&sort_by=updated_at&sort_order=desc`.

### Handling duplicates

- Tickets are unique by `id`. When importing or syncing, use external `ticket.external_id` field to map your system's IDs to Zendesk IDs and detect duplicates.
- Before creating a ticket from an external event, search by `external_id` first:
  ```
  GET /api/v2/tickets.json?external_id=YOUR_EXTERNAL_ID
  ```

---

## Reliability: rate limits, retries, idempotency

### Rate limits by plan

| Plan | Requests per minute |
|---|---|
| Enterprise | 700 |
| Professional | 400 |
| Team | 200 |
| Essential | 200 |

- Limits apply per API token / OAuth app (not per IP).
- When exceeded, Zendesk returns `HTTP 429 Too Many Requests` with a `Retry-After` header (seconds).

### Backoff strategy

```python
import time, requests

def zendesk_request(method, url, **kwargs):
    for attempt in range(5):
        resp = method(url, **kwargs)
        if resp.status_code == 429:
            retry_after = int(resp.headers.get("Retry-After", 60))
            time.sleep(retry_after)
            continue
        resp.raise_for_status()
        return resp
    raise Exception("Exceeded retry budget")
```

### Retry vs fail-fast

| HTTP Status | Action |
|---|---|
| `429 Too Many Requests` | Retry after `Retry-After` seconds |
| `503 Service Unavailable` | Retry with exponential backoff (max 3 attempts) |
| `500 Internal Server Error` | Retry once; if persistent, alert and fail |
| `422 Unprocessable Entity` | Fail-fast — fix the request payload |
| `404 Not Found` | Fail-fast — resource does not exist |
| `403 Forbidden` | Fail-fast — fix permissions |
| `401 Unauthorized` | Fail-fast — fix credentials |

### Idempotency & safe-upsert patterns

- **Ticket creation**: Use `external_id` on the ticket. Before POSTing, GET by `external_id`. If found, skip or update; if not, create.
- **Bulk updates**: The `update_many` endpoint is safe to retry because PUT is idempotent for the same payload.
- **Attachment uploads**: Upload tokens are single-use but expire after 7 days. If a ticket POST fails after an upload, re-use the same token in a retry within the window; otherwise re-upload.
- **Webhooks**: Your receiving endpoint must be idempotent. Zendesk may deliver the same event more than once. Use the webhook invocation ID or a unique field from the payload as a deduplication key.

### Concurrency

- Run multiple parallel API calls carefully. Each counts against the per-minute limit regardless of parallelism.
- For bulk jobs, prefer `update_many` (single API call for 100 tickets) over N parallel single-ticket PUTs.

---

## Error handling & troubleshooting

### Common error codes

| Code | Meaning | Resolution |
|---|---|---|
| `400 Bad Request` | Malformed JSON or missing required field | Check JSON syntax; inspect `description` in response body |
| `401 Unauthorized` | Invalid or missing credentials | Verify email/token encoding; check token not revoked |
| `403 Forbidden` | Authenticated but insufficient permissions | Check OAuth scopes or agent role |
| `404 Not Found` | Resource does not exist | Confirm ID; check subdomain |
| `409 Conflict` | Duplicate resource (e.g., duplicate external_id) | Handle as upsert; fetch existing record |
| `422 Unprocessable Entity` | Validation failure | Read `details` array in response for field-level errors |
| `429 Too Many Requests` | Rate limit exceeded | Respect `Retry-After` header |
| `500 Internal Server Error` | Zendesk-side error | Retry once; check Zendesk status page |
| `503 Service Unavailable` | Maintenance or overload | Retry with backoff; check status.zendesk.com |

### "If you see X, do Y" playbook

- **422 with `"Field: Status is not included in the list"`**: You are passing an invalid status value. Check the allowed values for your plan (some plans do not have `on-hold`).
- **404 on a ticket you just created**: Allow a few seconds for indexing. Retry with a short delay.
- **Attachments not appearing on ticket**: Confirm the upload token was used in the same API call that created/updated the ticket comment. Tokens cannot be added retroactively to existing comments.
- **Webhook not firing**: Verify the Trigger condition matches the ticket data exactly. Check `invocations` endpoint for delivery errors. Confirm the webhook `status` is `active`.
- **Bulk update job stuck in `queued`**: Jobs can take minutes under load. Poll every 10 seconds for up to 5 minutes. If still queued, check job status API for error messages.

### Debug logging recommendations

- Log: request method, URL (excluding token), request body (redact PII), HTTP status, response body on non-2xx, `Retry-After` value, job status ID for async calls.
- Use Zendesk's own audit log (**Admin Center > Account > Audit log**) to verify API-driven changes from the Zendesk side.
- For webhooks, log the `X-Zendesk-Webhook-Id` and `X-Zendesk-Webhook-Invocation-Id` headers for correlation.

---

## Security, privacy, compliance

### PII / PHI considerations

- Customer names, email addresses, phone numbers, and ticket bodies may constitute PII under GDPR, CCPA, and HIPAA.
- Do not log raw ticket bodies in application logs. Log ticket IDs and metadata only.
- Use Zendesk's **Redaction API** (`PUT /api/v2/tickets/{id}/comments/{comment_id}/redact`) to permanently remove PII from comments when legally required.
- For HIPAA-covered entities: Zendesk offers a BAA on Enterprise plans. Confirm your plan and BAA status before storing PHI.

### Data minimization

- When reading tickets for reporting, use `?include=` only for the related objects you actually need.
- In webhook payloads, configure the payload template to include only the fields needed by the downstream system.
- Do not store Zendesk API tokens or OAuth secrets in data warehouses or logs.

### Audit trails

- Zendesk maintains an audit log of all API changes accessible via **Admin Center > Account > Audit log** and the Audit Log API: `GET /api/v2/audit_logs.json`.
- Every ticket update creates an `Audit` record visible in the ticket's audit history: `GET /api/v2/tickets/{id}/audits.json`.
- Use `created_by_id` on audit records to distinguish user-driven vs. API-driven changes.

### Admin vs user-level tokens

- **Admin token**: Full access including user management, configuration, and audit logs. Use only for administrative automation.
- **Agent token**: Scoped to ticket operations permitted by the agent's role. Prefer for day-to-day automation.
- **End-user tokens**: Not applicable for API integrations. End users interact via the Help Center portal or email.
- Create a dedicated Zendesk agent account (service account) for each integration. Do not use a human agent's credentials for automation.

---

## Testing checklist

- [ ] **Auth test**: Confirm API token returns `200` on `GET /api/v2/users/me.json`. Confirm a wrong token returns `401`.
- [ ] **CRUD test**: Create a ticket, read it back by ID, update subject and status, add a public comment, add an internal note, confirm all fields persisted correctly.
- [ ] **Pagination test**: Fetch a list endpoint with `page[size]=2` and walk through at least 3 pages using `page[after]` cursor. Confirm no records are skipped or duplicated.
- [ ] **Rate limit test**: Send requests in a tight loop until you receive a `429`. Confirm `Retry-After` header is present. Confirm your retry logic waits the correct number of seconds and then succeeds.
- [ ] **Webhook test**: Create a webhook, trigger the associated condition, and confirm your endpoint receives the payload. Verify the HMAC-SHA256 signature. Confirm idempotent re-delivery handling.
- [ ] **Permission test**: Use an agent-scoped token to attempt an admin-only action (e.g., delete a user). Confirm `403 Forbidden` is returned.
- [ ] **Negative tests**: Send a POST with a missing required field — confirm `422`. Send a GET for a non-existent ticket ID — confirm `404`. Send a bulk update with 101 IDs — confirm appropriate error.

---

## Sources

- Zendesk Ticketing API Reference: https://developer.zendesk.com/api-reference/ticketing/introduction/
- Zendesk Authentication: https://developer.zendesk.com/api-reference/ticketing/introduction/#security-and-authentication
- Zendesk Rate Limits: https://developer.zendesk.com/api-reference/ticketing/account-configuration/usage_limits/
- Zendesk Pagination: https://developer.zendesk.com/documentation/ticketing/using-the-zendesk-api/using-pagination/
- Zendesk Incremental Export: https://developer.zendesk.com/documentation/ticketing/managing-tickets/using-the-incremental-export-api/
- Zendesk Webhooks: https://developer.zendesk.com/documentation/webhooks/
- Zendesk Ticket Import: https://developer.zendesk.com/api-reference/ticketing/tickets/ticket_import/
- Zendesk Search API: https://developer.zendesk.com/api-reference/ticketing/ticket-management/search/
- Zendesk Bulk Ticket Update: https://developer.zendesk.com/api-reference/ticketing/tickets/tickets/#update-many-tickets
- Zendesk Uploads (Attachments): https://developer.zendesk.com/api-reference/ticketing/tickets/ticket-attachments/
- Zendesk Audit Logs: https://developer.zendesk.com/api-reference/ticketing/account-configuration/audit_logs/
- Zendesk OAuth Clients: https://developer.zendesk.com/documentation/ticketing/working-with-oauth/
- Zendesk Status Page: https://status.zendesk.com/
