# HubSpot Skill

> **Last validated:** 2026-02-19 | **API:** HubSpot CRM API v3 (date-based versioning e.g. `2025-09` rolling out in beta)
> **Base URL:** `https://api.hubapi.com/crm/v3/objects/{objectType}`
> **Assumed products:** CRM (Contacts, Companies, Deals) + Marketing Hub + Sales Hub
>
> **⚠️ Changes since 2024:**
> - Rate limits raised (Sep 2024): Pro/Enterprise burst = **190 req/10s** (was 150); Enterprise daily = **1M** (was 500k).
> - CRM Search API max page size raised to **200 records** (was 100); rate limit raised to **5 req/s** (was 4).
> - `X-HubSpot-RateLimit-Secondly` and `X-HubSpot-RateLimit-Secondly-Remaining` headers **deprecated** — use `X-HubSpot-RateLimit-Remaining` instead.
> - Contact Lists API v1 sunset: **April 30, 2026** (endpoints return 404 after that date).
> - New date-based API versioning (e.g. `2025-09`) rolling out in beta for CRM objects, properties, associations.

---

## What this skill enables

- Create and upsert Contacts and Companies from any external system without duplicates (dedup by email).
- Move Deals through pipeline stages programmatically to keep revenue tracking accurate.
- Log all customer interactions (calls, emails, notes, meetings) as Engagements against CRM records.
- Search CRM objects using flexible filter rules with cursor-based pagination.
- Associate objects (Contact ↔ Company ↔ Deal) bidirectionally via the Associations API.
- Subscribe to real-time CRM events (contact created, deal stage changed) via the Webhooks API.
- Bulk-process up to 100 records per request using the Batch APIs.

---

## Best-fit use cases

| Use case | Why it matters | Primary objects/entities | Typical trigger | Success criteria |
|----------|---------------|--------------------------|-----------------|------------------|
| Contact upsert from external form | Eliminate duplicate contacts from multiple ingestion points | Contact | Form submission, ad click | Contact created or updated; no duplicate by email |
| Company creation and Contact association | Keep company hierarchy correct | Company, Contact | New account in another CRM | Company created; Contact associated |
| Deal stage update | Accurate pipeline for forecasting and reporting | Deal | Stage change in quoting tool or CRM | Deal's `dealstage` property updated |
| Log a call or email as Engagement | Full interaction history for sales reps | Engagement (Note, Call, Email) | Call ended, email sent | Engagement created; associated with Contact and Deal |
| Sync contacts from CSV import | Bulk historical data load | Contact | One-time migration or scheduled import | All rows upserted; errors reported |
| Webhook on deal closed-won | Trigger downstream workflow (invoice, onboarding) | Deal | `dealstage` = `closedwon` | Webhook received; downstream system triggered |
| Lifecycle stage progression | Track MQL → SQL → Customer | Contact | Lead score threshold reached | `lifecyclestage` property updated |
| Associate multiple contacts with a deal | Enterprise deals with multiple stakeholders | Contact, Deal, Association | Contact added to account | Association created; visible in deal's contact list |
| List membership sync | Keep segment lists accurate | Contact, List | Property change | Contact added to or removed from list |
| Pipeline reporting pull | Aggregate deal data for dashboards | Deal, Contact, Company | Scheduled report job | All open deals fetched with associated company names |
| Batch read contacts by ID | Efficiently retrieve known records | Contact | Data enrichment job | All 100 contacts returned per batch call |
| Custom property update | Sync business-specific metadata | Any CRM object | External system event | Custom property value set correctly |

---

## Key concepts & data model

### Core CRM objects

| Object type | API name | Description | Key properties |
|-------------|----------|-------------|----------------|
| Contact | `contacts` | Individual person | `email`, `firstname`, `lastname`, `phone`, `lifecyclestage`, `hs_lead_status` |
| Company | `companies` | Organization | `name`, `domain`, `industry`, `numberofemployees`, `annualrevenue` |
| Deal | `deals` | Sales opportunity | `dealname`, `dealstage`, `amount`, `closedate`, `pipeline` |
| Ticket | `tickets` | Support case | `subject`, `content`, `hs_ticket_priority`, `hs_pipeline_stage` |
| Product | `products` | Product catalog item | `name`, `price`, `description` |
| Line Item | `line_items` | Product attached to a Deal | `name`, `quantity`, `price`, `hs_product_id` |
| Engagement | `notes` / `calls` / `emails` / `meetings` / `tasks` | Logged activity | See Engagement section below |

### Identifying records

- All objects have a numeric `id` (HubSpot internal ID) returned on create.
- Contacts: also identified by `email` (unique) — use as dedup key.
- Companies: identified by `domain` or `name` (domain is unique; name is not).
- Store HubSpot IDs in your external system after create/upsert.

### Properties vs Associations

- **Properties** are fields on an object (e.g., `email`, `dealstage`, custom `integration_id`).
- **Associations** are relationships between objects (e.g., Contact ↔ Company). Managed separately via the Associations API.

### Engagements (logged activities)

| Activity | API object | Key fields |
|----------|-----------|------------|
| Note | `notes` | `hs_note_body` |
| Call | `calls` | `hs_call_title`, `hs_call_duration`, `hs_call_direction`, `hs_call_recording_url` |
| Email | `emails` | `hs_email_subject`, `hs_email_html`, `hs_email_direction` |
| Meeting | `meetings` | `hs_meeting_title`, `hs_meeting_start_time`, `hs_meeting_end_time` |
| Task | `tasks` | `hs_task_subject`, `hs_task_status`, `hs_task_type` |

### Custom properties

Custom properties are created via the Properties API and referenced by their `name` (internal name, e.g., `integration_source`). The internal name is set on creation and cannot be changed.

---

## Authentication & permissions

### Supported auth methods

| Method | Use case | Notes |
|--------|----------|-------|
| **Private App Token** | Server-to-server automations (recommended) | Scoped by object/action; no OAuth dance needed |
| **OAuth 2.0** | Multi-portal or third-party apps | Required for apps in the HubSpot marketplace |

### Private App Token (recommended for automation)

1. In HubSpot → Settings → Integrations → Private Apps → Create a private app.
2. Select scopes (see table below).
3. Copy the generated token — it is shown only once.

```bash
curl -s "https://api.hubapi.com/crm/v3/objects/contacts" \
  -H "Authorization: Bearer {private_app_token}" \
  -H "Content-Type: application/json"
```

### Required scopes (least privilege)

| Scope | Access granted |
|-------|---------------|
| `crm.objects.contacts.read` | Read contact records and properties |
| `crm.objects.contacts.write` | Create/update/delete contacts |
| `crm.objects.companies.read` | Read company records |
| `crm.objects.companies.write` | Create/update/delete companies |
| `crm.objects.deals.read` | Read deal records |
| `crm.objects.deals.write` | Create/update/delete deals |
| `crm.schemas.contacts.read` | Read contact property definitions |
| `crm.schemas.contacts.write` | Create custom contact properties |
| `tickets` | Read/write ticket objects |
| `e-commerce` | Read/write line items and products |
| `sales-email-read` | Read engagement emails |

### Token storage

- Private App tokens do not expire but can be rotated/revoked.
- Rotate tokens when personnel changes occur. New tokens are immediately active.
- Store tokens in a secrets manager — not in code or environment files checked into source control.

### Multi-tenant / multi-portal

- Each HubSpot portal has a unique `portalId`. OAuth apps must store tokens per portal.
- Private App tokens are portal-specific — one token per portal.

---

## Common workflows (recipes)

### Recipe 1: Upsert a Contact by email

**Goal:** Create or update a Contact; if a Contact with the given email already exists, update it.

```bash
# Check for existing contact first
curl -s -X POST "https://api.hubapi.com/crm/v3/objects/contacts/search" \
  -H "Authorization: Bearer $HS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "filterGroups": [{ "filters": [{ "propertyName": "email", "operator": "EQ", "value": "jane@acme.com" }] }],
    "properties": ["email", "firstname", "lastname", "hs_object_id"],
    "limit": 1
  }'
```

If `total` = 0 → create. If `total` > 0 → PATCH.

```bash
# Create
curl -s -X POST "https://api.hubapi.com/crm/v3/objects/contacts" \
  -H "Authorization: Bearer $HS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "properties": {
      "email": "jane@acme.com",
      "firstname": "Jane",
      "lastname": "Smith",
      "phone": "+15551234567",
      "lifecyclestage": "lead",
      "hs_lead_status": "NEW"
    }
  }'
# Response: {"id": "1234567", "properties": {...}}

# Update existing
curl -s -X PATCH "https://api.hubapi.com/crm/v3/objects/contacts/{id}" \
  -H "Authorization: Bearer $HS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "properties": { "lifecyclestage": "marketingqualifiedlead" } }'
# 200 with updated object
```

**Pitfall:** `lifecyclestage` values are ordered; setting it to a *lower* stage (e.g., `lead` when already `customer`) is silently ignored. Use `hs_lead_status` for fine-grained status.

---

### Recipe 2: Create a Company and associate with a Contact

```bash
# Create Company
curl -s -X POST "https://api.hubapi.com/crm/v3/objects/companies" \
  -H "Authorization: Bearer $HS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "properties": {
      "name": "Acme Corp",
      "domain": "acme.com",
      "industry": "TECHNOLOGY",
      "numberofemployees": "500"
    }
  }'
# Response: {"id": "7654321", ...}

COMPANY_ID="7654321"
CONTACT_ID="1234567"

# Associate Contact → Company
curl -s -X PUT "https://api.hubapi.com/crm/v4/objects/contacts/$CONTACT_ID/associations/companies/$COMPANY_ID" \
  -H "Authorization: Bearer $HS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '[{ "associationCategory": "HUBSPOT_DEFINED", "associationTypeId": 279 }]'
# 200 on success (v4 Associations API)
```

**Association type IDs** (HUBSPOT_DEFINED common values):
- Contact → Company: `279` (primary)
- Deal → Contact: `3`
- Deal → Company: `5`
- Ticket → Contact: `15`

Full list: `GET https://api.hubapi.com/crm/v4/associations/{fromObjectType}/{toObjectType}/labels`

---

### Recipe 3: Create a Deal and update its stage

```bash
# Create Deal
curl -s -X POST "https://api.hubapi.com/crm/v3/objects/deals" \
  -H "Authorization: Bearer $HS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "properties": {
      "dealname": "Acme Corp - Enterprise 2026",
      "dealstage": "appointmentscheduled",
      "pipeline": "default",
      "amount": "85000",
      "closedate": "2026-06-30T00:00:00.000Z"
    }
  }'
# Response: {"id": "9999999", ...}

# Update stage
DEAL_ID="9999999"
curl -s -X PATCH "https://api.hubapi.com/crm/v3/objects/deals/$DEAL_ID" \
  -H "Authorization: Bearer $HS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "properties": { "dealstage": "closedwon" } }'
```

**Pipeline stage IDs:** Stage identifiers (e.g., `appointmentscheduled`, `closedwon`) are pipeline-specific. Fetch valid values: `GET https://api.hubapi.com/crm/v3/pipelines/deals`

---

### Recipe 4: Log a Note Engagement against a Contact and Deal

```bash
curl -s -X POST "https://api.hubapi.com/crm/v3/objects/notes" \
  -H "Authorization: Bearer $HS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "properties": {
      "hs_note_body": "Discovery call completed. Customer needs: SSO, audit logs, enterprise SLA. Follow up with legal.",
      "hs_timestamp": "2026-02-19T14:30:00.000Z"
    },
    "associations": [
      { "to": { "id": "1234567" }, "types": [{ "associationCategory": "HUBSPOT_DEFINED", "associationTypeId": 202 }] },
      { "to": { "id": "9999999" }, "types": [{ "associationCategory": "HUBSPOT_DEFINED", "associationTypeId": 214 }] }
    ]
  }'
```

Association type IDs for notes: `202` (Note → Contact), `214` (Note → Deal).

---

### Recipe 5: Search CRM objects with filters

**Goal:** Find all Contacts where `lifecyclestage` = `lead` and `createdate` > 7 days ago.

```bash
curl -s -X POST "https://api.hubapi.com/crm/v3/objects/contacts/search" \
  -H "Authorization: Bearer $HS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "filterGroups": [
      {
        "filters": [
          { "propertyName": "lifecyclestage", "operator": "EQ", "value": "lead" },
          { "propertyName": "createdate", "operator": "GTE", "value": "1708128000000" }
        ]
      }
    ],
    "properties": ["email", "firstname", "lastname", "lifecyclestage", "createdate"],
    "sorts": [{ "propertyName": "createdate", "direction": "DESCENDING" }],
    "limit": 200,
    "after": null
  }'
```

> **Updated:** `limit` can now be up to **200** (raised from 100 in Sep 2024). The CRM Search API also allows up to 5 requests/second.

**Response:**
```json
{
  "total": 847,
  "results": [...],
  "paging": { "next": { "after": "200", "link": "..." } }
}
```

**Pagination:** Use `after` cursor from `paging.next.after`. Pass it in the next request's `"after"` field.

---

### Recipe 6: Batch read 100 contacts by ID

```bash
curl -s -X POST "https://api.hubapi.com/crm/v3/objects/contacts/batch/read" \
  -H "Authorization: Bearer $HS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "inputs": [
      { "id": "1234567" },
      { "id": "1234568" },
      { "id": "1234569" }
    ],
    "properties": ["email", "firstname", "lastname", "lifecyclestage"]
  }'
```

Max 100 inputs per batch read. For batch create/update, use `/batch/create` and `/batch/update`.

---

### Recipe 7: Register a webhook subscription

**Goal:** Receive a push notification when a Deal's `dealstage` changes.

**Precondition:** A HubSpot app (can be a private app or developer app) must be created. Webhooks require an app.

```bash
# Create webhook subscription
curl -s -X POST "https://api.hubapi.com/webhooks/v3/{app_id}/subscriptions" \
  -H "Authorization: Bearer $HS_DEVELOPER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "deal.propertyChange",
    "propertyName": "dealstage",
    "active": true
  }'
```

**Common event types:**
- `contact.creation`, `contact.deletion`, `contact.propertyChange`
- `company.creation`, `company.propertyChange`
- `deal.creation`, `deal.deletion`, `deal.propertyChange`
- `ticket.creation`, `ticket.propertyChange`

**Webhook payload:**
```json
[{
  "eventId": 100,
  "subscriptionId": 12345,
  "portalId": 9876543,
  "occurredAt": 1708357200000,
  "eventType": "deal.propertyChange",
  "objectId": 9999999,
  "propertyName": "dealstage",
  "propertyValue": "closedwon",
  "changeSource": "CRM_UI"
}]
```

**Security:** Validate the `X-HubSpot-Signature-v3` header using HMAC-SHA256 of `{client_secret}{HTTP_method}{URL}{request_body}{timestamp}`. Details: https://developers.hubspot.com/docs/api/webhooks#validating-requests

---

### Recipe 8: Import contacts from CSV (bulk)

```bash
curl -s -X POST "https://api.hubapi.com/crm/v3/imports" \
  -H "Authorization: Bearer $HS_TOKEN" \
  -F 'importRequest={"name":"BulkContactImport","importOperations":{"0-1":"UPSERT"},"dateFormat":"YEAR_MONTH_DAY","files":[{"fileName":"contacts.csv","fileFormat":"CSV","fileImportPage":{"hasHeader":true,"columnMappings":[{"columnObjectTypeId":"0-1","columnName":"Email","propertyName":"email","idColumnType":"EMAIL"},{"columnObjectTypeId":"0-1","columnName":"First Name","propertyName":"firstname"},{"columnObjectTypeId":"0-1","columnName":"Last Name","propertyName":"lastname"}]}}]}' \
  -F "files=@contacts.csv;type=text/csv"

# Poll import status
GET https://api.hubapi.com/crm/v3/imports/{importId}
# importStatus: STARTED → PROCESSING → DONE
```

---

## Query patterns & filtering

### Search API filter operators

| Operator | Meaning | Example |
|----------|---------|---------|
| `EQ` | Equals | `"operator": "EQ", "value": "lead"` |
| `NEQ` | Not equals | `"operator": "NEQ"` |
| `CONTAINS_TOKEN` | Contains a word | `"operator": "CONTAINS_TOKEN", "value": "acme"` |
| `GTE` / `LTE` | Numeric/date comparison | `"value": "1708128000000"` (ms epoch) |
| `HAS_PROPERTY` | Field is not empty | `"operator": "HAS_PROPERTY"` |
| `NOT_HAS_PROPERTY` | Field is empty | `"operator": "NOT_HAS_PROPERTY"` |
| `IN` | Matches any in list | `"values": ["lead", "mql"]` |

### Incremental sync

HubSpot properties `createdate` and `lastmodifieddate` (or `hs_lastmodifieddate`) are available on all objects. Use epoch milliseconds:

```json
{ "propertyName": "lastmodifieddate", "operator": "GTE", "value": "1708300800000" }
```

Store the max `lastmodifieddate` from each run as the next sync boundary.

---

## Reliability: rate limits, retries, idempotency

### Rate limits (verified 2026-02-19 — updated Sep 2024)

| Plan / App type | Burst limit | Daily limit |
|----------------|-------------|-------------|
| Free / Starter | 100 req / 10s | 250,000 / day |
| Professional | **190 req / 10s** | **650,000 / day** |
| Enterprise | **190 req / 10s** | **1,000,000 / day** |
| API Limit Increase pack | 250 req / 10s | +1,000,000 / day (stackable ×2) |
| Public OAuth apps (marketplace) | 110 req / 10s | — |
| CRM Search API | **5 req / s** | — |

Active headers (use these — the `Secondly` variants are deprecated):
- `X-HubSpot-RateLimit-Remaining` — requests remaining in current window
- `X-HubSpot-RateLimit-Reset` — Unix timestamp when window resets

**Deprecated headers** (still sent but do not rely on): `X-HubSpot-RateLimit-Secondly`, `X-HubSpot-RateLimit-Secondly-Remaining`.

```python
import time

def hubspot_request(method, url, **kwargs):
    for attempt in range(5):
        resp = requests.request(method, url, **kwargs)
        if resp.status_code == 429:
            # Use X-HubSpot-RateLimit-Reset (X-HubSpot-RateLimit-Secondly* is deprecated)
            reset = int(resp.headers.get("X-HubSpot-RateLimit-Reset", time.time() + 10))
            time.sleep(max(reset - time.time(), 1))
            continue
        if resp.status_code >= 500:
            time.sleep(2 ** attempt)
            continue
        return resp
    raise Exception("Max retries exceeded")
```

### Idempotency

- **Upsert by email:** Search by email first; create or PATCH based on result. Email is unique per portal.
- **Custom external ID property:** Add a custom property (e.g., `integration_source_id`) and search by it before creating.
- **Batch create:** Not idempotent — a duplicate batch create will create duplicate records. Always search first.
- **Associations:** Calling the same association PUT multiple times is safe — it's idempotent.

---

## Error handling & troubleshooting

### Common errors

| HTTP Status | Error category | Meaning | Fix |
|-------------|---------------|---------|-----|
| 400 `VALIDATION_ERROR` | Bad payload | Missing required property or invalid value | Check property name spelling; verify property exists |
| 400 `PROPERTY_DOESNT_EXIST` | Wrong property name | Property name not found | Check via `GET /crm/v3/properties/{objectType}` |
| 401 `INVALID_AUTHENTICATION` | Bad/expired token | Token revoked or wrong scope | Regenerate token; add missing scope |
| 403 `FORBIDDEN` | Insufficient scope | Token lacks required scope | Add scope to Private App |
| 404 `OBJECT_NOT_FOUND` | Record doesn't exist | ID doesn't exist in portal | Verify ID; check correct portal |
| 409 `CONFLICT` | Duplicate on unique field | Email already exists (on Contact create) | PATCH the existing record instead |
| 429 | Rate limited | Too many requests | Sleep per rate limit headers |

### "If you see X, do Y" playbook

- **Lifecycle stage update silently ignored:** You're trying to set a lower stage than the current one. HubSpot lifecycle stages are ordered and only advance. Use `hs_lead_status` for fine-grained control.
- **Association type ID 400 error:** Wrong `associationTypeId` for the object pair. Fetch valid types via `GET /crm/v4/associations/{from}/{to}/labels`.
- **Search returning 0 results for known record:** Check that you're filtering on the correct property name (internal name, not label). Use `GET /crm/v3/properties/{objectType}` to verify.
- **Webhook events arrive out of order:** Process events idempotently — store the `occurredAt` timestamp and reject events older than your last-processed timestamp.

---

## Security, privacy, compliance

- **PII:** Contact properties (email, phone, name, company) are PII. Never log property values.
- **GDPR:** HubSpot supports GDPR tools: consent records (`GDPR_DELETE_CONTACT`), communication subscriptions. Use the `/communication-preferences` API for consent management.
- **Data minimization:** Always use `properties` parameter in GET/search requests to fetch only needed fields.
- **Audit:** HubSpot provides an Activity Log in Settings for API activity. Private Apps log all API calls with timestamps.
- **Admin tokens:** Do not use HubSpot Super Admin user tokens for integrations. Use a Private App with scoped permissions.
- **Token rotation:** Rotate Private App tokens when team members leave or tokens may have been exposed. Old tokens are immediately invalidated on rotation.

---

## Testing checklist

- [ ] **Auth test:** `GET https://api.hubapi.com/crm/v3/objects/contacts?limit=1` — returns an object with `results` array.
- [ ] **CRUD test:** Create a Contact → read by ID → update `lifecyclestage` → create a Note associated to it → delete the Contact.
- [ ] **Upsert dedup test:** Create a Contact with email X; call create again with same email → expect 409 (or search first and PATCH).
- [ ] **Search pagination test:** Search with `limit=10` on an object with >10 records; follow `paging.next.after` cursors to completion; count matches `total`.
- [ ] **Batch test:** Batch read 3 contacts by ID; batch update 3 contacts with same property change.
- [ ] **Webhook test:** Register a `contact.propertyChange` subscription; update a property; verify payload received within 5s; validate HMAC signature.
- [ ] **Rate limit test:** Log `X-HubSpot-RateLimit-Remaining`; trigger 429 in test; verify backoff logic.
- [ ] **Permission test:** Remove a scope from the Private App; attempt the corresponding operation — expect 403.
- [ ] **Negative tests:**
  - Non-existent object ID → 404
  - Wrong property name → 400 `PROPERTY_DOESNT_EXIST`
  - Revoked token → 401

---

## Sources

- HubSpot CRM API v3: https://developers.hubspot.com/docs/api/crm/contacts
- Properties API: https://developers.hubspot.com/docs/api/crm/properties
- Associations API v4: https://developers.hubspot.com/docs/api/crm/associations
- Search API: https://developers.hubspot.com/docs/api/crm/search
- Webhooks API: https://developers.hubspot.com/docs/api/webhooks
- Import API: https://developers.hubspot.com/docs/api/crm/imports
- Engagements: https://developers.hubspot.com/docs/api/crm/engagements
- OAuth 2.0: https://developers.hubspot.com/docs/api/oauth/tokens
- Private Apps: https://developers.hubspot.com/docs/api/private-apps
- Rate limits: https://developers.hubspot.com/docs/api/usage-details
- Changelog: https://developers.hubspot.com/changelog
