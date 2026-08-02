# Microsoft Dynamics 365 Skill

> **Last validated:** 2026-08-02 | **API:** Dataverse Web API (OData v4) v9.2
> **Base URL:** `https://{org-name}.crm.dynamics.com/api/data/v9.2/`
> **Assumed product:** Dynamics 365 Sales. Other apps (Customer Service, Field Service) share the same Web API pattern.
>
> **Note:** Re-confirmed on 2026-08-02: v9.0, v9.1, and v9.2 still have identical Web API behavior with no breaking changes. No v9.3 or v10 announced. The 2026 release waves are PowerApps/Copilot features, not Web API surface changes. Microsoft's own guidance is to pin the version that was current when you wrote the code and test before moving up, rather than tracking the newest automatically.
> **Source:** https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/web-api-versions (page revision 2026-03-27)

---

## What this skill enables

- Upsert Accounts, Contacts, and Leads from external systems without creating duplicates.
- Track and update Opportunity pipeline stages from any trigger, keeping sales forecasts accurate.
- Log all customer-facing activities (calls, emails, meetings, tasks) against the correct CRM record.
- Query any entity using OData filters with full pagination and incremental sync.
- Execute multi-entity operations in a single HTTP round-trip using the `$batch` endpoint.
- Integrate with Azure AD for secure, scoped, non-interactive (service principal) access.
- Respect field-level security and security roles to maintain data governance.

---

## Best-fit use cases

| Use case | Why it matters | Primary objects/entities | Typical trigger | Success criteria |
|----------|---------------|--------------------------|-----------------|------------------|
| Account/Contact upsert from external CRM | Single source of truth without duplicates | Account, Contact | External system create/update | Upsert by email/name; no duplicate created |
| Opportunity stage update | Keep pipeline accurate for sales forecasting | Opportunity | Deal stage change in external tool | `stepcode` and `estimatedvalue` updated |
| Lead capture from marketing | Auto-populate CRM from ad/form events | Lead | Form submission, ad click | Lead created; duplicate check on email |
| Activity logging (call/email/task) | Full interaction history for all reps | PhoneCall, Email, Task, Appointment | Call ended, email sent | Activity created and linked to Contact + Opportunity |
| Lead qualification → Opportunity | Structured handoff from SDR to AE | Lead, Opportunity, Account, Contact | Lead status = Qualified | Lead qualified; linked Opportunity created |
| Pipeline reporting pull | Dashboard/BI aggregation of deal data | Opportunity, Account | Scheduled report job | All open Opps fetched with correct fields |
| Bulk contact import | Load conference attendee list or data migration | Contact, Account | One-time or scheduled import | All rows inserted/updated; error rows reported |
| CMDB-style account hierarchy | Manage parent/child account relationships | Account | Org chart update | `parentaccountid` set correctly on child accounts |
| Case creation from support event | Route support requests into Dynamics | Case | Zendesk/ServiceNow event | Case created; assigned to correct queue |
| Incremental sync (delta pull) | Propagate recent changes to downstream systems | Any entity | Scheduled job | All records modified since last sync retrieved |
| Custom entity CRUD | Integrate with ISV or custom Dataverse tables | Custom entity (e.g., `new_project`) | External system event | Custom entity record created/updated correctly |
| Azure AD group → security role sync | Automate user provisioning | SystemUser, Role | Azure AD group membership change | Security role assigned/removed correctly |

---

## Key concepts & data model

### Core entities (tables)

| Entity (plural collection name) | Description | Key fields |
|---------------------------------|-------------|------------|
| `accounts` | Company/organization | `name`, `emailaddress1`, `telephone1`, `_parentaccountid_value`, `ownerid` |
| `contacts` | Individual person | `firstname`, `lastname`, `emailaddress1`, `_parentcustomerid_value` (Account) |
| `leads` | Unqualified prospect | `firstname`, `lastname`, `emailaddress1`, `companyname`, `statuscode` |
| `opportunities` | Sales deal | `name`, `estimatedvalue`, `estimatedclosedate`, `stepcode`, `_parentaccountid_value` |
| `tasks` | Scheduled to-do | `subject`, `description`, `scheduledend`, `_regardingobjectid_value` |
| `phonecalls` | Call activity | `subject`, `directioncode` (bool: true=outbound), `actualdurationminutes` |
| `emails` | Email activity | `subject`, `description`, `_regardingobjectid_value` |
| `appointments` | Calendar event | `subject`, `scheduledstart`, `scheduledend` |
| `incidents` | Support case | `title`, `description`, `prioritycode`, `statecode` |
| `annotations` | Notes | `subject`, `notetext`, `documentbody` (base64 file), `_objectid_value` |

### Identifying records

- All records have a **GUID** (`entitylogicalname_id` or just the response `@odata.etag`).
- Primary key in URL: `https://{org}/api/data/v9.2/accounts({guid})`
- Alternate keys: Configured per entity (e.g., email address as alternate key for Contact). Required for upsert.
- Lookup fields are named `_fieldname_value` in responses (e.g., `_parentaccountid_value` for the Account GUID on a Contact).

### Relationships and navigation properties

```
Account (1) ──< Contact (many)        navigation: account_contacts
Account (1) ──< Opportunity (many)    navigation: opportunity_customer_accounts
Opportunity (1) ──< Task (many)       regardingobjectid_opportunity_task
Contact/Lead (1) ──< PhoneCall (many) regardingobjectid_contact_phonecall
```

Use `$expand` to fetch related records:
```
GET /contacts?$expand=account_contacts($select=name,accountid)
```

### Custom fields (solution prefix)

Custom fields use a publisher prefix: `{prefix}_{fieldname}` (e.g., `new_contractvalue`, `cr123_tier`).
- To find the prefix: Setup → Solutions → check the publisher prefix.
- Never use `new_` for production integrations — use a dedicated solution prefix to avoid conflicts.

---

## Authentication & permissions

### Supported auth methods

| Method | Use case | Notes |
|--------|----------|-------|
| **OAuth 2.0 Client Credentials (Service Principal)** | Server-to-server automation | Recommended for integrations. Uses Azure AD App Registration. |
| **OAuth 2.0 Authorization Code** | User-context web apps | Requires browser redirect. |
| **OAuth 2.0 Resource Owner Password** | Legacy/testing only | Not recommended. |

### Azure AD App Registration (Client Credentials flow)

1. In Azure Portal → Azure Active Directory → App Registrations → New Registration.
2. Add API permission: **Dynamics CRM** → `user_impersonation` (delegated) OR use Application permissions if available.
3. Create a client secret (or certificate — preferred for production).
4. In Dynamics 365 → Settings → Security → Users → create an Application User, associate the Azure AD App ID, assign a Security Role.

```bash
# Get access token
curl -s -X POST \
  "https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token" \
  -d "client_id={client_id}" \
  -d "client_secret={client_secret}" \
  -d "scope=https://{org}.crm.dynamics.com/.default" \
  -d "grant_type=client_credentials"

# Response: {"access_token": "eyJ...", "expires_in": 3600, "token_type": "Bearer"}
```

### Required API permissions (Azure AD)

| Permission | Type | Purpose |
|-----------|------|---------|
| `Dynamics CRM / user_impersonation` | Delegated | User-context access |
| `Dynamics CRM / .default` (App permission) | Application | Service principal access (requires admin consent) |

### Security roles in Dynamics 365

Dynamics uses security roles to control access to entities and fields. The Application User needs a role with at minimum:
- Create/Read/Write/Delete on the entities used by the integration
- Avoid assigning "System Administrator" — use a custom role scoped to required entities

### Token storage and rotation

- Access tokens expire in 1 hour. Implement token caching and proactive refresh.
- Store `client_secret` in Azure Key Vault, not environment variables (preferred for Azure-hosted services).
- Rotate client secrets before expiry (Azure Portal sets an expiry date — alert 30 days before).

---

## Common workflows (recipes)

### Recipe 1: Upsert a Contact by email

**Goal:** Create or update a Contact using email as the alternate key (safe to call multiple times).

**Precondition:** Email must be configured as an alternate key on the Contact entity (Settings → Customizations → Alternate Keys).

```bash
BASE="https://yourorg.crm.dynamics.com/api/data/v9.2"
TOKEN="your_access_token"

curl -s -X PATCH "$BASE/contacts(emailaddress1='user@example.com')" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json; odata.metadata=minimal" \
  -H "OData-MaxVersion: 4.0" \
  -H "OData-Version: 4.0" \
  -H "If-None-Match: *" \
  -d '{
    "firstname": "Jane",
    "lastname": "Smith",
    "emailaddress1": "user@example.com",
    "telephone1": "+15551234567",
    "jobtitle": "VP of Engineering",
    "description": "Synced from HubSpot on 2026-02-19"
  }'
# 204 No Content on update
# 201 Created on insert (returns Location header with new record URL)
```

`If-None-Match: *` — creates if not found; updates if found. This is the upsert pattern.

If alternate keys are not configured, first query by email then POST or PATCH:
```bash
# Query
GET $BASE/contacts?$filter=emailaddress1 eq 'user@example.com'&$select=contactid,fullname

# PATCH by GUID
PATCH $BASE/contacts({contactid})
```

---

### Recipe 2: Create an Opportunity linked to an Account

**Goal:** Create a new Opportunity associated with an existing Account.

```bash
# First, look up the Account GUID
curl -s -G "$BASE/accounts" \
  -H "Authorization: Bearer $TOKEN" \
  --data-urlencode '$filter=name eq '"'"'Acme Corp'"'"'' \
  --data-urlencode '$select=accountid,name'

ACCOUNT_ID="a1b2c3d4-..."

# Create Opportunity with Account binding (navigation property syntax)
curl -s -X POST "$BASE/opportunities" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json; odata.metadata=minimal" \
  -H "OData-MaxVersion: 4.0" \
  -H "OData-Version: 4.0" \
  -d "{
    \"name\": \"Acme Corp - Enterprise License 2026\",
    \"estimatedvalue\": 85000.00,
    \"estimatedclosedate\": \"2026-06-30\",
    \"stepcode\": \"1\",
    \"customerid_account@odata.bind\": \"/accounts($ACCOUNT_ID)\"
  }"
```

**Binding syntax:** To set a lookup field (relationship), use `fieldname@odata.bind` with the relative URI of the related record. This is required — you cannot set `_customerid_value` directly via POST.

---

### Recipe 3: Update Opportunity stage and value

```bash
OPP_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

curl -s -X PATCH "$BASE/opportunities($OPP_ID)" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json; odata.metadata=minimal" \
  -H "If-Match: *" \
  -d '{
    "stepcode": "3",
    "stepname": "Proposal Presented",
    "estimatedvalue": 90000.00,
    "estimatedclosedate": "2026-04-30",
    "description": "Proposal sent on 2026-02-19. Awaiting legal review."
  }'
# 204 No Content
```

`If-Match: *` — update only if the record exists (prevents accidental creates on PATCH).

For optimistic locking, use the ETag: `If-Match: W/"datetime'2026-02-18T12%3A00%3A00Z'"` — update only if record hasn't changed.

---

### Recipe 4: Log a Phone Call activity against a Contact

```bash
CONTACT_ID="cccccccc-..."

curl -s -X POST "$BASE/phonecalls" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json; odata.metadata=minimal" \
  -H "OData-MaxVersion: 4.0" \
  -H "OData-Version: 4.0" \
  -d "{
    \"subject\": \"Discovery Call - Q1 2026\",
    \"description\": \"Discussed product needs. Next step: send proposal.\",
    \"directioncode\": true,
    \"actualdurationminutes\": 32,
    \"scheduledstart\": \"2026-02-19T14:00:00Z\",
    \"scheduledend\": \"2026-02-19T14:32:00Z\",
    \"statecode\": 1,
    \"statuscode\": 2,
    \"regardingobjectid_contact@odata.bind\": \"/contacts($CONTACT_ID)\"
  }"
```

`statecode: 1, statuscode: 2` = Completed. `statecode: 0` = Open/Scheduled.

---

### Recipe 5: Query with OData filters and $expand

**Goal:** Fetch all Opportunities closing this quarter with their Account names.

```bash
curl -s -G "$BASE/opportunities" \
  -H "Authorization: Bearer $TOKEN" \
  --data-urlencode '$select=name,estimatedvalue,estimatedclosedate,stepname,statecode' \
  --data-urlencode '$expand=customerid_account($select=name,emailaddress1)' \
  --data-urlencode '$filter=statecode eq 0 and estimatedclosedate ge 2026-01-01 and estimatedclosedate le 2026-03-31' \
  --data-urlencode '$orderby=estimatedclosedate asc' \
  --data-urlencode '$top=50'
```

**Pagination:** Response includes `@odata.nextLink` when more pages exist:
```python
url = f"{BASE}/opportunities?$filter=statecode eq 0&$top=50"
all_records = []

while url:
    resp = requests.get(url, headers=headers)
    data = resp.json()
    all_records.extend(data.get("value", []))
    url = data.get("@odata.nextLink")
```

**Incremental sync:**
```
$filter=modifiedon ge 2026-02-18T00:00:00Z
$orderby=modifiedon asc
```

Store the max `modifiedon` from the last batch as the next sync window's start.

---

### Recipe 6: Batch operations with `$batch`

**Goal:** Create 3 contacts in one HTTP request.

```bash
BATCH_BOUNDARY="batch_$(uuidgen)"

curl -s -X POST "$BASE/\$batch" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: multipart/mixed;boundary=$BATCH_BOUNDARY" \
  -H "OData-MaxVersion: 4.0" \
  -H "OData-Version: 4.0" \
  --data-binary @- <<EOF
--$BATCH_BOUNDARY
Content-Type: application/http
Content-Transfer-Encoding: binary

POST contacts HTTP/1.1
Content-Type: application/json; odata.metadata=minimal

{"firstname": "Alice", "lastname": "Jones", "emailaddress1": "alice@example.com"}

--$BATCH_BOUNDARY
Content-Type: application/http
Content-Transfer-Encoding: binary

POST contacts HTTP/1.1
Content-Type: application/json; odata.metadata=minimal

{"firstname": "Bob", "lastname": "Lee", "emailaddress1": "bob@example.com"}

--$BATCH_BOUNDARY--
EOF
```

**Atomic change sets:** Wrap multiple operations in a `changesets` block for all-or-nothing execution.

---

### Recipe 7: Attach a note (Annotation) with a file

```bash
CONTACT_ID="cccccccc-..."
BASE64_FILE=$(base64 -i contract.pdf)

curl -s -X POST "$BASE/annotations" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json; odata.metadata=minimal" \
  -d "{
    \"subject\": \"Signed Contract 2026\",
    \"notetext\": \"Contract signed and returned on 2026-02-19.\",
    \"filename\": \"contract.pdf\",
    \"mimetype\": \"application/pdf\",
    \"documentbody\": \"$BASE64_FILE\",
    \"objectid_contact@odata.bind\": \"/contacts($CONTACT_ID)\"
  }"
```

File size limit: 5 MB default; configurable up to 128 MB by admin.

---

### Recipe 8: Register a webhook via Plugin Registration Tool

**Goal:** Receive a push notification when an Opportunity is updated.

Webhooks in Dynamics 365 are registered as **service endpoints** via the Plugin Registration Tool (PRT). API-only registration is possible via `serviceendpoints` and `sdkmessageprocessingsteps` entities.

```bash
# Step 1 — create a service endpoint
curl -s -X POST "$BASE/serviceendpoints" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json; odata.metadata=minimal" \
  -d '{
    "name": "OpportunityWebhook",
    "contract": 8,
    "authtype": 1,
    "url": "https://your-server.example.com/dynamics-webhook",
    "namespaceaddress": "opportunity-updated",
    "messageformat": 2
  }'
# contract: 8 = WebHook; authtype: 1 = HttpHeader; messageformat: 2 = Json

# Step 2 — register a step on the Opportunity Update message
# (This is complex via raw API — Plugin Registration Tool is strongly recommended for initial setup)
# Steps bind the service endpoint to: Entity = opportunity, Message = Update, Stage = PostOperation
```

**Payload format:** The webhook receives a JSON payload with the changed entity attributes (primary key + modified fields).

---

## Query patterns & filtering

### OData filter operators

| Operator | Meaning | Example |
|----------|---------|---------|
| `eq` | Equals | `statecode eq 0` |
| `ne` | Not equals | `statecode ne 2` |
| `gt` / `lt` | Greater/less than | `estimatedvalue gt 50000` |
| `ge` / `le` | Greater/less than or equal | `modifiedon ge 2026-01-01` |
| `and` / `or` | Logical | `statecode eq 0 and estimatedvalue gt 10000` |
| `contains(field, 'val')` | Contains string | `contains(name, 'Acme')` |
| `startswith(field, 'val')` | Starts with | `startswith(name, 'A')` |
| `null` check | Is empty | `emailaddress1 eq null` |

### FetchXML for complex queries

When OData can't express what you need (aggregates, complex joins), use FetchXML:

```bash
FETCH_XML='<fetch aggregate="true"><entity name="opportunity"><attribute name="estimatedvalue" aggregate="sum" alias="total_value"/><filter><condition attribute="statecode" operator="eq" value="0"/></filter></entity></fetch>'

curl -s -G "$BASE/opportunities" \
  -H "Authorization: Bearer $TOKEN" \
  --data-urlencode "fetchXml=$FETCH_XML"
```

---

## Reliability: rate limits, retries, idempotency

### Dataverse API limits

| Limit | Value |
|-------|-------|
| Requests per 5 minutes (per user/service principal) | 6,000 |
| Max concurrent requests | 52 |
| Max response page size | 5,000 records (default 5,000 with `Prefer: odata.maxpagesize=5000`) |
| Batch request size | 1,000 operations per batch |

When limits are exceeded: `429 Too Many Requests` with `Retry-After` header (seconds to wait).

```python
import time

def dynamics_request(method, url, **kwargs):
    for attempt in range(5):
        resp = requests.request(method, url, **kwargs)
        if resp.status_code == 429:
            retry_after = int(resp.headers.get("Retry-After", 60))
            time.sleep(retry_after)
            continue
        if resp.status_code in (500, 502, 503):
            time.sleep(2 ** attempt)  # exponential backoff
            continue
        return resp
    raise Exception(f"Failed after 5 attempts: {resp.status_code}")
```

### Idempotency

- **PATCH + alternate key:** `PATCH /contacts(emailaddress1='user@example.com')` with `If-None-Match: *` is safe to retry.
- **POST:** Not idempotent by default. Implement external-ID dedup: query for `new_externalid eq 'EXT-123'` before creating.
- **Optimistic concurrency:** Use `If-Match: {etag}` on PATCH to detect concurrent modification (returns 412 if record changed).

---

## Error handling & troubleshooting

### Common errors

| HTTP Status | OData Error Code | Meaning | Fix |
|-------------|-----------------|---------|-----|
| 400 | `0x80040203` | Required field missing | Add the required field |
| 400 | `0x80040218` | Picklist value invalid | Use valid option set value |
| 401 | `0x8004A112` | Token expired or invalid | Refresh Azure AD token |
| 403 | `0x80040220` | Missing privilege | Add security role to Application User |
| 404 | `0x80040217` | Record not found | Check GUID; verify entity collection name |
| 409 | Concurrency conflict | `If-Match` ETag mismatch | Re-fetch record and retry |
| 412 | Precondition failed | ETag doesn't match | Re-fetch and retry with current ETag |
| 429 | — | Rate limited | Sleep per `Retry-After` |

### "If you see X, do Y" playbook

- **`@odata.bind` references fail (400):** Verify the related entity GUID exists. GUIDs must be lowercase with hyphens.
- **Custom field returns null:** Check field-level security and Application User's security role. The field may exist but not be readable by this role.
- **`modifiedon` not updating:** Dynamics may cache reads. Add `Prefer: odata.include-annotations=*` and check for `@Microsoft.Dynamics.CRM.totalrecordcount`.
- **Webhook not firing:** Check the Plugin Registration Tool for the step's status (must be enabled). Verify `serviceendpoint` URL is reachable and returns 2xx.

---

## Security, privacy, compliance

- **Azure AD security:** The Application User (service principal) should have the minimum security role. Regularly audit role assignments via Settings → Security → Users.
- **Field-level security profiles:** Sensitive fields (e.g., annual revenue, SSN) may be protected. Request only the fields you need via `$select` to avoid FLS violations.
- **PII:** Contact/Lead entities contain PII. Never log field values in production — log entity name + GUID only.
- **GDPR:** Dynamics 365 supports data subject requests via the Compliance Manager. For deletion, use the DELETE API (`DELETE /contacts({guid})`).
- **Audit logging:** Enable Dynamics 365 Auditing (Settings → Auditing) to track create/update/delete operations per entity. Audit logs are queryable via the `audits` entity.
- **Data minimization:** Use `$select` on every query — never request all fields. Reduces network overhead and limits PII exposure in application logs.

---

## Testing checklist

- [ ] **Auth test:** Call `GET /api/data/v9.2/WhoAmI` — returns `UserId`, `OrganizationId`, `BusinessUnitId` for the Application User.
- [ ] **CRUD test:** Create a Contact → read by GUID → update `jobtitle` → verify → delete.
- [ ] **Upsert test:** Run the same Contact upsert-by-email twice — verify second call updates (not duplicates) and returns 204.
- [ ] **Pagination test:** Query an entity with >50 records; follow `@odata.nextLink` to completion; verify count matches.
- [ ] **$expand test:** Query Opportunity with `$expand=customerid_account` — verify Account name appears in response.
- [ ] **$batch test:** Submit a batch of 3 creates; verify all succeed; test `changesets` rollback on partial failure.
- [ ] **Rate limit test:** Log `Retry-After` on 429; verify backoff and retry logic.
- [ ] **Permission test:** Attempt to access an entity not in the Application User's security role — confirm 403.
- [ ] **Negative tests:**
  - Invalid GUID format → 400
  - Non-existent record GUID → 404
  - Expired/invalid token → 401
  - ETag mismatch (concurrent update test) → 412

---

## Sources

- Dataverse Web API Reference: https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/overview
- OData query documentation: https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/query-data-web-api
- Authenticate with OAuth: https://learn.microsoft.com/en-us/power-apps/developer/data-platform/authenticate-oauth
- Upsert a table row: https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/update-delete-entities-using-web-api#upsert-a-table-row
- Execute batch operations: https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/execute-batch-operations-using-web-api
- Register a webhook: https://learn.microsoft.com/en-us/power-apps/developer/data-platform/use-webhooks
- API Limits: https://learn.microsoft.com/en-us/power-apps/developer/data-platform/api-limits
- FetchXML: https://learn.microsoft.com/en-us/power-apps/developer/data-platform/fetchxml/overview
- Dynamics 365 Release Plans: https://learn.microsoft.com/en-us/dynamics365/release-plans/
