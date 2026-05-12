---
title: Slack Incident -> Jira Issue
systems:
  - slack
  - jira
tags:
  - incident
  - support
  - engineering
  - escalation
  - on-call
trigger_type: webhook_event
---

# Slack Incident -> Jira Issue

## Goal

Capture an incident discussion happening in Slack as a tracked Jira issue, so engineering, on-call, and leadership can follow resolution outside the noisy chat surface. The Slack message remains the conversation record; Jira becomes the accountable work item.

## Systems involved

- Slack: incident detection, real-time discussion, customer-impact reports
- Jira: durable tracking, engineering ownership, link to postmortem
- (Optional) PagerDuty or Opsgenie: paging — usually upstream of this playbook, not driven by it

## Trigger

Any of:
- A Slack message receives a designated reaction emoji (e.g. `:jira:` or `:rotating_light:`) — fired via Slack `reaction_added` event
- A Slack slash command (e.g. `/incident <summary>`) invoked in any channel
- A message posted in a channel matching `incident-*` with a designated keyword prefix

Reaction-based triggers are the most reliable and lowest-friction; slash commands are best when summary capture must be deliberate.

## Source of truth

- Incident discussion / customer-impact reports: Slack (channel + thread)
- Engineering execution state, severity, owner, resolution: Jira
- Linkage: Slack permalink in Jira description; Jira key replied to the Slack thread

## Sequence

1. Receive the inbound request — either a **Slack Events API event** (`reaction_added` or `message`) delivered as JSON with the event wrapped under an `event` object, OR a **Slash Command HTTP request** (separate endpoint, form-encoded body with `channel_id`, `user_id`, `text`, `trigger_id` at the top level — no `event` wrapper and no `event_id`). Both are signed by Slack; verify the request with `X-Slack-Signature` and `X-Slack-Request-Timestamp` (5-minute window).
2. **Ack with HTTP 200 immediately after signature verification — on every delivery, not just retries.** Slack Events API enforces a 3-second response budget on first delivery and on retries; missing it causes Slack to redeliver the event and creates avoidable duplicate work. Hand the remaining steps off to an async worker / queue. If a retry header is present (`X-Slack-Retry-Num`), treat it as an expected duplicate signal — still ack 200 and let the dedupe step catch it. (Slash Command requests don't carry retries but still benefit from immediate ack so the user sees a fast response.)
3. Build a deterministic correlation key: `slack:{team_id}:{channel_id}:{ts}`. The `{ts}` source depends on the trigger:
   - **`reaction_added`:** `event.item.ts` — the timestamp of the message that was reacted to.
   - **`message`:** `event.ts` — the original message timestamp; for replies posted into a thread, prefer `event.thread_ts` so the key anchors to the parent message and all in-thread activity collapses to one issue.
   - **Slash Command:** no inbound `message_ts` exists. Either (a) require the command be invoked from inside a thread and use `thread_ts` from the command payload, or (b — recommended default) the async worker first posts a bot anchor message via `chat.postMessage` and uses that posted message's `ts`. Option (b) requires no user training and gives the thread reply a natural place to land.
4. Fetch the originating message and thread context via `conversations.history` (with `latest=ts`, `inclusive=true`, `limit=1`) and `conversations.replies` for thread.
5. Resolve `permalink` for the message via `chat.getPermalink`.
6. Search Jira for an existing issue carrying that correlation key (label or custom field). If found, skip creation and reuse the Jira key.
7. If no existing issue, create a Jira issue (`POST /rest/api/3/issue`) with:
   - `summary` derived from the message text (first sentence, truncated to ~120 chars).
   - `description` containing the Slack permalink, the message text, and up to N thread replies for context.
   - `priority`, `issuetype`, `project`, `components` derived from per-channel config or sensible defaults.
   - A label `slack-incident` plus the correlation key as a label or custom-field value.
8. Reply in the Slack thread via `chat.postMessage` with the Jira issue link, key, and current assignee.
9. (Optional) Pin the bot reply if the channel is an incident channel.
10. (Optional) Mirror selected Jira status transitions back to Slack via `chat.postMessage` once a status mapping is finalized.

## Field mapping

| Slack | Jira |
|-------|------|
| Correlation source (varies by trigger): `reaction_added` → `event.item.channel` + `event.item.ts`; `message` → `event.channel` + `event.ts` (use `event.thread_ts` for in-thread replies); Slash Command → command payload `channel_id` + `ts` of the bot's anchor message (or `thread_ts` if invoked inside a thread) | correlation key `slack:{team_id}:{channel_id}:{ts}` stored in label / custom field |
| message text (first sentence) | `summary` |
| message text + thread replies + permalink | `description` — Jira Cloud REST v3 requires **ADF (Atlassian Document Format) JSON**; convert Slack text + thread replies into an ADF document (see `skills/jira/skill.md` § ADF) |
| reactor user / slash command invoker | `reporter` (after Slack-user -> Atlassian-account-id mapping) |
| channel name or category | `components` or labels |
| keyword/severity from text | `priority` (P1/P2/P3) |
| message permalink | external link field or `description` |

## Idempotency

- **Dedup key:** `slack:{team_id}:{channel_id}:{ts}` (same format as the correlation key in Sequence step 3) stored as a Jira label and/or a custom field for searchability.
- Slack delivers Events API events at least once. Dedupe at the edge using the **payload field `event_id`** (present in the JSON wrapper, not an HTTP header). Slash command requests have **no `event_id`** — dedupe those by correlation key alone. Always re-dedupe by correlation key immediately before the Jira create call.
- If multiple users react with the trigger emoji on the same message, only the first reaction creates the issue; subsequent reactions are noops (or append a reactor list to the Jira issue).
- Slash command invocations must check correlation by `channel_id + thread_ts` first to avoid duplicating during incidents.

## Retry and partial failure policy

- **Slack rate limits** are per-method tier (Tier 1: 1+/min, Tier 4: 100+/min). On `429`, respect the `Retry-After` header — do not retry sooner.
- **Jira rate limits** use cost-based throttling. On `429` or `503`, use bounded exponential backoff (base 1s, max 60s, max 5 attempts).
- Do not blindly retry Jira `400` validation errors — log, surface to operators, and quarantine the event.
- If Jira create succeeds but the Slack thread reply fails, do not retry Jira create. Reconcile by searching Jira for the correlation key and posting the thread reply on the next event or reconciliation pass.
- Slack event endpoints must return 200 within 3 seconds. Push work to a queue if create + reply exceeds that budget.

## Reconciliation

- Hourly or daily job: scan recent messages in channels matching `incident-*` for trigger reactions/keywords and confirm a Jira issue with the matching correlation key exists. Create any missing issues.
- Reverse pass: list Jira issues with label `slack-incident` updated in the last 24h; verify each has at least one Slack thread reply with the Jira link. Repair missing replies.
- Drift check: confirm Jira issues marked `Done` have a corresponding Slack thread reply announcing closure (if status mirroring is enabled).

## Rollback guidance

- If a Jira issue was created in error, transition it to a closed/cancelled state (`Won't Do`, `Cancelled`) rather than deleting it — preserves the dedup key so an accidental re-reaction does not recreate it.
- Remove the trigger reaction in Slack via `reactions.remove` (cosmetic) and add a `:white_check_mark:` reply explaining the cancellation.
- Add the correlation key to a deny-list table to prevent re-creation if reactions get added again.

## Observability

- Time from reaction to Jira issue creation (target: < 5s p95).
- Daily count of incidents created, by channel and by reactor.
- Duplicate-detection rate (events that would have created duplicates but were short-circuited).
- Failed Slack signature verifications (anomalous — investigate).
- Failed Jira creates, broken down by HTTP status and error code.
- Lag between Jira closure and Slack-thread closure message.

## Related skills

- [`skills/slack/skill.md`](../skills/slack/skill.md)
- [`skills/jira/skill.md`](../skills/jira/skill.md)
