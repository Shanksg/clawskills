# Salesforce Lead -> HubSpot Contact Sync

## Goal

Mirror new or updated Salesforce Leads into HubSpot Contacts so marketing and lifecycle workflows stay current without creating duplicates.

## Systems involved

- Salesforce: CRM of record for lead capture and sales qualification
- HubSpot: marketing automation, nurture, lifecycle segmentation

## Trigger

- Scheduled incremental sync using Salesforce `LastModifiedDate`
- Optional near-real-time trigger from Salesforce CDC or platform events

## Source of truth

- Lead identity and sales-owned fields: Salesforce
- Marketing engagement and automation state: HubSpot
- Identity dedup anchor: email, with explicit mapping store as a secondary safeguard

## Sequence

1. Query Salesforce Leads modified since the last sync watermark, with a small overlap window.
2. Skip converted Leads and Leads with no email.
3. Search HubSpot Contacts by email.
4. If a Contact exists, update it with mapped fields.
5. If no Contact exists, create one and persist the mapping.
6. Record sync outcome per Lead so failed rows can be retried independently.
7. Advance the watermark only after all rows are processed or quarantined.

## Field mapping

| Salesforce Lead | HubSpot Contact |
|-----------------|-----------------|
| `Lead.Id` | custom property `salesforce_lead_id` or integration DB |
| `Email` | `email` |
| `FirstName` | `firstname` |
| `LastName` | `lastname` |
| `Company` | `company` |
| `Phone` | `phone` |
| `LeadSource` | custom source property |
| `Status` | derived `lifecyclestage` mapping |

## Idempotency

- Primary dedup key: normalized email
- Secondary correlation key: Salesforce Lead ID
- Do not use HubSpot batch create blindly for unknown contacts; search first

## Retry and partial failure policy

- Retry transient HubSpot rate-limit and availability errors per shard
- Quarantine `400` validation failures with Lead ID, email, and failing field names
- If one row fails, continue the rest of the batch and surface a remediation report

## Reconciliation

- Daily compare: Salesforce Leads updated in the last 24 hours vs HubSpot Contacts carrying `salesforce_lead_id`
- Repair records where the ID mapping is missing but email matches
- Flag email collisions where multiple Salesforce Leads compete for one HubSpot Contact

## Rollback guidance

- Avoid destructive deletes across systems
- If a bad sync overwrites HubSpot fields, restore from HubSpot history or your sync audit log and re-run the corrected mapping

## Observability

- Track processed, created, updated, quarantined, and retried rows per run
- Alert on spikes in duplicate resolution or validation failures
- Monitor watermark lag so the sync does not silently fall behind

## Related skills

- [`skills/salesforce/skill.md`](../skills/salesforce/skill.md)
- [`skills/hubspot/skill.md`](../skills/hubspot/skill.md)
