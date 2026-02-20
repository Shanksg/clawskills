# Salesforce Skill

> **Last validated:** 2026-02-19 | **API:** Salesforce REST API + Bulk API v2 | **Version:** v66.0 (Spring '26)
> **Assumed product:** Sales Cloud (CRM). Adjust object availability for other clouds.
> **Version note:** v64.0 = Summer '25, v65.0 = Winter '26, v66.0 = Spring '26 (current). Use `/services/data/v66.0/` in all requests.

---

## What this skill enables

- Capture leads from any external source and create, deduplicate, and route them in Salesforce automatically.
- Keep Opportunity pipeline data current by updating stages, amounts, and close dates from external triggers.
- Log all customer interactions (calls, emails, meetings) as Activities (Task/Event) against the correct CRM record.
- Sync Account and Contact data bidirectionally between Salesforce and other tools without duplication.
- Process large data loads (10,000+ records) efficiently using Bulk API v2 with job-level error reporting.
- Subscribe to real-time record changes via Change Data Capture (CDC) to drive downstream workflows.
- Query any combination of objects and fields using SOQL with full pagination and incremental sync support.

---

## Best-fit use cases

| Use case | Why it matters | Primary objects/entities | Typical trigger | Success criteria |
|----------|---------------|--------------------------|-----------------|------------------|
| Lead capture from marketing/web | Automate lead intake without manual entry | Lead | Form submission, ad click | Lead created; duplicate check passed; owner assigned |
| Lead-to-opportunity conversion | Structured handoff from marketing to sales | Lead, Contact, Account, Opportunity | Lead qualified (status change or manual action) | Lead converted; Opportunity with stage set |
| Opportunity stage sync | Keep pipeline accurate for forecasting | Opportunity | Stage change in external system or CRM | Stage, amount, close date updated correctly |
| Activity logging (call/email) | Compliance, history, next-step tracking | Task, Event | Call ended, email sent | Task/Event created with correct WhoId + WhatId |
| Account/Contact data sync | Single source of truth across tools | Account, Contact | External system update | No duplicate records; fields updated without overwriting newer data |
| Case creation & routing | Auto-route support requests to correct queue | Case | Support ticket created (Zendesk, email) | Case created; assigned to correct queue; SLA start recorded |
| Bulk data import / migration | Load historical data or large batch updates | Any object | Scheduled ETL job | All rows processed; error report generated for failures |
| Quote/Order generation | Downstream document creation after deal | Opportunity, Quote, OpportunityLineItem | Opportunity stage = Closed Won | Quote/Order created with correct products and pricing |
| Contact deduplication | Prevent CRM data pollution | Contact, Account | Pre-create check | Existing record found and returned; new record not created |
| Pipeline reporting pull | Aggregate data for dashboards | Opportunity, Account | Scheduled report job | All records retrieved with pagination; exported to BI |
| Change Data Capture subscription | Drive real-time downstream actions without polling | Any enabled object | Record create/update/delete | CDC event received and processed within seconds |
| File/attachment management | Contract, proposal, document storage | ContentVersion, ContentDocument | Document generated or uploaded | File linked to correct record; accessible to right users |

---

## Key concepts & data model

### Core objects

| Object | Description | Key fields |
|--------|-------------|------------|
| **Lead** | Unqualified prospect; not yet linked to Account/Contact | `FirstName`, `LastName`, `Email`, `Company`, `Status`, `LeadSource`, `OwnerId` |
| **Contact** | Individual person linked to an Account | `FirstName`, `LastName`, `Email`, `Phone`, `AccountId`, `OwnerId` |
| **Account** | Company or organization | `Name`, `Type`, `Industry`, `AnnualRevenue`, `OwnerId`, `ParentId` |
| **Opportunity** | Sales deal with a stage and close date | `Name`, `AccountId`, `StageName`, `Amount`, `CloseDate`, `OwnerId`, `Probability` |
| **Task** | Logged activity (call, email, to-do) | `Subject`, `Status`, `WhoId` (Contact/Lead), `WhatId` (Opportunity/Account), `ActivityDate`, `OwnerId` |
| **Event** | Calendar activity with start/end time | `Subject`, `StartDateTime`, `EndDateTime`, `WhoId`, `WhatId`, `OwnerId` |
| **Case** | Support ticket | `Subject`, `Description`, `Status`, `Priority`, `AccountId`, `ContactId`, `OwnerId` |
| **ContentVersion** | A file/document version | `Title`, `PathOnClient`, `VersionData` (base64), `ContentDocumentId` |
| **ContentDocumentLink** | Links a file to a record | `ContentDocumentId`, `LinkedEntityId`, `ShareType` |

### Identifying records

- All records have an `Id` field: 15-character case-sensitive or 18-character case-insensitive Salesforce ID.
- Always use 18-character IDs in URLs and external storage to avoid case-sensitivity bugs.
- Natural keys: `Email` for Contact/Lead; `Name` for Account (not unique — use with caution).

### Relationships

```
Account (1) ──< Contact (many)
Account (1) ──< Opportunity (many)
Opportunity (1) ──< OpportunityLineItem (many)
Contact/Lead (1) ──< Task/Event (many, via WhoId)
Opportunity/Account (1) ──< Task/Event (many, via WhatId)
Case (1) → Contact (via ContactId)
Case (1) → Account (via AccountId)
ContentDocument (1) ──< ContentVersion (many, 1 per version)
ContentDocument ──< ContentDocumentLink (links to any record)
```

---

## Authentication & permissions

### Supported auth methods

| Method | Use case | Notes |
|--------|----------|-------|
| **OAuth 2.0 Authorization Code** | User-context web apps | Requires browser redirect |
| **OAuth 2.0 JWT Bearer Flow** | Server-to-server, no user interaction | Best for automation; uses X.509 certificate |
| **OAuth 2.0 Username-Password** | Legacy / testing only | Not recommended for production |
| **Session ID / SOAP login** | Legacy | Avoid for new integrations |

### Connected App setup (JWT Bearer Flow — recommended for automation)

1. In Salesforce Setup → App Manager → New Connected App.
2. Enable OAuth; add `api` and `refresh_token` scopes.
3. Enable "Use digital signatures"; upload your RSA public key (X.509 PEM).
4. Pre-authorize the integration user (Setup → Manage Connected Apps → edit the app → Manage Profiles/Permission Sets).

```bash
# Build the JWT assertion
# Header: {"alg":"RS256","typ":"JWT"}
# Payload: {"iss":"{consumer_key}","sub":"{username}","aud":"https://login.salesforce.com","exp":<unix+3min>}

# Exchange JWT for access token
curl -X POST https://login.salesforce.com/services/oauth2/token \
  -d "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer" \
  -d "assertion={signed_jwt}"

# Response includes: access_token, instance_url, token_type
```

### Required OAuth scopes (least privilege)

| Scope | Purpose |
|-------|---------|
| `api` | Full REST API access (required baseline) |
| `refresh_token` | Obtain refresh tokens |
| `offline_access` | Equivalent to refresh_token in some flows |
| `chatter_api` | For Chatter/feed posts only |
| `custom_permissions` | For custom permission sets |

### Token storage

- `access_token`: short-lived (typically 2 hours for connected apps). Never store in plaintext.
- `refresh_token`: long-lived. Store in secrets manager (Vault, AWS Secrets Manager, etc.).
- `instance_url`: the base URL for all API calls (e.g., `https://yourorg.my.salesforce.com`). Store alongside the token — it changes during org migration.

### Multi-tenant

- Salesforce supports multiple sandboxes (dev, staging) and a production org. Use `https://test.salesforce.com` for sandbox auth and `https://login.salesforce.com` for production.
- Each org has a unique `instance_url`. Never hard-code it.

---

## Common workflows (recipes)

### Recipe 1: Create a Lead with duplicate check

**Goal:** Insert a new lead only if one doesn't already exist with the same email.

**Steps:**
1. Query for an existing Lead by email.
2. If found, return existing ID (and optionally update fields).
3. If not found, create a new Lead.

```bash
# Step 1 — check for existing
BASE="https://yourorg.my.salesforce.com"
TOKEN="your_access_token"

curl -s -G "$BASE/services/data/v66.0/query" \
  --data-urlencode "q=SELECT Id, Email, Status FROM Lead WHERE Email = 'prospect@example.com' LIMIT 1" \
  -H "Authorization: Bearer $TOKEN"
# Response: {"totalSize": 0, "done": true, "records": []}  → safe to create

# Step 2 — create
curl -s -X POST "$BASE/services/data/v66.0/sobjects/Lead" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "FirstName": "Jane",
    "LastName": "Smith",
    "Email": "prospect@example.com",
    "Company": "Acme Corp",
    "LeadSource": "Web",
    "Status": "New"
  }'
# Response: {"id": "00Q...", "success": true, "errors": []}
```

**Edge cases:**
- If validation rules fire (e.g., required custom field missing), `errors[]` is non-empty.
- Leads with the same email can coexist — Salesforce does not enforce unique email by default. Consider enabling duplicate rules in Setup.
- If using Duplicate Management, a 409 with `DUPLICATE_VALUE` error is returned.

---

### Recipe 2: Query records with SOQL and paginate

**Goal:** Retrieve all Opportunities in a given pipeline stage, across pages.

```bash
# Initial query (returns up to 2000 records by default; Salesforce caps at 2000 per page)
curl -s -G "$BASE/services/data/v66.0/query" \
  --data-urlencode "q=SELECT Id, Name, StageName, Amount, CloseDate, Account.Name FROM Opportunity WHERE StageName = 'Proposal/Price Quote' AND CloseDate >= 2026-01-01 ORDER BY CloseDate ASC" \
  -H "Authorization: Bearer $TOKEN"

# Response includes:
# {
#   "totalSize": 5432,
#   "done": false,
#   "nextRecordsUrl": "/services/data/v66.0/query/01g...",
#   "records": [...]
# }

# Paginate — follow nextRecordsUrl until done = true
curl -s "$BASE/services/data/v66.0/query/01g..." \
  -H "Authorization: Bearer $TOKEN"
```

**Incremental sync (updated_since pattern):**
```sql
SELECT Id, Name, StageName, LastModifiedDate
FROM Opportunity
WHERE LastModifiedDate >= 2026-02-18T00:00:00Z
ORDER BY LastModifiedDate ASC
```

**SOQL pitfalls:**
- `WHERE` cannot use `LIKE` on relationship fields (e.g., `Account.Name LIKE '%Acme%'`).
- Maximum 200 fields in a SELECT clause.
- Use `SOQL OFFSET` for small datasets, `queryLocator` (above) for large ones.
- Date literals: `TODAY`, `LAST_N_DAYS:7`, `THIS_MONTH` — very useful for relative filters.

---

### Recipe 3: Update an Opportunity stage

**Goal:** Move an Opportunity to a new stage and update close date and amount.

```bash
OPP_ID="006..."

curl -s -X PATCH "$BASE/services/data/v66.0/sobjects/Opportunity/$OPP_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "StageName": "Closed Won",
    "Amount": 75000.00,
    "CloseDate": "2026-02-28"
  }'
# 204 No Content on success
```

**Upsert by external ID:**
```bash
# Requires a custom External ID field on the object (e.g., External_ID__c)
curl -s -X PATCH "$BASE/services/data/v66.0/sobjects/Opportunity/External_ID__c/EXT-1234" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "StageName": "Negotiation/Review" }'
# Creates if not found, updates if found — idempotent
```

**Validation:** PATCH returns 204. Re-query and verify `StageName` matches.

---

### Recipe 4: Log a Task (activity) against a Contact and Opportunity

**Goal:** Record a completed call as a Task linked to both a Contact and an Opportunity.

```bash
curl -s -X POST "$BASE/services/data/v66.0/sobjects/Task" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "Subject": "Discovery Call - Q1 2026",
    "Status": "Completed",
    "Priority": "Normal",
    "ActivityDate": "2026-02-19",
    "WhoId": "003...",
    "WhatId": "006...",
    "Description": "Discussed product fit. Next step: send proposal by 2026-02-25.",
    "CallDurationInSeconds": 1820,
    "CallType": "Outbound"
  }'
```

**Key fields:**
- `WhoId`: Contact or Lead ID (person).
- `WhatId`: Opportunity, Account, Case, or other non-person object.
- A single Task can have one `WhoId` and one `WhatId`. For multiple contacts, create a TaskRelation record.

---

### Recipe 5: Attach a file to a record (ContentVersion)

**Goal:** Upload a PDF proposal and link it to an Opportunity.

```bash
# Step 1 — upload file as ContentVersion
BASE64_CONTENT=$(base64 -i proposal.pdf)

curl -s -X POST "$BASE/services/data/v66.0/sobjects/ContentVersion" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"Title\": \"Q1 2026 Proposal\",
    \"PathOnClient\": \"proposal.pdf\",
    \"VersionData\": \"$BASE64_CONTENT\",
    \"FirstPublishLocationId\": \"006...\"
  }"
# FirstPublishLocationId links to the Opportunity on first publish
# Response: {"id": "068...", "success": true}
```

For files >25 MB, use the multipart upload endpoint (`/services/data/v66.0/sobjects/ContentVersion` with `multipart/form-data`).

---

### Recipe 6: Use the Composite API for multi-step operations

**Goal:** Create a Contact and link it to an Account in a single HTTP round-trip.

```bash
curl -s -X POST "$BASE/services/data/v66.0/composite" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "allOrNone": true,
    "compositeRequest": [
      {
        "method": "POST",
        "url": "/services/data/v66.0/sobjects/Contact",
        "referenceId": "newContact",
        "body": {
          "FirstName": "Jane",
          "LastName": "Smith",
          "Email": "jane.smith@acme.com",
          "AccountId": "001..."
        }
      },
      {
        "method": "POST",
        "url": "/services/data/v66.0/sobjects/Task",
        "referenceId": "welcomeTask",
        "body": {
          "Subject": "Welcome call",
          "WhoId": "@{newContact.id}",
          "ActivityDate": "2026-02-20",
          "Status": "Not Started"
        }
      }
    ]
  }'
```

`allOrNone: true` — if any step fails, all are rolled back.
Use `@{referenceId.field}` to pass results between steps.

---

### Recipe 7: Bulk upsert with Bulk API v2

**Goal:** Load 50,000 lead records from a CSV, upserting by email.

```bash
# Step 1 — create a bulk job
curl -s -X POST "$BASE/services/data/v66.0/jobs/ingest" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "object": "Lead",
    "operation": "upsert",
    "externalIdFieldName": "Email",
    "contentType": "CSV",
    "lineEnding": "LF"
  }'
# Response: {"id": "7507...", "state": "Open", ...}

JOB_ID="7507..."

# Step 2 — upload CSV data
curl -s -X PUT "$BASE/services/data/v66.0/jobs/ingest/$JOB_ID/batches" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: text/csv" \
  --data-binary @leads.csv

# Step 3 — close the job (triggers processing)
curl -s -X PATCH "$BASE/services/data/v66.0/jobs/ingest/$JOB_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"state": "UploadComplete"}'

# Step 4 — poll job status until Complete or Failed
curl -s "$BASE/services/data/v66.0/jobs/ingest/$JOB_ID" \
  -H "Authorization: Bearer $TOKEN"
# state: InProgress → JobComplete

# Step 5 — retrieve failed records
curl -s "$BASE/services/data/v66.0/jobs/ingest/$JOB_ID/failedResults" \
  -H "Authorization: Bearer $TOKEN"
```

**When to use Bulk API v2:** >1,000 records. For <1,000 records, REST is simpler and faster.

---

### Recipe 8: Register a Change Data Capture (CDC) subscription

**Goal:** Receive real-time push events when Opportunity records are created or modified.

CDC requires the Streaming API (CometD protocol). Simplified flow:

1. In Setup → Change Data Capture, enable `OpportunityChangeEvent`.
2. Connect a CometD client to `$BASE/cometd/62.0/`.
3. Handshake, then subscribe to `/data/OpportunityChangeEvent`.

```python
# Pseudocode — use the `cometd` or `aiosfstream` Python library
client = CometDClient(instance_url, access_token)
client.subscribe("/data/OpportunityChangeEvent", handler)

def handler(event):
    change_type = event["payload"]["ChangeEventHeader"]["changeType"]  # CREATE, UPDATE, DELETE, UNDELETE
    changed_fields = event["payload"]["ChangeEventHeader"]["changedFields"]
    record_ids = event["payload"]["ChangeEventHeader"]["recordIds"]
    # Process the change
```

**Pitfalls:** CDC events do not include all field values — only changed fields. Fetch the full record if you need complete data.

---

## Query patterns & filtering

### SOQL reference patterns

```sql
-- Exact match
WHERE Email = 'user@example.com'

-- Pattern match
WHERE Name LIKE '%Acme%'

-- Date range
WHERE CloseDate >= 2026-01-01 AND CloseDate <= 2026-03-31

-- Relative date
WHERE LastModifiedDate >= LAST_N_DAYS:7

-- Null check
WHERE OwnerId = null

-- IN list
WHERE StageName IN ('Prospecting', 'Qualification')

-- Subquery (semi-join)
WHERE AccountId IN (SELECT Id FROM Account WHERE Industry = 'Technology')

-- Relationship traversal
SELECT Id, Name, Account.Name FROM Contact WHERE Account.Industry = 'Healthcare'

-- Aggregate
SELECT StageName, COUNT(Id), SUM(Amount) FROM Opportunity GROUP BY StageName

-- SOSL (search across objects)
FIND {Acme Corp} IN ALL FIELDS RETURNING Account(Id, Name), Contact(Id, Name)
```

### Pagination

```
Initial: GET /query?q=SELECT...      → nextRecordsUrl if done=false
Next:    GET {nextRecordsUrl}         → follow until done=true
```

Max page size: 2,000 records. Set `queryBatchSize` header or use `LIMIT`/`OFFSET` (OFFSET max: 2,000).

### Incremental sync

Always filter on `LastModifiedDate` for incremental pulls. Store the max `LastModifiedDate` from each run as the next sync's start boundary.

---

## Reliability: rate limits, retries, idempotency

### API call limits (per 24 hours, rolling)

| Edition | Calls/day (approximate) |
|---------|------------------------|
| Essentials | 1,000 per licensed user |
| Professional | 1,000 per licensed user |
| Enterprise | 1,000 per licensed user |
| Unlimited | 5,000 per licensed user |

Check remaining: `GET /services/data/v66.0/limits` → `DailyApiRequests`.

### Rate limit headers

```
Sforce-Limit-Info: api-usage=1234/15000
```

### Retry strategy

| HTTP Status | Meaning | Action |
|-------------|---------|--------|
| 200/201/204 | Success | Done |
| 400 | Bad request (schema/validation error) | Do NOT retry — fix the payload |
| 401 | Unauthorized — token expired | Refresh token, then retry once |
| 403 | Forbidden — insufficient permissions | Do NOT retry — fix permissions |
| 404 | Record not found | Do NOT retry — check ID |
| 429 | Rate limited | Respect `Retry-After` header; exponential backoff |
| 500/503 | Salesforce internal error | Retry with exponential backoff (up to 3 attempts) |

### Idempotency

- **Upsert:** Use `PATCH /sobjects/{Object}/{ExternalIdField}/{value}` — safe to call multiple times.
- **External ID fields:** Add a custom External ID field (e.g., `Integration_ID__c`) and always upsert rather than insert.
- **Duplicate check:** Query first, then create if not found. Wrap in a Composite request with `allOrNone: true` to atomically check-and-create.

### Concurrency

Salesforce uses optimistic locking. If two updates conflict, one returns an error. Handle `UNABLE_TO_LOCK_ROW` by retrying with a short delay (1–3 seconds).

---

## Error handling & troubleshooting

### Common error codes

| Error code | Meaning | Fix |
|-----------|---------|-----|
| `REQUIRED_FIELD_MISSING` | Required field not provided | Add the missing field |
| `DUPLICATE_VALUE` | Duplicate rule violation | Query for existing record and return it |
| `FIELD_CUSTOM_VALIDATION_EXCEPTION` | Validation rule fired | Check validation rules in Setup; fix payload |
| `INVALID_FIELD` | Field name wrong or doesn't exist | Verify field API name (not label) |
| `UNABLE_TO_LOCK_ROW` | Concurrent update conflict | Retry after 1–3s delay |
| `ENTITY_IS_DELETED` | Record is in recycle bin | Query with `ALL ROWS` clause; undelete or skip |
| `INSUFFICIENT_ACCESS_ON_CROSS_REFERENCE_OBJECT` | No access to related record | Check OwnerId / sharing rules |
| `STRING_TOO_LONG` | Field value exceeds max length | Truncate the value |
| `MALFORMED_ID` | 15/18 char ID format issue | Check the ID; use 18-char form |
| `API_CURRENTLY_DISABLED` | API access not enabled for user | Enable API access on the user's profile |

### Debug logging

Log: object type, operation, record ID (not PII), error code, error message, HTTP status.
Do NOT log: access tokens, `VersionData` (binary), field values that contain PII (SSN, payment info).

### Governor limits to monitor

- `DailyApiRequests` — primary limit
- `DailyBulkApiRequests` — Bulk API calls
- `DataStorageMB` — storage per org (not per-call but affects org health)

---

## Security, privacy, compliance

- **Record-level security:** Salesforce enforces OWD (org-wide defaults), sharing rules, and role hierarchy. Integration users need explicit sharing access — test with the integration user profile, not an admin.
- **Field-level security:** Fields may be invisible to the integration user's profile. If a field returns `null` unexpectedly, check FLS in Setup.
- **PII:** Contact/Lead objects contain PII. Log field names and IDs, not field values.
- **GDPR/CCPA:** Salesforce supports data deletion via the `delete` API. For right-to-erasure workflows, delete the Contact/Lead record and scrub related Tasks/Events.
- **Audit trail:** Salesforce Field History Tracking provides per-field audit logs (enable per object in Setup). Setup Audit Trail logs configuration changes.
- **Admin vs user tokens:** Never use System Administrator credentials for integrations. Create a dedicated Integration User with a custom profile scoped to the minimum required objects and fields.
- **Event monitoring:** Enable Event Monitoring (add-on) to audit API login events, data exports, and apex executions.

---

## Testing checklist

- [ ] **Auth test:** Exchange JWT for access token; call `GET /services/data/v66.0/` — returns API version list.
- [ ] **CRUD test:** Create a Lead → read by ID → update Status → delete (hard delete via `DELETE /sobjects/Lead/{id}`).
- [ ] **SOQL pagination test:** Query an object with >2,000 records; follow `nextRecordsUrl` to completion; verify `totalSize` matches record count.
- [ ] **Rate limit test:** Call `GET /services/data/v66.0/limits` and log `DailyApiRequests`; simulate limit approach with retries.
- [ ] **Bulk API test:** Upload a 500-row CSV; poll job to completion; verify `numberRecordsProcessed` = 500; check `failedResults`.
- [ ] **Upsert idempotency test:** Upsert same record twice with same External ID — verify second call updates rather than duplicates.
- [ ] **Permission test:** Call with a token scoped to a user without Field-level access — verify affected fields return `null`.
- [ ] **Negative tests:**
  - Missing required field → `REQUIRED_FIELD_MISSING`
  - Invalid Salesforce ID → `MALFORMED_ID`
  - Revoked token → 401 Unauthorized
  - Record in recycle bin → `ENTITY_IS_DELETED`

---

## Sources

- Salesforce REST API Developer Guide: https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/
- SOQL and SOSL Reference: https://developer.salesforce.com/docs/atlas.en-us.soql_sosl.meta/soql_sosl/
- Bulk API v2 Developer Guide: https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/
- Composite API: https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_composite_composite.htm
- OAuth JWT Bearer Flow: https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_auth_jwt_flow.htm
- Change Data Capture Developer Guide: https://developer.salesforce.com/docs/atlas.en-us.change_data_capture.meta/change_data_capture/
- Governor Limits: https://developer.salesforce.com/docs/atlas.en-us.salesforce_app_limits_cheatsheet.meta/salesforce_app_limits_cheatsheet/
- Salesforce Release Notes (Spring '25): https://help.salesforce.com/s/articleView?id=release-notes.salesforce_release_notes.htm
