# ServiceNow Skill

> **Last validated:** 2026-05-11 | **API:** ServiceNow REST Table API + Attachment API | **Current release:** Yokohama (GA March 12, 2025) — re-confirmed against docs.servicenow.com on 2026-05-11
> **Base URL:** `https://{instance-name}.service-now.com/api/now/`
> **Assumed product:** ITSM (Incident, Problem, Change, Request). All APIs are available on other ServiceNow apps using the same Table API pattern.
>
> **Release history:** Xanadu (2024) → **Yokohama** (March 12, 2025, current). Yokohama added AI Assets API, AWA Offer Work API, CICD Update Set API, and API Insights. The Table API and Attachment API formats are unchanged between releases.

---

## What this skill enables

- Create and update ITSM records (Incidents, Problems, Changes, Service Requests) from external alerts and systems.
- Assign records to groups or individuals programmatically, keeping queues balanced and SLAs met.
- Log work notes (internal) and customer comments (public-facing) with full context.
- Query any ServiceNow table using encoded query syntax with pagination and incremental sync.
- Attach files and log files to incidents for evidence and audit.
- Trigger outbound integrations from ServiceNow via Outbound REST + Business Rules (webhook-equivalent pattern).
- Bulk-insert records from external systems using Import Sets with Transform Maps.

---

## Best-fit use cases

| Use case | Why it matters | Primary objects/entities | Typical trigger | Success criteria |
|----------|---------------|--------------------------|-----------------|------------------|
| Create incident from monitoring alert | Auto-triage before humans wake up | Incident (`incident`) | Datadog/PagerDuty/CloudWatch alert | Incident created with correct category, priority, CMDB CI |
| Update incident state + priority | Keep ITSM state machine current | Incident | External system status change | `state` and `priority` updated; SLA clock reflects change |
| Add work note to incident | Document investigation steps without notifying customer | Incident | Engineer action | Work note appended; not sent to requester |
| Add customer comment | Update customer on progress | Incident | Milestone reached | Comment appended; customer-visible |
| Assign to group or individual | Correct routing for faster resolution | Incident, Change | Assignment rules fire | `assignment_group` / `assigned_to` set correctly |
| Bulk import from CSV | Load external data (e.g., assets, users) | Import Set | Migration or scheduled sync | All rows transformed; error rows logged |
| CMDB lookup for related CI | Associate incident with affected asset | `cmdb_ci` | Alert contains hostname/IP | CI sys_id found; linked to incident |
| Change request creation | Enforce CAB process for deployments | `change_request` | Deployment pipeline trigger | Change record created; in "New" state |
| Service request fulfillment sync | Sync request item state with external provisioning tool | `sc_request`, `sc_req_item` | Provisioning job completes | Request item state updated to "Fulfilled" |
| User lookup for assignment | Map external user to ServiceNow sys_user | `sys_user` | Assignment event | User sys_id found by email; used in assignment |
| Outbound webhook from ServiceNow | Notify external system on record state change | Any table | Business Rule trigger | External endpoint receives payload within 5s |
| Paginated table export | Full or incremental data pull for reporting | Any table | Scheduled job | All records retrieved across pages |

---

## Key concepts & data model

### Core tables

| Table name | Description | Key fields |
|-----------|-------------|------------|
| `incident` | Unplanned interruption or degradation | `number`, `short_description`, `description`, `state`, `priority`, `urgency`, `impact`, `assignment_group`, `assigned_to`, `caller_id`, `category`, `cmdb_ci` |
| `problem` | Root cause investigation | `number`, `short_description`, `state`, `assignment_group` |
| `change_request` | Planned change (Normal, Standard, Emergency) | `number`, `short_description`, `state`, `type`, `assignment_group`, `start_date`, `end_date` |
| `sc_request` | Service catalog request (top-level) | `number`, `state`, `requested_for` |
| `sc_req_item` | Individual requested item | `number`, `short_description`, `state`, `request` (ref to sc_request) |
| `cmdb_ci` | Configuration item (asset/service in CMDB) | `name`, `sys_class_name`, `operational_status`, `ip_address` |
| `sys_user` | ServiceNow user account | `user_name`, `email`, `sys_id`, `department`, `active` |
| `sys_user_group` | Group (team) for assignment | `name`, `sys_id` |
| `kb_knowledge` | Knowledge base article | `short_description`, `text`, `workflow_state` |
| `task` | Generic task (parent of incident/change/request) | Inherited by all work items |

### Identifying records

- Every record has a **sys_id**: a 32-character GUID (e.g., `a1b2c3d4e5f6789012345678abcd1234`).
- Human-readable number (e.g., `INC0001234`) is unique per table but not a primary key in API calls.
- Use `sys_id` in all API URLs and cross-reference fields.

### State values (incident)

State values are integers — they vary by instance configuration. Typical defaults:
- `1` = New
- `2` = In Progress
- `3` = On Hold
- `6` = Resolved
- `7` = Closed

**Always verify state values for your instance:** `GET /api/now/table/sys_choice?sysparm_query=name=incident^element=state`

### Work notes vs comments

The distinction is critical:
- `work_notes` — internal notes visible only to agents (fulfiller-visible).
- `comments` — customer-facing, visible to the requester.

Both are write-only fields via Table API (you write to them, but read from `work_notes_list` / `comments_and_work_notes`).

---

## Authentication & permissions

### Supported auth methods

| Method | Use case | Notes |
|--------|----------|-------|
| **Basic Auth** | Dev/testing, simple integrations | `Authorization: Basic base64(username:password)` |
| **OAuth 2.0 Password Grant** | Service account integrations | Client ID + secret + username + password |
| **OAuth 2.0 Client Credentials** | Pure server-to-server (no user) | Available on newer instances; check version |
| **OAuth 2.0 Authorization Code** | User-context applications | Requires browser redirect |

### OAuth 2.0 setup (Password Grant — most common for server-to-server)

1. In ServiceNow: System OAuth → Application Registry → New → OAuth API endpoint for external clients.
2. Set `Redirect URL` (required even for password grant), `Refresh Token Lifespan`, `Access Token Lifespan`.
3. Note `Client ID` and `Client Secret`.

```bash
# Get access token (password grant)
curl -s -X POST "https://{instance}.service-now.com/oauth_token.do" \
  -d "grant_type=password" \
  -d "client_id={client_id}" \
  -d "client_secret={client_secret}" \
  -d "username={service_account_username}" \
  -d "password={service_account_password}"

# Response: {"access_token": "...", "refresh_token": "...", "expires_in": 1800}

# Use token
curl -s "https://{instance}.service-now.com/api/now/table/incident?sysparm_limit=10" \
  -H "Authorization: Bearer {access_token}" \
  -H "Accept: application/json"
```

### Required roles (least privilege)

| Role | Purpose |
|------|---------|
| `itil` | Read/write incidents, problems, tasks (standard ITSM operations) |
| `itil_admin` | Manage groups, assignment rules |
| `sn_incident_write` | Scoped write access to incident table |
| `rest_api_explorer` | Browse API (dev/testing only) |

Avoid `admin` or `security_admin` for integration accounts.

### Token storage

- Access tokens expire (default: 30 minutes). Implement refresh-before-expiry logic.
- Refresh tokens are long-lived (default: 100 days). Store in a secrets manager.
- Basic Auth credentials: store in secrets manager; use a dedicated service account (not a personal account).

---

## Common workflows (recipes)

### Recipe 1: Create an Incident from an external alert

**Goal:** Create an Incident when a monitoring alert fires.

```bash
INSTANCE="yourcompany"
TOKEN="your_access_token"

curl -s -X POST "https://$INSTANCE.service-now.com/api/now/table/incident" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "short_description": "High CPU on web-prod-01 (alert: Datadog INC-DDG-7891)",
    "description": "CPU usage exceeded 95% for 5 minutes. Alert fired at 2026-02-19T14:30:00Z.\n\nHost: web-prod-01\nMetric: system.cpu.user\nThreshold: 95%",
    "urgency": "2",
    "impact": "2",
    "priority": "2",
    "category": "Software",
    "subcategory": "Performance",
    "caller_id": "6816f79cc0a8016401c5a33be04be441",
    "assignment_group": "a1b2c3d4e5f6789012345678abcd5678",
    "cmdb_ci": "c1c2c3c4c5c6789012345678abcd1234"
  }'
```

**Response:**
```json
{
  "result": {
    "sys_id": "a1a2a3a4a5a6789012345678abcd9999",
    "number": "INC0001234",
    "state": { "value": "1", "display_value": "New" },
    "priority": { "value": "2", "display_value": "2 - High" }
  }
}
```

**Edge cases:**
- `priority` in ServiceNow may be a calculated field (derived from urgency + impact matrix). Setting `priority` directly may be overridden. Set `urgency` and `impact` instead.
- `caller_id`, `assignment_group`, `cmdb_ci` must be sys_ids, not human-readable names. Look them up first.

---

### Recipe 2: Update Incident state and add a work note

**Goal:** Acknowledge an incident (state → In Progress) and add an internal investigation note.

```bash
INC_SYSID="a1a2a3a4a5a6789012345678abcd9999"

curl -s -X PATCH "https://$INSTANCE.service-now.com/api/now/table/incident/$INC_SYSID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "state": "2",
    "assigned_to": "6816f79cc0a8016401c5a33be04be441",
    "work_notes": "Acknowledged by on-call engineer. Investigating high CPU. Checked Datadog: spike started at 14:28 UTC. No recent deployments. Checking for memory leak."
  }'
# 200 with updated record
```

**Customer-visible comment (instead of work note):**
Replace `"work_notes"` with `"comments"`:
```json
{ "comments": "We are aware of the issue and our team is investigating. ETA for update: 30 minutes." }
```

---

### Recipe 3: Search incidents with encoded query

**Goal:** Find all open P1/P2 incidents assigned to a specific group.

```bash
GROUP_SYSID="a1b2c3d4e5f6789012345678abcd5678"

curl -s -G "https://$INSTANCE.service-now.com/api/now/table/incident" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/json" \
  --data-urlencode "sysparm_query=state!=6^state!=7^priority<=2^assignment_group=$GROUP_SYSID" \
  --data-urlencode "sysparm_fields=sys_id,number,short_description,state,priority,assigned_to,sys_created_on" \
  --data-urlencode "sysparm_limit=100" \
  --data-urlencode "sysparm_offset=0" \
  --data-urlencode "sysparm_display_value=true"
```

### Encoded query syntax

```
field=value                     exact match
field!=value                    not equal
field<=value                    less than or equal (for numbers/dates)
field>=value                    greater than or equal
field^ANDfield2=value2          AND (use ^ for AND, ^OR for OR)
field^ORfield2=value2           OR
field=NULL                      is empty
field!=NULL                     is not empty
```

**Date example (modified in last 24 hours):**
```
sys_updated_on>javascript:gs.beginningOfLast24Hours()
```

**Incremental sync with absolute date:**
```
sys_updated_on>=2026-02-18 00:00:00
```

---

### Recipe 4: Look up a user by email (for assignment)

```bash
curl -s -G "https://$INSTANCE.service-now.com/api/now/table/sys_user" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/json" \
  --data-urlencode "sysparm_query=email=engineer@yourcompany.com^active=true" \
  --data-urlencode "sysparm_fields=sys_id,user_name,email,name" \
  --data-urlencode "sysparm_limit=1"
```

Cache user sys_ids locally for the session — they don't change.

---

### Recipe 5: Attach a file to an incident

```bash
INC_SYSID="a1a2a3a4a5a6789012345678abcd9999"

curl -s -X POST "https://$INSTANCE.service-now.com/api/now/attachment/file" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: text/plain" \
  -H "Accept: application/json" \
  --data-urlencode "table_name=incident" \
  --data-urlencode "table_sys_id=$INC_SYSID" \
  --data-urlencode "file_name=cpu_spike_log.txt" \
  --data-binary @cpu_spike.log
```

For binary files:
```bash
curl -s -X POST "https://$INSTANCE.service-now.com/api/now/attachment/file?table_name=incident&table_sys_id=$INC_SYSID&file_name=screenshot.png" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: image/png" \
  --data-binary @screenshot.png
```

Max file size: 10 MB default (configurable by admin via `glide.attachment.max_size`).

---

### Recipe 6: Bulk insert via Import Set + Transform Map

**Goal:** Load 500 asset records from a CSV into the CMDB.

**Precondition:** An Import Set table (e.g., `u_import_asset`) and a Transform Map must be configured in ServiceNow by an admin.

```bash
# Step 1 — POST records to the staging Import Set table
curl -s -X POST "https://$INSTANCE.service-now.com/api/now/table/u_import_asset" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "u_hostname": "web-prod-01",
    "u_ip_address": "10.0.1.50",
    "u_environment": "Production"
  }'
# Repeat for each row, or use Import API CSV endpoint

# Step 2 — trigger the transform (if not set to auto-transform)
curl -s -X POST "https://$INSTANCE.service-now.com/api/now/table/sys_import_set_run" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "import_set_table": "u_import_asset", "transform_map": "Asset Transform" }'
```

For CSV upload directly: use the Excel/CSV import feature in ServiceNow UI, or via the `sys_import_set` REST endpoint if configured.

---

### Recipe 7: Set up outbound webhook via Business Rule

This is the ServiceNow equivalent of a webhook sender. A Business Rule runs server-side script when a record changes, and calls an external URL using `RESTMessageV2`.

**Configuration (in ServiceNow UI — Script Editor):**
```javascript
// Business Rule: "Notify External System on Incident Close"
// Table: incident
// When: After / Update
// Condition: current.state == 6 && current.state.changesTo(6)

(function executeRule(current, previous) {
    var sm = new sn_ws.RESTMessageV2();
    sm.setEndpoint("https://your-server.example.com/servicenow-webhook");
    sm.setHttpMethod("POST");
    sm.setRequestHeader("Content-Type", "application/json");
    sm.setRequestHeader("X-SN-Secret", gs.getProperty("x_integration.webhook_secret"));

    var body = {
        "event": "incident.resolved",
        "sys_id": current.sys_id.toString(),
        "number": current.number.toString(),
        "resolved_at": current.resolved_at.toString(),
        "resolution_notes": current.close_notes.toString()
    };
    sm.setRequestBody(JSON.stringify(body));

    var resp = sm.execute();
    gs.log("Webhook response: " + resp.getStatusCode(), "IntegrationWebhook");
})(current, previous);
```

**Flow Designer alternative:** Use ServiceNow Flow Designer → Create a Flow with trigger "Record Updated" + "REST Step" action for a no-code webhook pattern.

---

### Recipe 8: Paginate through large result sets

```python
import requests

instance = "yourcompany"
token = "your_access_token"
base_url = f"https://{instance}.service-now.com/api/now/table/incident"

all_incidents = []
offset = 0
limit = 100

while True:
    resp = requests.get(
        base_url,
        headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
        params={
            "sysparm_query": "state!=7",
            "sysparm_fields": "sys_id,number,state,priority,sys_updated_on",
            "sysparm_limit": limit,
            "sysparm_offset": offset
        }
    )
    data = resp.json().get("result", [])
    all_incidents.extend(data)

    # Check Link header for next page
    link_header = resp.headers.get("Link", "")
    if 'rel="next"' not in link_header or len(data) < limit:
        break
    offset += limit
```

**Link header format:**
```
Link: <https://instance.service-now.com/api/now/table/incident?sysparm_offset=100>; rel="next",
      <https://instance.service-now.com/api/now/table/incident?sysparm_offset=0>; rel="first"
```

---

## Query patterns & filtering

### Encoded query reference

```
# Incidents opened today
opened_at>=javascript:gs.beginningOfToday()

# Incidents for a specific category, not closed
category=Software^state!=7

# Incidents with specific caller
caller_id.email=user@example.com

# Incidents with no assignee
assigned_to=NULL

# Order by created date (add to sysparm_query)
^ORDERBYsys_created_on
^ORDERBYDESCpriority
```

### `sysparm_display_value`

Add `sysparm_display_value=true` to get human-readable labels alongside raw values:
```json
"state": { "value": "2", "display_value": "In Progress" }
```

Without it, you get only the raw value (`"state": "2"`). Use `true` when displaying to users; use `false` (default) when passing values back to the API.

---

## Reliability: rate limits, retries, idempotency

### Rate limits

ServiceNow rate limits are instance-specific and configurable by the admin. Default guidance:
- Typical limit: ~3,000 REST API requests per hour per user/service account.
- Hard limits are enforced via the `com.glide.rest.inbound.max_requests_per_minute` system property.

On limit: `429 Too Many Requests` with `Retry-After` header.

```python
def servicenow_request(method, url, **kwargs):
    for attempt in range(5):
        resp = requests.request(method, url, **kwargs)
        if resp.status_code == 429:
            retry_after = int(resp.headers.get("Retry-After", 60))
            time.sleep(retry_after)
            continue
        if resp.status_code in (500, 503):
            time.sleep(2 ** attempt)
            continue
        return resp
    raise Exception("Max retries exceeded")
```

### Idempotency

- ServiceNow has no native idempotency keys.
- **Pattern:** Store the incident's `sys_id` or `number` in your external system after creation. Before creating, query by `short_description` + a correlation ID stored in `correlation_id` or `correlation_display` field.
- **Upsert approach:** Use the `correlation_id` field: set it to your external ID on create; then PATCH by querying `correlation_id={your_id}` to get the `sys_id`.

### Concurrency

ServiceNow uses optimistic locking internally. If two concurrent PATCH requests conflict, one may fail with `500` or produce unexpected results. Serialize writes per record in your integration layer.

---

## Error handling & troubleshooting

### Common errors

| HTTP Status | Error message | Meaning | Fix |
|-------------|--------------|---------|-----|
| 400 `Expected field type...` | Invalid field value (e.g., wrong data type) | Check field type; use `display_value` for picklists |
| 400 `Field is mandatory` | Required field missing | Add the required field |
| 401 `User Not Authenticated` | Bad credentials or expired token | Refresh OAuth token or fix Basic Auth credentials |
| 403 `Access to record denied` | ACL blocks access | Check role on the table and record |
| 404 `No record found` | sys_id doesn't exist | Verify sys_id; check table name spelling |
| 429 | Rate limited | Sleep per `Retry-After` |
| 500 | Internal error | Retry with backoff; check ServiceNow instance health |

### "If you see X, do Y" playbook

- **Work note not visible in UI:** You wrote to `work_notes` but it shows as a comment. Verify you're not accidentally writing to `comments`. They are separate write-only fields.
- **`state` update has no effect:** Priority/state may be controlled by a Business Rule or Workflow that overrides API writes. Check with the ServiceNow admin.
- **`assigned_to` shows wrong name:** You passed a `user_name` string instead of a `sys_id`. Look up the user's `sys_id` first.
- **Attachment POST returns 403:** The service account lacks the `attachment_admin` role, or the table has attachment restrictions. Check attachment policies with admin.

---

## Security, privacy, compliance

- **PII:** Incident descriptions may contain customer names, emails, or account details. Log sys_id and number only — not description or work notes.
- **Sensitive fields:** Some CMDB or HR fields have field-level ACLs. The API returns them as empty strings if the service account lacks access.
- **Audit trail:** ServiceNow provides a full audit history per record via `sys_audit` table. Query: `GET /api/now/table/sys_audit?sysparm_query=tablename=incident^documentkey={sys_id}`.
- **Admin vs service account:** Never use a personal user account or admin account for integrations. Create a dedicated service account with a minimal role (`itil` for standard ITSM operations).
- **Webhook authentication:** When receiving outbound calls from ServiceNow, verify the `X-SN-Secret` header or use mutual TLS.
- **Data residency:** ServiceNow offers data residency options (US, EU, APAC). Confirm with the instance admin before processing regulated data.

---

## Testing checklist

- [ ] **Auth test:** `GET /api/now/table/incident?sysparm_limit=1` — returns a `result` array with at least one record (or empty array for new instance).
- [ ] **CRUD test:** Create incident → read by sys_id → update state → add work note → verify work note in `work_notes_list` → close incident.
- [ ] **Encoded query test:** Search with multiple conditions; verify results match expected count.
- [ ] **Pagination test:** Query an incident table with >100 records; paginate via `sysparm_offset`; verify total record count.
- [ ] **Attachment test:** POST a file; verify it appears on the incident; download it.
- [ ] **Permission test:** Attempt to access a table not in the service account's role (e.g., `sys_user_grmember` without admin) — confirm 403.
- [ ] **Rate limit test:** Log `Retry-After` on 429; verify backoff and retry.
- [ ] **Negative tests:**
  - Non-existent sys_id → 404
  - Invalid field value (e.g., state = "invalid") → 400
  - Expired OAuth token → 401

---

## Sources

- ServiceNow Table API (Yokohama): https://www.servicenow.com/docs/bundle/yokohama-api-reference/page/integrate/inbound-rest/concept/c_TableAPI.html
- Yokohama API Release Notes: https://www.servicenow.com/docs/bundle/yokohama-release-notes/page/release-notes/now-platform-app-engine/api-rn.html
- Yokohama new REST APIs blog: https://www.servicenow.com/community/developer-blog/yokohama-integration-landscape-new-web-service-rest-apis/ba-p/3166555
- Yokohama Release Notes: https://www.servicenow.com/docs/bundle/yokohama-release-notes/page/release-notes/family-release-notes.html
- Attachment API: https://developer.servicenow.com/dev.do#!/reference/api/yokohama/rest/c_AttachmentAPI
- OAuth 2.0 setup: https://developer.servicenow.com/dev.do#!/guides/yokohama/now-platform/tpb-oauth/c_OAuth2AuthenticationWithSNOW
- Encoded Query Strings: https://developer.servicenow.com/dev.do#!/guides/yokohama/now-platform/tpb-ui/c_EncodedQueryStrings
- Import Sets: https://developer.servicenow.com/dev.do#!/reference/api/yokohama/rest/c_ImportSetAPI
- Outbound REST: https://developer.servicenow.com/dev.do#!/learn/learning-plans/yokohama/new_to_servicenow/app_store_learnv2_rest_yokohama_outbound_rest_integrations
- Business Rules: https://developer.servicenow.com/dev.do#!/guides/yokohama/now-platform/tpb-glide/c_BusinessRulesAPI
- Flow Designer: https://docs.servicenow.com/bundle/yokohama-build-workflows/page/administer/flow-designer/concept/flow-designer.html
- API Rate Limits best practices: https://developer.servicenow.com/dev.do#!/guides/yokohama/now-platform/tpb-rest/c_RESTAPIBestPractices
