# Asana Skill

> **Last validated:** 2026-05-13 | **API:** Asana REST API 1.0
> **REST base URL:** `https://app.asana.com/api/1.0`
> **Assumed product:** Asana cloud. Enterprise controls, SCIM, and admin APIs may require additional scopes and plan-specific access.
>
> **⚠️ Changes since 2026-02-19:**
> - **Out of Office API (2026-04-27):** new endpoints replace the legacy `vacation_dates` field, which is now **deprecated** on the user object. Migrate any code that reads/writes `vacation_dates`.
> - **RBAC Role API (2026-02-27):** new CRUD endpoints for managing custom roles on Enterprise plans.
> - **Timesheet Approval Status API (2026-03-20)** and **Categories for Time Tracking Entries (2026-04-01):** new time-tracking primitives — useful for ops/finance workflows.
> - **Project portfolio + advanced project search APIs (2026-03-23):** new endpoints for portfolio settings and advanced project filtering.
> - **Custom Types in Memberships (2026-03-31):** memberships endpoints now support custom-type filters.
> - **Goals API (2026-04-06):** goals now expose privacy settings, default access levels, and stories.
> - **Enhanced filtering on the Search API (2026-04-06):** custom task types now usable as filter dimensions.
> - **Source:** https://forum.asana.com/c/forum-en/api/api-change-log/204

## What this skill enables

- Automatically create, assign, and structure tasks from any external intake channel (forms, emails, Slack messages, webhook events) so work is captured without manual entry.
- Keep project status, assignees, and due dates synchronized between Asana and authoritative systems (CRM, ticketing, ERP) in real time, eliminating stale project data.
- Drive workflow progression by moving tasks between sections (status columns) programmatically, mirroring the team's process stages without requiring manual drag-and-drop.
- Surface blockers and decisions as structured story comments on tasks, creating an auditable activity log that teams can reference without leaving Asana.
- Build reliable reporting pipelines by pulling task, custom field, and portfolio data into data warehouses or dashboards, with incremental sync support.
- Enable complex work breakdown by automatically generating subtask hierarchies from templates or external triggers (e.g., a new client deal closes, spawning a 20-subtask onboarding checklist).
- React to Asana activity in real time via webhooks, triggering downstream notifications, approvals, or data syncs the moment a task changes state.

---

## Best-fit use cases

| Use case | Why it matters | Primary objects/entities | Typical trigger | Success criteria |
|---|---|---|---|---|
| Create tasks from intake form / external event | Ensures no request falls through the cracks; eliminates copy-paste from email to Asana | Task, Project, Section, User | Form submission, webhook, CRM event | Task created in correct project and section with all fields populated |
| Move task between sections (status workflow) | Reflects real workflow stages; powers kanban-style views and automations | Task, Section, Project membership | Status change in external system or agent action | Task appears in correct section; no duplicate memberships |
| Assign and update task metadata | Keeps assignee, due date, and priority accurate as plans change | Task, User | Calendar change, capacity rebalancing, sprint planning | Task reflects latest assignee and due date; stakeholders notified |
| Log comments and blockers as stories | Creates traceable audit log; reduces meeting overhead | Story, Task | Blocker identified, decision made, status update needed | Story posted on correct task; timestamp and author accurate |
| Attach files and deliverables to tasks | Links artifacts (briefs, designs, reports) directly to the work item | Attachment, Task | File uploaded to cloud storage or email received | Attachment visible on task; downloadable by project members |
| Subtask creation for complex work breakdown | Decomposes large deliverables into assignable, trackable units | Task (parent), Task (subtask) | New project milestone reached, template applied | Subtasks created under parent; each has assignee and due date |
| Webhook-driven downstream notification | Reduces MTTR and lag when tasks change; keeps external tools in sync | Webhook, Task event | task.changed, task.completed events | External system receives event within seconds; idempotent handling confirmed |
| Sync completed tasks to reporting warehouse | Powers team-level OKR and capacity reporting | Task, custom_fields, Portfolio | Nightly scheduled job | All completed tasks with custom field values loaded; no duplicates |
| Portfolio / Goal status update | Rolls up project health for exec visibility | Portfolio, Goal, Project | Weekly review or milestone hit | Portfolio status reflects latest project data |
| Bulk task assignment for sprint planning | Reassigns open tasks en masse to balance capacity | Task, User | Sprint start event | All target tasks updated; rate limit not exceeded |
| Search tasks by custom field value | Enables dynamic routing: "find all tasks tagged as high-revenue" | Task, custom_fields, Workspace | On-demand query from routing engine | Correct tasks returned with accurate field values |
| Template-driven project creation | Standardizes onboarding or campaign launches | Project, Section, Task | Deal won in CRM, new campaign approved | Project with correct sections and template tasks created and assigned |

---

## Key concepts & data model

### Core objects

| Object | Description | Key identifier |
|---|---|---|
| **Workspace** | Top-level container for all Asana data. An organization is a workspace tied to a domain. | `gid` (string) |
| **Team** | Sub-group of users within a workspace who collaborate on projects | `gid` (string) |
| **Project** | A collection of tasks with sections, views, and custom fields | `gid` (string) |
| **Section** | Named grouping within a project (the "column" in Board view, "group" in List view) | `gid` (string) |
| **Task** | The atomic unit of work. Can be a standalone task or a subtask. | `gid` (string) |
| **Subtask** | A task whose `parent` field points to another task's `gid` | `gid` (string); `parent.gid` |
| **Story** | An activity record on a task: either a comment (added by user/API) or a system event (field change) | `gid` (string); `type`: `comment` or `system` |
| **Attachment** | File linked to a task — hosted on Asana or linked from external services (Google Drive, Dropbox, etc.) | `gid` (string) |
| **Tag** | Freeform label that can be applied to tasks across projects | `gid` (string) |
| **User** | A person in the workspace | `gid` (string); `email` |
| **Portfolio** | A collection of projects for executive tracking | `gid` (string) |
| **Goal** | A business objective linked to portfolios and projects (Business/Enterprise tier) | `gid` (string) |
| **Custom Field** | Typed metadata on tasks or projects: `text`, `number`, `enum`, `multi_enum`, `date`, `people` | `gid` (string); `resource_subtype` |
| **Custom Field Setting** | Join object linking a custom field definition to a project | `gid` (string) |

### Task data model (key fields)

```json
{
  "gid": "1234567890123456",
  "name": "Design landing page",
  "notes": "Brief linked in attachments.",
  "assignee": { "gid": "9876543210987654" },
  "due_on": "2026-03-15",
  "due_at": null,
  "start_on": "2026-03-01",
  "completed": false,
  "completed_at": null,
  "parent": null,
  "tags": [{ "gid": "1111111111111111" }],
  "memberships": [
    {
      "project": { "gid": "2222222222222222" },
      "section": { "gid": "3333333333333333" }
    }
  ],
  "custom_fields": [
    {
      "gid": "4444444444444444",
      "name": "Revenue impact",
      "resource_subtype": "number",
      "number_value": 50000
    },
    {
      "gid": "5555555555555555",
      "name": "Status",
      "resource_subtype": "enum",
      "enum_value": { "gid": "6666666666666666", "name": "In Progress" }
    }
  ]
}
```

### Object relationships

```
Workspace
  └── Team
        └── Project
              ├── Section 1
              │     └── Task (membership)
              └── Section 2
                    └── Task (membership)
                          └── Subtask
                                └── Story (comment / activity)
                                └── Attachment
```

- A task can belong to **multiple projects** simultaneously (multi-homing) via the `memberships` array.
- `custom_fields` on tasks are only populated when the task is a member of a project that has that custom field configured (`custom_field_settings`).

### Naming conventions

- All GIDs are **strings** (even though they look like integers). Always store and compare as strings.
- Dates use ISO 8601 `YYYY-MM-DD` for `due_on` / `start_on` (no time component).
- DateTime fields (`due_at`, `created_at`, `modified_at`) use ISO 8601 UTC with milliseconds: `2026-02-19T08:00:00.000Z`.
- `completed` is a boolean. Completed tasks have `completed_at` set.
- The API uses sparse field sets by default — always use `opt_fields` to request only the fields you need.

### opt_fields (critical)

The Asana API returns only a minimal set of fields by default (`gid`, `name`, `resource_type`). Use `opt_fields` to request additional fields and avoid extra round trips:

```
GET /api/1.0/tasks/1234567890123456?opt_fields=name,assignee,assignee.name,due_on,custom_fields,custom_fields.name,custom_fields.number_value,custom_fields.enum_value,memberships.project,memberships.section
```

Always specify `opt_fields` for production integrations. Missing a field means a second API call.

---

## Authentication & permissions

### Supported auth methods

| Method | When to use |
|---|---|
| **Personal Access Token (PAT)** | Development, scripts, server-side integrations for a single user |
| **OAuth 2.0 (Authorization Code)** | Production apps with user-delegated access |
| **OAuth 2.0 (Client Credentials)** | Service-to-service (not officially supported; use PAT for service accounts) |
| **Service Account (Premium+)** | Automation users created in the workspace; acts without a real person's account |

#### Personal Access Token

1. Go to **Asana > My Profile Settings > Apps > Manage Developer Apps > New Access Token**.
2. Copy the token (shown once).
3. Use as Bearer token:

```bash
curl -H "Authorization: Bearer YOUR_PAT" \
  "https://app.asana.com/api/1.0/users/me"
```

#### OAuth 2.0

- Register an app at https://app.asana.com/0/developer-console.
- Authorization endpoint: `https://app.asana.com/-/oauth_authorize`
- Token endpoint: `https://app.asana.com/-/oauth_token`
- Scopes: Asana uses a **single `default` scope** that grants access to all data the authenticated user can access. There are no fine-grained OAuth scopes.
- Include `offline_access` scope to receive a refresh token for long-lived sessions.

```
scope=default+offline_access
```

```bash
# Exchange code for token
curl -X POST "https://app.asana.com/-/oauth_token" \
  -d "grant_type=authorization_code" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "redirect_uri=https://yourapp.com/callback" \
  -d "code=AUTH_CODE"
```

Response includes `access_token` and `refresh_token`.

#### Refresh token flow

```bash
curl -X POST "https://app.asana.com/-/oauth_token" \
  -d "grant_type=refresh_token" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "redirect_uri=https://yourapp.com/callback" \
  -d "refresh_token=REFRESH_TOKEN"
```

Access tokens are valid for 1 hour. Refresh tokens do not expire unless revoked.

### Required scopes (least privilege)

Asana OAuth uses only `default` (and optionally `openid`, `email`, `profile` for identity). There is no scope granularity beyond `default`. Minimize access by:
- Using a **Service Account** with only the project memberships it needs.
- Granting the service account access only to specific projects, not the entire workspace.

### Token storage & rotation

- Store PATs and OAuth secrets in a secrets manager. Never hardcode in source.
- Rotate PATs quarterly or immediately after exposure.
- Implement refresh token rotation: when you exchange a refresh token, store the new refresh token from the response.
- Monitor for `401 Unauthorized` responses, which indicate token expiry or revocation, and trigger the refresh flow.

### Multi-tenant considerations

- Each Asana **workspace** is an independent data silo. Store `workspace_gid` per tenant.
- For multi-workspace apps, implement per-tenant OAuth credential storage.
- The `default` scope means your app accesses everything the user can see — scope access at the Asana membership level (project/team membership), not the OAuth scope level.
- Users in multiple workspaces: use `GET /api/1.0/workspaces` to enumerate and always pass `workspace` param when required.

---

## Common workflows (recipes)

### Recipe 1: Create a task in a specific project and section

**Goal**: Create an onboarding task in the "New Clients" project, in the "To Do" section, when a deal is won in the CRM.

**Preconditions**: PAT or OAuth token. Know the project `gid` and section `gid`.

**Steps**:

1. Look up the project to get sections:

```bash
curl -H "Authorization: Bearer TOKEN" \
  "https://app.asana.com/api/1.0/projects/2222222222222222/sections?opt_fields=gid,name"
```

2. Create the task:

```bash
curl -X POST \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "name": "Onboard Acme Corp",
      "notes": "Deal closed 2026-02-19. CSM: Jane Smith.",
      "assignee": "9876543210987654",
      "due_on": "2026-03-05",
      "projects": ["2222222222222222"]
    }
  }' \
  "https://app.asana.com/api/1.0/tasks"
```

3. Add the task to the specific section (tasks are added to the top of the first section by default; move it explicitly):

```bash
curl -X POST \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "data": { "task": "1234567890123456" } }' \
  "https://app.asana.com/api/1.0/sections/3333333333333333/addTask"
```

4. Optionally set custom fields in the same create call by including `custom_fields`:

```json
"custom_fields": {
  "4444444444444444": 50000,
  "5555555555555555": "6666666666666666"
}
```

Custom fields use the **field GID as key** and the value directly (number for number fields, enum option GID for enum fields).

**Edge cases / pitfalls**:
- If you include `projects` in the create call, the task lands in the first section. Always follow up with `addTask` to the correct section.
- `assignee` must be a user GID, not an email. Look up users via `GET /api/1.0/workspaces/{gid}/typeahead?resource_type=user&query=email`.
- Task creation does not fire webhooks unless a webhook subscription exists for the project.

**Validation**: `GET /api/1.0/tasks/{task_gid}?opt_fields=name,memberships.section,assignee` and confirm section and assignee match.

---

### Recipe 2: Search and retrieve tasks

**Goal**: Find all incomplete tasks assigned to a specific user in a project, for a capacity report.

**Preconditions**: Token. Know `workspace_gid` and `assignee_gid` or project `gid`.

**Steps**:

1. Use the task search endpoint:

```bash
curl -H "Authorization: Bearer TOKEN" \
  "https://app.asana.com/api/1.0/workspaces/7777777777777777/tasks/search?assignee=9876543210987654&projects=2222222222222222&completed=false&opt_fields=gid,name,due_on,assignee.name"
```

2. The search endpoint does **not** paginate. It returns up to 100 results. For full lists, use the project task list endpoint with pagination:

```bash
curl -H "Authorization: Bearer TOKEN" \
  "https://app.asana.com/api/1.0/projects/2222222222222222/tasks?limit=50&opt_fields=gid,name,assignee,due_on,completed,custom_fields"
```

3. Paginate using the `next_page` object in the response:

```json
{
  "data": [...],
  "next_page": {
    "offset": "eyJzb3J0X2tleSI6...",
    "path": "/api/1.0/projects/2222222222222222/tasks?limit=50&offset=eyJzb3J0X2tleSI6...",
    "uri": "https://app.asana.com/api/1.0/projects/2222222222222222/tasks?limit=50&offset=eyJzb3J0X2tleSI6..."
  }
}
```

4. Continue fetching `next_page.uri` until `next_page` is `null`.

5. For typeahead / quick lookup by name:

```bash
curl -H "Authorization: Bearer TOKEN" \
  "https://app.asana.com/api/1.0/workspaces/7777777777777777/typeahead?resource_type=task&query=Onboard+Acme&opt_fields=gid,name"
```

**Edge cases / pitfalls**:
- The search API does not support pagination. Use it only for small, targeted queries.
- `opt_fields` on search results is supported but some fields may not be available in search context — test each field.
- Completed tasks are excluded by default in most list endpoints. Pass `completed_since=now` to get only incomplete, or `completed_since=2010-01-01` to get all.

**Validation**: Count results matches expected; all returned tasks have `completed: false` and correct `assignee.gid`.

---

### Recipe 3: Update task status, assignee, and due date

**Goal**: Mark a task as complete and update its assignee when a peer takes ownership.

**Preconditions**: Token. Know `task_gid`.

**Steps**:

1. Update multiple fields in a single PUT:

```bash
curl -X PUT \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "completed": true,
      "assignee": "1111111111111111",
      "due_on": "2026-02-28"
    }
  }' \
  "https://app.asana.com/api/1.0/tasks/1234567890123456"
```

2. To move a task to a new section (workflow stage change):

```bash
curl -X POST \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "data": { "task": "1234567890123456" } }' \
  "https://app.asana.com/api/1.0/sections/8888888888888888/addTask"
```

3. To update a custom field value:

```bash
curl -X PUT \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "custom_fields": {
        "5555555555555555": "9999999999999999"
      }
    }
  }' \
  "https://app.asana.com/api/1.0/tasks/1234567890123456"
```

Where `"9999999999999999"` is the GID of the desired enum option.

**Edge cases / pitfalls**:
- When you add a task to a new section with `addTask`, the task is not removed from its old section automatically — it now appears in both. To move it, also call `removeTask` on the old section: `POST /api/1.0/sections/{old_section_gid}/removeTask`.
- Setting `completed: true` via API creates a story event (system activity) and marks `completed_at` with the current timestamp.
- You cannot set `completed_at` to an arbitrary historical time via PUT — only `completed: true/false` is writable.

**Validation**: GET the task with `opt_fields=completed,assignee,due_on,memberships.section` and confirm all values.

---

### Recipe 4: Add a comment (story) to a task

**Goal**: Log a blocker note on a task so all team members can see the context.

**Preconditions**: Token. Know `task_gid`.

**Steps**:

1. POST a story:

```bash
curl -X POST \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "text": "BLOCKER: Waiting on legal review of contract. ETA 2026-02-25. @jsmith please follow up."
    }
  }' \
  "https://app.asana.com/api/1.0/tasks/1234567890123456/stories"
```

2. To list all stories (comments + activity) on a task:

```bash
curl -H "Authorization: Bearer TOKEN" \
  "https://app.asana.com/api/1.0/tasks/1234567890123456/stories?opt_fields=gid,type,text,created_at,created_by.name"
```

3. Filter to user comments only by checking `type: "comment"` in the response (system events have `type: "system"`).

**Edge cases / pitfalls**:
- Stories posted via API appear as comments from the authenticated user (PAT owner or OAuth user). There is no way to post as another user.
- Mentions (`@username`) in API-posted comments do not send Asana notifications unless Asana's internal mention parsing picks them up — use the user's display name, not their GID.
- Stories cannot be edited via API once posted. If you need to update, delete the story and post a new one.
- HTML is not supported in story `text`. Plain text only.

**Validation**: GET the task's stories and confirm the new story appears with correct `text` and `type: "comment"`.

---

### Recipe 5: Upload and attach a file to a task

**Goal**: Attach a contract PDF to a task when it is approved in the document system.

**Preconditions**: Token. Know `task_gid`. File available as bytes.

**Steps**:

1. Upload the file as multipart form data:

```bash
curl -X POST \
  -H "Authorization: Bearer TOKEN" \
  -F "file=@contract_signed.pdf;type=application/pdf" \
  -F "name=contract_signed.pdf" \
  "https://app.asana.com/api/1.0/tasks/1234567890123456/attachments"
```

Response:

```json
{
  "data": {
    "gid": "5566778899001122",
    "name": "contract_signed.pdf",
    "host": "asana",
    "resource_type": "attachment",
    "view_url": "https://app.asana.com/app/asana/-/get_asset?...",
    "download_url": "https://..."
  }
}
```

2. Alternatively, attach an external URL (no file upload, just a link):

```bash
curl -X POST \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "name": "Signed Contract - Google Drive",
      "url": "https://drive.google.com/file/d/...",
      "resource_subtype": "external"
    }
  }' \
  "https://app.asana.com/api/1.0/tasks/1234567890123456/attachments"
```

3. List attachments on a task:

```bash
curl -H "Authorization: Bearer TOKEN" \
  "https://app.asana.com/api/1.0/tasks/1234567890123456/attachments?opt_fields=gid,name,host,created_at"
```

**Edge cases / pitfalls**:
- Maximum attachment size is 100 MB for Asana-hosted files.
- The `download_url` returned by Asana for hosted files expires. Fetch it again via `GET /api/1.0/attachments/{gid}` when you need a fresh download link.
- Attachments cannot be moved between tasks — delete and re-upload if needed.

**Validation**: List the task's attachments and confirm the new file appears by name.

---

### Recipe 6: Create and manage webhooks

**Goal**: Receive a real-time notification when any task in a project is completed.

**Preconditions**: Token with access to the project. HTTPS endpoint that can handle Asana's handshake.

**Steps**:

1. Create the webhook:

```bash
curl -X POST \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "resource": "2222222222222222",
      "target": "https://hooks.example.com/asana/tasks"
    }
  }' \
  "https://app.asana.com/api/1.0/webhooks"
```

2. **Handshake**: Asana immediately sends a POST to your `target` URL with an `X-Hook-Secret` header. Your endpoint MUST respond:
   - `HTTP 200 OK`
   - Response header: `X-Hook-Secret: {the_same_value_from_the_request}`
   - Asana stores this secret and uses it to sign future payloads.

3. Asana signs subsequent webhook deliveries with HMAC-SHA256:
   - Header: `X-Hook-Signature`
   - Compute: `HMAC-SHA256(X-Hook-Secret, raw_request_body)`
   - Always verify this signature before processing.

4. Incoming event payload example (task completed):

```json
{
  "events": [
    {
      "action": "changed",
      "change": { "field": "completed", "new_value": true },
      "created_at": "2026-02-19T10:30:00.000Z",
      "resource": { "gid": "1234567890123456", "resource_type": "task" },
      "parent": { "gid": "2222222222222222", "resource_type": "project" },
      "type": "task",
      "user": { "gid": "9876543210987654" }
    }
  ]
}
```

5. List your webhooks:

```bash
curl -H "Authorization: Bearer TOKEN" \
  "https://app.asana.com/api/1.0/webhooks?workspace=7777777777777777&opt_fields=gid,resource,target,active"
```

6. Delete a webhook:

```bash
curl -X DELETE \
  -H "Authorization: Bearer TOKEN" \
  "https://app.asana.com/api/1.0/webhooks/WEBHOOK_GID"
```

**Edge cases / pitfalls**:
- If your endpoint fails the handshake (does not echo `X-Hook-Secret`), the webhook is not created.
- Asana delivers events in batches. A single POST to your endpoint may contain multiple events in the `events` array.
- Events are **not** guaranteed to be in order. Use `created_at` to sort.
- Supported event types include: `task.created`, `task.changed`, `task.deleted`, `project.changed`, `story.created`. Filter on `events[].type` and `events[].action` in your handler.
- Webhooks are automatically deactivated if your endpoint returns non-2xx responses repeatedly. Monitor `active: false` status.

**Validation**: Confirm handshake completes (webhook appears in list with `active: true`). Trigger a task completion in the project. Confirm event received and signature verified.

---

### Recipe 7: Bulk task operations (parallel requests)

**Goal**: Assign 50 tasks to a new team member at the start of a sprint.

**Preconditions**: Token. List of task GIDs. New assignee GID.

**Steps**:

1. Asana has no native bulk update endpoint. Execute parallel PATCH/PUT requests, staying within rate limits.

2. Implement a throttled parallel executor:

```python
import asyncio, aiohttp

RATE_LIMIT = 1500  # requests per minute
CONCURRENCY = 10   # max simultaneous requests (well under 150 concurrent limit)

async def update_task(session, task_gid, assignee_gid, token):
    url = f"https://app.asana.com/api/1.0/tasks/{task_gid}"
    payload = {"data": {"assignee": assignee_gid}}
    headers = {"Authorization": f"Bearer {token}"}
    async with session.put(url, json=payload, headers=headers) as resp:
        if resp.status == 429:
            retry_after = int(resp.headers.get("Retry-After", 60))
            await asyncio.sleep(retry_after)
            return await update_task(session, task_gid, assignee_gid, token)
        resp.raise_for_status()
        return await resp.json()

async def bulk_assign(task_gids, assignee_gid, token):
    semaphore = asyncio.Semaphore(CONCURRENCY)
    async with aiohttp.ClientSession() as session:
        async def bounded(gid):
            async with semaphore:
                return await update_task(session, gid, assignee_gid, token)
        results = await asyncio.gather(*[bounded(gid) for gid in task_gids])
    return results
```

3. For very large lists (hundreds of tasks), add a delay between batches to stay well under the 1500 req/min limit:

```python
for i in range(0, len(task_gids), 25):
    batch = task_gids[i:i+25]
    await bulk_assign(batch, assignee_gid, token)
    await asyncio.sleep(1)  # ~25 req/sec = 1500 req/min ceiling
```

**Edge cases / pitfalls**:
- The 150 concurrent request limit is separate from the 1500/min rate limit. Both apply simultaneously.
- If any task GID is invalid, that individual request returns `404`. Track failures per GID and retry only those.
- Partial completion: if the job is interrupted, re-run is safe because PUT is idempotent for the same `assignee`.

**Validation**: Spot-check 5 random task GIDs after completion. Confirm `assignee.gid` matches the new user.

---

### Recipe 8: Manage project membership and sharing

**Goal**: Add a team member to a project so they can view and edit tasks.

**Preconditions**: Admin or project owner token. Know `project_gid` and `user_gid`.

**Steps**:

1. Add a member to the project:

```bash
curl -X POST \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "members": ["9876543210987654"]
    }
  }' \
  "https://app.asana.com/api/1.0/projects/2222222222222222/addMembers"
```

2. List current project members:

```bash
curl -H "Authorization: Bearer TOKEN" \
  "https://app.asana.com/api/1.0/projects/2222222222222222/members?opt_fields=gid,name,email"
```

3. Remove a member:

```bash
curl -X POST \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "members": ["9876543210987654"]
    }
  }' \
  "https://app.asana.com/api/1.0/projects/2222222222222222/removeMembers"
```

**Edge cases / pitfalls**:
- Project membership in Asana controls visibility (for private projects). Public projects are visible to all workspace members regardless of explicit membership.
- You cannot set per-member permission levels (editor vs commenter) via the API — all project members have full edit rights unless the project is in a workspace with advanced permission controls.
- Removing a member does not un-assign their tasks. Tasks remain assigned; the user just loses project visibility.

**Validation**: List project members after the add operation and confirm the user appears.

---

### Cross-tool recipe: HubSpot Deal Won -> Asana project kickoff

**Goal:** Start onboarding or implementation work in Asana when a HubSpot Deal reaches `closedwon`.

**Flow:**
1. Receive a HubSpot webhook for `deal.propertyChange`.
2. Confirm the new `dealstage` maps to closed-won in the target pipeline.
3. Fetch the Deal, associated Company, and primary Contact from HubSpot.
4. Create the Asana task or project in the correct team or project template.
5. Store the Asana `task_gid` or `project_gid` back in HubSpot or in your integration DB.

**Suggested Asana fields:**

| Asana field | Source |
|---|---|
| `name` | `Onboard {dealname}` |
| `notes` | Deal URL, customer, ARR, owner, launch context |
| `assignee` | mapped CSM or implementation owner |
| `due_on` | kickoff or target launch date |
| `custom_fields` | plan, ARR, onboarding tier, deal ID |

**Operational guardrails:**
- Prevent duplicates by checking your mapping store before creating a new Asana record.
- If you use a project template, create the project once and then create the kickoff task inside it.
- HubSpot webhooks are at-least-once delivery; your creation path must be idempotent.

## Query patterns & filtering

### Task search

```
GET /api/1.0/workspaces/{workspace_gid}/tasks/search
```

| Parameter | Example | Meaning |
|---|---|---|
| `assignee` | `9876543210987654` | Filter by assignee GID |
| `projects` | `2222222222222222` | Filter by project GID |
| `completed` | `false` | Incomplete only |
| `due_on.before` | `2026-03-01` | Due before date |
| `due_on.after` | `2026-02-01` | Due after date |
| `modified_at.after` | `2026-02-01T00:00:00Z` | Modified after datetime |
| `text` | `onboard` | Full-text search on task name/notes |
| `tags` | `1111111111111111` | Filter by tag GID |
| `opt_fields` | `gid,name,due_on` | Sparse field selection |

**Limitation**: Search returns max 100 results and does not paginate. For exhaustive queries, iterate over project task lists.

### Pagination (project/section task lists)

```
GET /api/1.0/projects/{gid}/tasks?limit=50&opt_fields=gid,name,assignee,due_on
```

Response structure:

```json
{
  "data": [ ... ],
  "next_page": {
    "offset": "eyJzb3J0X2tleSI6...",
    "path": "/api/1.0/projects/2222222222222222/tasks?limit=50&offset=eyJzb3J0X2tleSI6...",
    "uri": "https://app.asana.com/api/1.0/projects/2222222222222222/tasks?limit=50&offset=..."
  }
}
```

Continue fetching `next_page.uri` until `next_page` is `null`. Maximum `limit` is 100 per request.

### Incremental sync (updated_since pattern)

Asana does not have a dedicated incremental export API (unlike Zendesk). Use `modified_at.after` on the search endpoint or filter by `modified_at` after fetching:

```
GET /api/1.0/workspaces/{gid}/tasks/search?modified_at.after=2026-02-18T00:00:00Z&opt_fields=gid,name,modified_at,completed,custom_fields
```

Store the `max(modified_at)` from each sync run and use it as the next `modified_at.after`.

For reliable sync of all changes (including deletes), use webhooks rather than polling.

### Handling duplicates

- Tasks are unique by `gid`. For external-system correlation, store the mapping of `external_system_id → task_gid` in your own database.
- Before creating a task from an external event, query your mapping table to check if the task already exists. If yes, update; if no, create and store the new GID.
- Asana has an `external` property on tasks for storing your own reference data:

```bash
curl -X PUT \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "external": {
        "gid": "YOUR_SYSTEM_ID_12345",
        "data": "{\"source\": \"crm\", \"deal_id\": \"12345\"}"
      }
    }
  }' \
  "https://app.asana.com/api/1.0/tasks/1234567890123456"
```

Then search by external GID: `GET /api/1.0/tasks?external_gid=YOUR_SYSTEM_ID_12345` (requires appropriate opt_fields).

---

## Reliability: rate limits, retries, idempotency

### Rate limits

| Limit type | Value |
|---|---|
| Requests per minute per token | 1,500 |
| Concurrent requests per token | 150 |

- When exceeded: `HTTP 429 Too Many Requests` with `Retry-After` header (seconds).
- Rate limits are per OAuth token / PAT, not per IP or workspace.

### Backoff strategy

```python
import time, requests

def asana_request(method, url, **kwargs):
    headers = kwargs.pop("headers", {})
    headers["Authorization"] = f"Bearer {TOKEN}"
    for attempt in range(5):
        resp = requests.request(method, url, headers=headers, **kwargs)
        if resp.status_code == 429:
            retry_after = int(resp.headers.get("Retry-After", 30))
            time.sleep(retry_after)
            continue
        if resp.status_code in (500, 503):
            time.sleep(2 ** attempt)
            continue
        resp.raise_for_status()
        return resp
    raise Exception(f"Failed after retries: {url}")
```

### Retry vs fail-fast

| HTTP Status | Action |
|---|---|
| `429 Too Many Requests` | Retry after `Retry-After` seconds |
| `500 Internal Server Error` | Retry with exponential backoff (max 3) |
| `503 Service Unavailable` | Retry with exponential backoff |
| `400 Bad Request` | Fail-fast — fix payload |
| `403 Forbidden` | Fail-fast — fix permissions |
| `404 Not Found` | Fail-fast — resource does not exist |
| `412 Precondition Failed` | Handle concurrency conflict (see below) |

### Idempotency & safe-upsert patterns

- **Task creation**: Before creating, check your external ID mapping table. If no mapping exists, create the task and store `task_gid` in the mapping. If mapping exists, update the existing task.
- **Task updates** (PUT): Safe to retry. The same PUT with the same payload is idempotent.
- **Section moves** (`addTask`): If you call `addTask` twice for the same task and section, Asana handles it gracefully (task is already in section). No error.
- **Story posts** (comments): NOT idempotent. A retry will create a duplicate comment. Use your own idempotency log: record comment GID after successful post; skip if already recorded.
- **Webhook creation**: Check existing webhooks before creating to avoid duplicates: `GET /api/1.0/webhooks?workspace={gid}&opt_fields=resource,target`.

### Concurrency and conflict resolution

- Asana uses optimistic concurrency in some contexts. If you receive `412 Precondition Failed`, fetch the current task state and re-apply your changes.
- For high-concurrency scenarios (multiple services updating the same task), serialize updates through a queue rather than firing parallel PUTs.

---

## Error handling & troubleshooting

### Common error codes

| Code | Meaning | Resolution |
|---|---|---|
| `400 Bad Request` | Malformed JSON, missing required field, invalid GID format | Inspect `errors[].message` in response |
| `401 Unauthorized` | Invalid or expired token | Refresh OAuth token; regenerate PAT |
| `403 Forbidden` | Insufficient permission for this resource | Check project membership; check if resource is private |
| `404 Not Found` | Resource does not exist or is not visible to the token | Confirm GID; confirm user has access |
| `412 Precondition Failed` | Concurrency conflict | Fetch latest state and re-apply |
| `429 Too Many Requests` | Rate limit exceeded | Respect `Retry-After`; reduce concurrency |
| `500 Internal Server Error` | Asana-side error | Retry; check https://status.asana.com |
| `503 Service Unavailable` | Asana maintenance or overload | Retry with backoff |

### Response error format

```json
{
  "errors": [
    {
      "message": "Not a recognized ID: 999",
      "help": "For more information on API status codes and how to handle them, read the docs on errors: https://developers.asana.com/docs/errors"
    }
  ]
}
```

Always log the full `errors` array from the response body.

### "If you see X, do Y" playbook

- **`403` on a task you know exists**: The task belongs to a private project and the token's user is not a project member. Add the service account to the project.
- **`404` on a task GID you just created**: Asana GIDs are globally unique and immediately consistent. A `404` means either the GID is wrong or the task was deleted. Verify GID from the create response.
- **Webhook not receiving events**: Check that `active: true` on the webhook. If `active: false`, the handshake failed or Asana deactivated it due to repeated delivery failures. Delete and recreate.
- **`opt_fields` returning empty for a custom field**: The custom field is not configured on the project the task belongs to. Add the custom field to the project via `POST /api/1.0/projects/{gid}/addCustomFieldSetting`.
- **Duplicate comments**: Your retry logic posted the same comment twice. Implement a local idempotency log keyed on your event ID; skip posting if already logged.
- **Task missing from section**: You added the task to the project but did not call `addTask` on the section. Always call both.

### Debug logging recommendations

- Log: HTTP method, URL (excluding token), request body (redact PII), HTTP status, `errors` array on non-2xx, `Retry-After` value, task/project GIDs for correlation.
- For webhook debugging, log the raw request body and `X-Hook-Signature` header before processing.
- Use Asana's **activity log** on tasks (stories endpoint) to verify API-driven changes from the Asana side.
- Check https://status.asana.com for platform incidents before escalating.

---

## Security, privacy, compliance

### PII / PHI considerations

- Task names, notes, and comments may contain customer PII (names, emails, contract details).
- Do not log raw task `notes` or story `text` fields in application logs. Log GIDs only.
- For GDPR right-to-erasure requests: delete the task, project, and any stories containing PII. Use `DELETE /api/1.0/tasks/{gid}`. Asana does not have a data redaction API — full deletion is the only option.
- Asana is not HIPAA-compliant by default. Do not store PHI in Asana unless you have a signed BAA and are using Asana Enterprise with appropriate controls.

### Data minimization

- Use `opt_fields` to retrieve only the fields your integration needs. This reduces data exposure in logs and in-memory.
- Configure webhook payloads to subscribe only to the projects and event types you need, not the entire workspace.
- Use project-level webhooks rather than workspace-level webhooks to narrow scope.

### Audit trails

- Every field change, comment, and membership modification creates a Story record on the relevant task or project. These are permanent and accessible via `GET /api/1.0/tasks/{gid}/stories`.
- For project-level audit: `GET /api/1.0/projects/{gid}/project_statuses` and project memberships history.
- Asana does not offer a workspace-wide audit log API (unlike enterprise tools). For compliance, maintain your own event log from webhook deliveries.
- Use a dedicated service account for all API operations so that API-driven changes are distinguishable from human changes in the story log.

### Admin vs user-level tokens

- **PAT from a regular user**: Scoped to everything that user can access. Avoid using a named employee's PAT for automation — if they leave, the integration breaks.
- **PAT from a Service Account (Asana Enterprise)**: Create a dedicated "bot" user (e.g., `automation@yourcompany.com`) and add it only to the projects it needs. Generate a PAT for this account.
- **OAuth token (delegated)**: Acts as the user who authorized the app. Best for user-facing integrations where actions should be attributed to the user.
- Never use an admin's personal token for automated workflows — admin tokens have workspace-wide access and pose excessive risk.

---

## Testing checklist

- [ ] **Auth test**: `GET /api/1.0/users/me` returns `200` with correct user details. A bad token returns `401`.
- [ ] **CRUD test**: Create a task in a known project and section, read it back with `opt_fields`, update the assignee and due date, add a comment story, attach a file, mark complete — confirm each step via GET.
- [ ] **Pagination test**: Fetch a project with more than 100 tasks using `limit=10`. Walk through pages using `next_page.uri`. Confirm no tasks are skipped (total count matches `GET /api/1.0/projects/{gid}?opt_fields=task_count`).
- [ ] **Rate limit test**: Send requests in a loop until `429` is received. Confirm `Retry-After` header is present. Confirm retry logic waits and then succeeds.
- [ ] **Webhook test**: Create a webhook, complete the handshake (echo `X-Hook-Secret`), trigger a task change in the subscribed project, confirm event delivery, and verify HMAC-SHA256 signature.
- [ ] **Permission test**: Use a service account PAT that is NOT a member of a private project. Attempt `GET /api/1.0/projects/{gid}/tasks`. Confirm `403 Forbidden`.
- [ ] **Negative tests**: POST a task with a non-existent `assignee` GID — confirm `400`. GET a non-existent task GID — confirm `404`. Create a webhook without completing the handshake — confirm webhook is not `active`.

---

## Sources

- Asana API Overview: https://developers.asana.com/docs/overview
- Asana Authentication: https://developers.asana.com/docs/authentication
- Asana OAuth 2.0: https://developers.asana.com/docs/oauth
- Asana Rate Limits: https://developers.asana.com/docs/rate-limits
- Asana Tasks Reference: https://developers.asana.com/reference/tasks
- Asana Stories Reference: https://developers.asana.com/reference/stories
- Asana Attachments Reference: https://developers.asana.com/reference/attachments
- Asana Webhooks: https://developers.asana.com/docs/webhooks
- Asana Sections Reference: https://developers.asana.com/reference/sections
- Asana Custom Fields: https://developers.asana.com/docs/custom-fields
- Asana Portfolios: https://developers.asana.com/reference/portfolios
- Asana Search: https://developers.asana.com/reference/searchtasksforworkspace
- Asana Typeahead: https://developers.asana.com/reference/typeaheadsearchforworkspace
- Asana opt_fields Guide: https://developers.asana.com/docs/inputoutput-options
- Asana Status Page: https://status.asana.com/
