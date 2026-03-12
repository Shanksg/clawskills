---
title: Zendesk Ticket -> Jira Bug Escalation
systems:
  - zendesk
  - jira
tags:
  - support
  - engineering
  - escalation
  - incident
  - handoff
trigger_type: webhook_or_incremental_sync
---

# Zendesk Ticket -> Jira Bug Escalation

## Goal

Escalate a Zendesk support ticket into Jira when support determines the issue is a product defect that engineering must track and resolve.

## Systems involved

- Zendesk: intake, customer communication, support triage
- Jira: engineering backlog, bug lifecycle, fix tracking

## Trigger

Any of:
- Zendesk ticket gets tag `engineering`
- Custom field `issue_type` changes to `bug`
- Ticket priority becomes `urgent` and product area is set

## Source of truth

- Customer communication and ticket state: Zendesk
- Engineering execution state: Jira
- Escalation linkage: integration database or mirrored external ID field

## Sequence

1. Receive the Zendesk webhook or consume the ticket via Incremental Export.
2. Build a deterministic correlation key: `zendesk:{ticket_id}`.
3. Search Jira for an existing issue with that correlation key in a custom field or label.
4. If no issue exists, create a Jira Bug with summary, reproduction notes, impact, and Zendesk URL.
5. If an issue already exists, update priority, labels, assignee, and current reproduction context.
6. Write the Jira issue key back to Zendesk as an internal note or custom field.
7. Optionally mirror selected Jira status changes back to Zendesk after state mapping is finalized.

## Field mapping

| Zendesk | Jira |
|---------|------|
| `ticket.id` | custom external ID / label |
| `subject` | `summary` |
| latest public comment | `description` |
| `priority` | `priority` |
| `tags` | `labels` |
| requester org / account | custom customer field or component |
| product area custom field | component / label |

## Idempotency

- Dedup key: `zendesk:{ticket_id}`
- Before create, always search Jira by dedup key
- Zendesk webhooks are at-least-once delivery, so the create path must be safe to replay

## Retry and partial failure policy

- Retry transient Jira failures (`429`, `503`) with bounded exponential backoff
- Do not retry `400` field validation errors blindly; quarantine and surface them
- If Jira create succeeds but Zendesk write-back fails, reconcile by searching Jira with the dedup key on the next run

## Reconciliation

- Daily job: compare Zendesk tickets tagged `engineering` against Jira bugs with the dedup key
- Repair missing backlinks in Zendesk
- Flag Jira issues missing an active Zendesk ticket counterpart

## Rollback guidance

- If a Jira issue was created in error, transition it to a closed/cancelled state instead of deleting it
- Remove the escalation tag or set a custom field in Zendesk to prevent automatic recreation

## Observability

- Count escalations per day
- Alert on create failures, write-back failures, or rising duplicate-detection rates
- Track mean time from Zendesk escalation to Jira issue creation

## Related skills

- [`skills/zendesk/skill.md`](../skills/zendesk/skill.md)
- [`skills/jira/skill.md`](../skills/jira/skill.md)
