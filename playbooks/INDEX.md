# Playbooks Index

Workflow playbooks are end-to-end guides for multi-system automations. They complement the per-tool `skill.md` files by defining the orchestration layer: trigger, source of truth, field mapping, idempotency, failure policy, and operational checks.

## Available playbooks

| Playbook | Systems | Primary use case |
|----------|---------|------------------|
| [Zendesk Ticket -> Jira Bug escalation](./zendesk-jira-bug-escalation.md) | Zendesk, Jira | Escalate support-confirmed defects into engineering workflow |
| [HubSpot Deal Won -> Asana onboarding kickoff](./hubspot-asana-onboarding.md) | HubSpot, Asana | Start implementation or onboarding work when a deal closes |
| [Salesforce Lead -> HubSpot Contact sync](./salesforce-hubspot-lead-sync.md) | Salesforce, HubSpot | Mirror new/updated leads into marketing automation without duplicates |

## Playbook template

Each playbook should define:
- Business trigger
- Systems involved
- Source of truth
- Sequence of operations
- Field mapping
- Idempotency and dedup keys
- Retry / partial-failure policy
- Reconciliation / rollback guidance
- Observability checks

## Next candidates

- Slack incident -> Jira issue
- GitHub PR -> Slack notification
- Zendesk -> Salesforce case sync
- Stripe payment failed -> HubSpot task
- Notion request -> Asana task
