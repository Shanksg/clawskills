# HubSpot Deal Won -> Asana Onboarding Kickoff

## Goal

Create onboarding or implementation work in Asana as soon as a HubSpot Deal is marked closed won.

## Systems involved

- HubSpot: sales pipeline, deal state, customer/account context
- Asana: delivery execution, onboarding tasks, project coordination

## Trigger

- HubSpot webhook `deal.propertyChange` where `dealstage` moves into the closed-won stage

## Source of truth

- Commercial state and customer/account metadata: HubSpot
- Delivery execution and task/project state: Asana
- Workflow linkage: integration database or HubSpot custom property storing the Asana `gid`

## Sequence

1. Receive the HubSpot webhook and verify it corresponds to the target pipeline/stage.
2. Fetch the Deal, associated Company, and primary Contact.
3. Check whether an Asana task/project already exists for the Deal ID.
4. Create the onboarding project or kickoff task in Asana.
5. Populate notes and custom fields with customer, owner, ARR, plan, and target launch details.
6. Persist the Asana `gid` back to HubSpot or your integration store.
7. Notify the implementation owner or CSM if required.

## Field mapping

| HubSpot | Asana |
|---------|-------|
| `dealId` | external mapping / custom field |
| `dealname` | task/project name |
| associated company name | notes / title suffix |
| deal owner | assignee |
| close date | kickoff anchor or due date |
| ARR / amount | custom field |
| onboarding tier | custom field / template choice |

## Idempotency

- Dedup key: HubSpot Deal ID
- Webhook delivery is at-least-once, so check your mapping store before creation
- If using project templates, ensure only one project is generated per Deal ID

## Retry and partial failure policy

- Retry transient Asana failures with bounded backoff
- If Asana create succeeds but write-back to HubSpot fails, recover by searching the mapping store on the next run
- Validation errors should move the record into a manual review queue with the Deal ID and failing field

## Reconciliation

- Daily job: compare all closed-won deals in the last 30 days against Asana kickoff artifacts
- Backfill missing Asana `gid` values into HubSpot
- Flag onboarding projects with no matching active deal

## Rollback guidance

- If a Deal reopens or is marked closed-lost shortly after creation, archive or cancel the Asana project/task rather than deleting it
- Preserve the linkage so repeated stage churn does not create duplicates

## Observability

- Count created onboarding projects/tasks per day
- Alert on webhook processing failures and duplicate prevention hits
- Track time from closed won to Asana kickoff creation

## Related skills

- [`skills/hubspot/skill.md`](../skills/hubspot/skill.md)
- [`skills/asana/skill.md`](../skills/asana/skill.md)
