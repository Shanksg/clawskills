# Slack Skill

> **Last validated:** 2026-02-26 | **API:** Slack Web API (no versioned URL path)
> **REST base URL:** `https://slack.com/api/`
> **Assumed product:** Slack (cloud). Slack Enterprise Grid adds org-level APIs but the core methods are identical.

---

## What this skill enables

- Send messages and rich Block Kit cards to any channel, DM, or thread from external systems.
- Build notification pipelines: alert on-call engineers, post deploy summaries, surface CRM events in team channels.
- Manage channels programmatically: create, archive, invite users, and sync membership from external directories.
- Respond to user actions in real time: slash commands, interactive buttons, modals (views), and workflow steps.
- Sync data bi-directionally: listen to Slack events (messages, reactions, channel membership) and reflect changes in external tools.
- Upload and share files: attach reports, screenshots, and exports directly in channels.
- Search and audit: query message history for compliance or reporting pipelines.

---

## Best-fit use cases

| Use case | Why it matters | Primary objects | Typical trigger | Success criteria |
|----------|---------------|-----------------|-----------------|-----------------|
| Post alert to on-call channel | Instant human awareness of incidents | Message, Channel | PagerDuty/Datadog webhook | Message posted with link to runbook within 2s |
| Deploy summary notification | Keep team informed without polling dashboards | Message, Block Kit | CI/CD pipeline completes | Formatted message with pass/fail + diff link |
| Sync CRM deal update to sales channel | Surface revenue moments to the team | Message, Thread | HubSpot/Salesforce webhook | Deal name, stage, and owner in message |
| Create ticket from Slack reaction | Lightweight triage without leaving Slack | Reaction event, Message | User adds 🎫 emoji to a message | Jira/Zendesk ticket created, permalink posted in thread |
| Slash command → workflow | Self-service automation from Slack UI | Slash command, Modal | User types `/create-ticket` | Modal opens, user fills form, ticket created |
| User lookup by email | Resolve an email address to a Slack user ID | User | Before sending a DM | `user_id` returned for `conversations.open` |
| Daily digest | Scheduled summary of CRM/ops data | Message, Scheduled post | Cron job | Summary message posted at 9 AM team timezone |
| Channel membership sync | Keep project channels aligned with HRIS/CRM | Channel, User | User onboarding/offboarding event | User invited or removed from correct channels |
| File report delivery | Share generated reports without email | File | Scheduled job or request | File uploaded, shared in channel with comment |
| Webhook event to external system | Mirror Slack activity to ops tools | Events API | Message posted, reaction added | External system receives and processes event within 3s |

---

## Key concepts & data model

### Core objects

| Object | Description | Identified by |
|--------|-------------|---------------|
| **Workspace** | A Slack organization | `team_id` (e.g., `T01ABCDEF`) |
| **Channel** | Public channel, private channel, DM, or MPIM (group DM) | `channel_id` (e.g., `C01ABCDEF` public, `G01…` private, `D01…` DM) |
| **User** | A person in the workspace | `user_id` (e.g., `U01ABCDEF`) |
| **Bot** | A non-human entity representing a Slack app | `bot_id` (e.g., `B01ABCDEF`) |
| **Message** | A chat message in a channel or thread | `(channel_id, ts)` tuple — `ts` is a Unix timestamp string like `"1706200000.123456"` |
| **Thread** | A sub-conversation anchored to a message | Parent message's `ts` used as `thread_ts` |
| **File** | An uploaded file or snippet | `file_id` (e.g., `F01ABCDEF`) |
| **Reaction** | An emoji added to a message | `(name, user_id, item)` — `name` is the emoji name without colons |
| **App** | A Slack integration/bot | `app_id` (e.g., `A01ABCDEF`) |
| **View** | A modal or App Home surface | `view_id` returned by `views.open` |

### Channel types and ID prefixes

| Prefix | Type | Notes |
|--------|------|-------|
| `C` | Public channel | Visible to all workspace members |
| `G` | Private channel / MPIM | Invite-only; group DMs also use `G` |
| `D` | Direct message | Between bot and one user |

> **Tip:** Always resolve channel names to IDs at startup using `conversations.list` and cache them. Names can change; IDs are stable.

### Message timestamps (`ts`)

Slack uses `ts` (timestamp) as the primary message identifier — it is a string like `"1706200000.123456"`, not a number. Always store and compare as a string. The `ts` of the parent message is passed as `thread_ts` to post into a thread.

### Relationships

```
Workspace (team_id)
  ├── Channel (C / G / D)
  │     ├── Message (channel + ts)
  │     │     ├── Thread replies (thread_ts = parent ts)
  │     │     ├── Reactions
  │     │     └── File attachments
  │     └── Members (user_ids)
  ├── User (U)
  └── App / Bot (A / B)
```

---

## Authentication & permissions

### Supported auth methods

| Method | Best for | Token format |
|--------|----------|-------------|
| **Bot token** | All server-to-server automation (recommended) | `xoxb-...` |
| **User token** | Acting as a specific user; required for some user-only methods | `xoxp-...` |
| **App-level token** | Socket Mode (WebSocket) connections only | `xapp-...` |
| **Incoming Webhook URL** | Simple one-way message posting with no SDK | Full URL, e.g. `https://hooks.slack.com/services/T.../B.../...` |

**Bot tokens are recommended** for all automation — they have stable identity, are scoped to the app, and do not expose any individual user's data.

### Creating a Slack App and getting a bot token

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From Manifest** (or From Scratch).
2. Under **OAuth & Permissions** → **Bot Token Scopes**, add the scopes your app needs (see table below).
3. **Install App** to your workspace → copy the **Bot User OAuth Token** (`xoxb-...`).
4. Store the token as an environment variable: `SLACK_BOT_TOKEN`.

```bash
curl -s https://slack.com/api/auth.test \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json"
# Response: {"ok": true, "team": "Acme Corp", "user": "my-bot", "team_id": "T01...", "user_id": "U01..."}
```

### Required scopes (bot token — least privilege)

| Scope | Purpose |
|-------|---------|
| `chat:write` | Post messages as the bot |
| `chat:write.public` | Post to public channels without joining first |
| `channels:read` | List public channels, get channel info |
| `channels:history` | Read messages in public channels the bot has joined |
| `groups:read` | List private channels the bot is a member of |
| `groups:history` | Read messages in private channels |
| `im:read` | List DMs the bot has open |
| `im:write` | Open DMs with users |
| `im:history` | Read DM messages |
| `users:read` | Get user info (name, display name, tz) |
| `users:read.email` | Look up users by email address |
| `files:write` | Upload files |
| `reactions:read` | Read reactions on messages |
| `reactions:write` | Add/remove reactions |
| `channels:join` | Join public channels programmatically |
| `channels:manage` | Create/archive public channels |
| `groups:write` | Create/archive private channels |
| `team:read` | Get workspace info |
| `search:read` | Search messages (user token only — not available to bots) |

> **Note:** `search:read` requires a **user token** (`xoxp-...`). There is no bot-accessible search API; use `conversations.history` + cursor pagination for bot-accessible message scanning.

### Required headers (always include)

```
Authorization: Bearer xoxb-your-token
Content-Type: application/json
```

> **Legacy note:** Some Slack docs show `application/x-www-form-urlencoded` POST bodies. This still works but JSON (`application/json`) is the modern approach and is required for Block Kit payloads.

### Token storage

- Store bot tokens in environment variables or a secrets manager (AWS Secrets Manager, HashiCorp Vault). Never commit to code.
- Bot tokens do not expire unless the app is uninstalled or the token is revoked. Implement health checks (call `auth.test` on startup) to detect revocation early.
- For multi-workspace (Slack Connect / distribution), use OAuth 2.0 and store one bot token per workspace in your database.

---

## Common workflows (recipes)

### Recipe 1: Post a message to a channel

**Goal:** Send a formatted notification to a channel.

```bash
curl -s -X POST https://slack.com/api/chat.postMessage \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "C01ABCDEF",
    "text": "Deployment complete: *api-service v2.3.1* deployed to production.",
    "blocks": [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": ":white_check_mark: *api-service v2.3.1* deployed to *production*\n*Duration:* 2m 14s | *By:* @janesmith"
        }
      },
      {
        "type": "actions",
        "elements": [
          {
            "type": "button",
            "text": { "type": "plain_text", "text": "View Logs" },
            "url": "https://logs.example.com/deploy/1234",
            "action_id": "view_logs"
          }
        ]
      }
    ]
  }'
# Response: {"ok": true, "channel": "C01ABCDEF", "ts": "1706200000.123456", "message": {...}}
```

**Always include both `text` and `blocks`.** The `text` field is the fallback for notifications and accessibility tools — it is displayed when blocks cannot be rendered.

**Edge cases:**
- Bot must be a member of the channel (or use the `chat:write.public` scope for public channels).
- If `channel` is a user ID (e.g., `U01...`), Slack will send a DM. Alternatively, use Recipe 3 to open a DM first.
- To post to a private channel, the bot must be invited first: `conversations.invite`.

---

### Recipe 2: Post a reply in a thread

**Goal:** Add a reply to an existing message thread.

```bash
curl -s -X POST https://slack.com/api/chat.postMessage \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "C01ABCDEF",
    "thread_ts": "1706200000.123456",
    "text": "Incident resolved. Root cause: connection pool exhaustion. Post-mortem linked below.",
    "reply_broadcast": false
  }'
```

**`reply_broadcast: true`** also sends the reply to the main channel (appears in both thread and channel).

---

### Recipe 3: Send a direct message to a user

**Goal:** Open a DM channel with a user and post a message.

```bash
# Step 1 — open a DM channel (idempotent — returns existing channel if open)
DM_CHANNEL=$(curl -s -X POST https://slack.com/api/conversations.open \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"users": "U01ABCDEF"}' \
  | jq -r '.channel.id')

# Step 2 — post message
curl -s -X POST https://slack.com/api/chat.postMessage \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"channel\": \"$DM_CHANNEL\",
    \"text\": \"Hi! Your Salesforce deal has moved to Proposal stage.\"
  }"
```

---

### Recipe 4: Look up a user by email

**Goal:** Find a user's Slack ID from their email address (e.g., from a CRM record).

```bash
curl -s -G "https://slack.com/api/users.lookupByEmail" \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  --data-urlencode "email=janesmith@example.com"
# Response: {"ok": true, "user": {"id": "U01ABCDEF", "name": "janesmith", "tz": "America/New_York", ...}}
```

Requires `users:read.email` scope. Store the resolved `user_id` — do not call this on every request.

---

### Recipe 5: Update or delete a message

**Goal:** Edit a previously posted message (e.g., update a status message as a deployment progresses).

```bash
# Update
curl -s -X POST https://slack.com/api/chat.update \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "C01ABCDEF",
    "ts": "1706200000.123456",
    "text": "Deployment FAILED: api-service v2.3.1",
    "blocks": [
      {
        "type": "section",
        "text": { "type": "mrkdwn", "text": ":x: *Deployment FAILED* — api-service v2.3.1\nSee <https://logs.example.com/1234|logs> for details." }
      }
    ]
  }'

# Delete
curl -s -X POST https://slack.com/api/chat.delete \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"channel": "C01ABCDEF", "ts": "1706200000.123456"}'
```

**Pattern:** Post a "starting…" message, save the returned `ts`, then update it in place as the operation progresses. This avoids flooding the channel with multiple messages.

---

### Recipe 6: Upload a file to a channel

**Goal:** Share a generated report or screenshot in a channel. Use the two-step upload API (recommended since 2023).

```python
import requests, os

token = os.environ["SLACK_BOT_TOKEN"]
headers = {"Authorization": f"Bearer {token}"}

# Step 1 — get an upload URL
resp = requests.get(
    "https://slack.com/api/files.getUploadURLExternal",
    headers=headers,
    params={"filename": "report.csv", "length": os.path.getsize("report.csv")}
)
data = resp.json()
upload_url = data["upload_url"]
file_id = data["file_id"]

# Step 2 — upload the file content to the pre-signed URL
with open("report.csv", "rb") as f:
    requests.post(upload_url, data=f)

# Step 3 — complete the upload and share to channel
requests.post(
    "https://slack.com/api/files.completeUploadExternal",
    headers=headers,
    json={
        "files": [{"id": file_id, "title": "Weekly Report"}],
        "channel_id": "C01ABCDEF",
        "initial_comment": "Here's the weekly ops report."
    }
)
```

> **Avoid** `files.upload` (the old single-call method) — it is deprecated and has a 1 GB limit vs. much larger limits on the new API.

---

### Recipe 7: Add a reaction to a message

**Goal:** React to a message programmatically (e.g., acknowledge receipt by adding ✅).

```bash
curl -s -X POST https://slack.com/api/reactions.add \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "C01ABCDEF",
    "timestamp": "1706200000.123456",
    "name": "white_check_mark"
  }'
```

Emoji `name` is the text between colons (e.g., `:white_check_mark:` → `"white_check_mark"`). Custom emoji are referenced by their workspace name.

---

### Recipe 8: List channels and resolve names to IDs

**Goal:** Build and cache a channel name → ID map at startup.

```python
import requests

def get_channel_map(token: str) -> dict[str, str]:
    """Returns {channel_name: channel_id} for all public channels."""
    headers = {"Authorization": f"Bearer {token}"}
    channel_map = {}
    cursor = None

    while True:
        params = {"limit": 200, "exclude_archived": True, "types": "public_channel"}
        if cursor:
            params["cursor"] = cursor

        resp = requests.get(
            "https://slack.com/api/conversations.list",
            headers=headers,
            params=params
        ).json()

        if not resp["ok"]:
            raise Exception(f"Slack error: {resp['error']}")

        for ch in resp["channels"]:
            channel_map[ch["name"]] = ch["id"]

        cursor = resp.get("response_metadata", {}).get("next_cursor")
        if not cursor:
            break

    return channel_map

# Usage
CHANNELS = get_channel_map(os.environ["SLACK_BOT_TOKEN"])
post_to = CHANNELS["engineering-deploys"]
```

---

### Recipe 9: Read channel history (incremental sync)

**Goal:** Fetch messages posted since the last sync run.

```python
import requests, time

def fetch_messages_since(token: str, channel_id: str, oldest_ts: str) -> list:
    headers = {"Authorization": f"Bearer {token}"}
    messages = []
    cursor = None

    while True:
        params = {"channel": channel_id, "oldest": oldest_ts, "limit": 200}
        if cursor:
            params["cursor"] = cursor

        resp = requests.get(
            "https://slack.com/api/conversations.history",
            headers=headers,
            params=params
        ).json()

        if not resp["ok"]:
            raise Exception(f"Slack error: {resp['error']}")

        messages.extend(resp["messages"])

        if not resp.get("has_more"):
            break
        cursor = resp["response_metadata"]["next_cursor"]

    return messages

# Store the latest ts after each run as the next oldest
latest_ts = str(time.time() - 3600)  # last hour on first run
messages = fetch_messages_since(token, "C01ABCDEF", latest_ts)
next_run_ts = messages[0]["ts"] if messages else latest_ts
```

---

### Recipe 10: Receive and verify Events API payloads

**Goal:** Handle real-time Slack events (message posted, reaction added, member joined, etc.) in your webhook endpoint.

**App setup:** In your Slack App config → **Event Subscriptions** → enable, set Request URL to your endpoint, subscribe to bot events (e.g., `message.channels`, `reaction_added`).

**URL verification (one-time, on first save):**
```python
from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route("/slack/events", methods=["POST"])
def slack_events():
    body = request.json

    # Slack URL verification challenge
    if body.get("type") == "url_verification":
        return jsonify({"challenge": body["challenge"]})

    # Verify signature before processing
    if not verify_slack_signature(request):
        return "", 403

    event = body.get("event", {})
    # Handle asynchronously — must return 200 within 3 seconds
    handle_event_async(event)
    return "", 200
```

**Signature verification (required — never skip this):**
```python
import hmac, hashlib, time

SLACK_SIGNING_SECRET = os.environ["SLACK_SIGNING_SECRET"]

def verify_slack_signature(request) -> bool:
    timestamp = request.headers.get("X-Slack-Request-Timestamp", "")
    sig_header = request.headers.get("X-Slack-Signature", "")

    # Reject requests older than 5 minutes (replay attack prevention)
    if abs(time.time() - int(timestamp)) > 300:
        return False

    base_string = f"v0:{timestamp}:{request.get_data(as_text=True)}"
    expected = "v0=" + hmac.new(
        SLACK_SIGNING_SECRET.encode(),
        base_string.encode(),
        hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(expected, sig_header)
```

**Critical:** Respond with HTTP 200 within **3 seconds**. If processing takes longer, return 200 immediately and process asynchronously (queue the event). Slack retries failed deliveries 3 times.

---

### Recipe 11: Invite a user to a channel

**Goal:** Add a user to a private channel when they join a project.

```bash
curl -s -X POST https://slack.com/api/conversations.invite \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "G01ABCDEF",
    "users": "U01ABCDEF,U02ABCDEF"
  }'
# Response: {"ok": true, "channel": {...}}
# Error if user is already a member: {"ok": false, "error": "already_in_channel"}
```

Multiple users can be invited in one call by comma-separating `users`.

---

## Query patterns & filtering

### Pagination

All list endpoints use **cursor-based pagination**. Never use `page`/`offset` (not supported on most Slack endpoints).

```python
def paginate_slack(token: str, method: str, params: dict) -> list:
    """Generic cursor-based paginator for Slack list methods."""
    headers = {"Authorization": f"Bearer {token}"}
    results = []
    cursor = None
    list_key = None  # auto-detected

    while True:
        p = {**params, "limit": 200}
        if cursor:
            p["cursor"] = cursor

        resp = requests.get(
            f"https://slack.com/api/{method}",
            headers=headers,
            params=p
        ).json()

        if not resp["ok"]:
            raise Exception(f"Slack error {method}: {resp['error']}")

        # Detect the list key (channels, members, users, messages, etc.)
        if list_key is None:
            list_key = next((k for k in resp if isinstance(resp[k], list) and k != "warnings"), None)
        if list_key:
            results.extend(resp[list_key])

        cursor = resp.get("response_metadata", {}).get("next_cursor")
        if not cursor:
            break

    return results
```

### Filtering messages

- **By time range:** Use `oldest` and `latest` parameters (Unix timestamp strings) on `conversations.history`.
- **By thread:** Use `conversations.replies` with `ts` of the parent message.
- **Bot vs human messages:** Check `subtype` field — bot messages have `subtype: "bot_message"` or `bot_id` present.
- **Ignore system messages:** Filter out messages with `subtype` set (e.g., `channel_join`, `channel_leave`).

### Message deduplication

Use `(channel_id, ts)` as a composite key — `ts` is unique within a channel. For Events API, Slack may retry the same event; use the event's `event_id` as an idempotency key:

```python
processed_events = set()  # use Redis in production

def handle_event_async(event_wrapper: dict):
    event_id = event_wrapper.get("event_id")
    if event_id in processed_events:
        return  # already handled
    processed_events.add(event_id)
    # ... process event
```

---

## Reliability: rate limits, retries, idempotency

### Rate limits (verified 2026-02-26)

Slack uses a **tiered** rate limit system, applied per workspace per method:

| Tier | Limit | Examples |
|------|-------|---------|
| **Tier 1** | 1+ req/min | `conversations.create`, `admin.*` |
| **Tier 2** | 20+ req/min | `auth.test`, `conversations.info`, `files.info` |
| **Tier 3** | 50+ req/min | `conversations.history`, `conversations.list`, `users.info`, `reactions.add` |
| **Tier 4** | 100+ req/min | `chat.postMessage`, `chat.update`, `users.list` |
| **Special** | 1 req/sec per channel | `chat.postMessage` per-channel sub-limit (regardless of Tier 4) |

When rate limited, Slack returns **HTTP 429** with a `Retry-After` header (seconds to wait).

> **Practical limit for `chat.postMessage`:** Even though it is Tier 4 (100/min workspace-wide), there is a per-channel limit of ~1 req/sec. For burst messaging to the same channel, add a 1-second delay between calls or use `chat.scheduleMessage`.

### Retry strategy

```python
import time, requests

def slack_api(method: str, token: str, **kwargs) -> dict:
    url = f"https://slack.com/api/{method}"
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    for attempt in range(5):
        resp = requests.post(url, headers=headers, json=kwargs)

        if resp.status_code == 429:
            retry_after = int(resp.headers.get("Retry-After", 5))
            time.sleep(retry_after)
            continue

        if resp.status_code >= 500:
            time.sleep(2 ** attempt)
            continue

        data = resp.json()
        if not data["ok"]:
            if data["error"] == "ratelimited":
                time.sleep(int(resp.headers.get("Retry-After", 5)))
                continue
            raise Exception(f"Slack API error: {data['error']}")

        return data

    raise Exception("Max retries exceeded")
```

> **Note:** Slack always returns HTTP 200, even for application-level errors. Always check `data["ok"]` — not just the HTTP status code.

### Idempotency patterns

- **`chat.postMessage`:** Not natively idempotent. To avoid duplicate messages, use an external idempotency key: check whether a message with your known content/ts already exists in the channel before posting, or store the returned `ts` in your database.
- **`conversations.invite`:** Already idempotent — returns `already_in_channel` error (not a failure) if user is a member.
- **`reactions.add`:** Returns `already_reacted` if reaction already exists — safe to ignore.
- **Events API:** Use `event_id` as an idempotency key in Redis/database to deduplicate retried events.

---

## Error handling & troubleshooting

### All Slack errors follow this pattern

```json
{ "ok": false, "error": "channel_not_found" }
```

HTTP status is always 200. Parse the response body to detect errors.

### Common errors

| Error string | Meaning | Fix |
|-------------|---------|-----|
| `not_in_channel` | Bot is not a member of the channel | Invite the bot or use `chat:write.public` scope |
| `channel_not_found` | Channel ID is wrong or bot can't see it | Verify channel ID; check bot is in workspace |
| `invalid_auth` | Token is invalid or revoked | Re-generate token; check env var |
| `missing_scope` | Bot token lacks required scope | Add scope in App config → reinstall app |
| `ratelimited` | Rate limit hit | Respect `Retry-After` header |
| `already_in_channel` | User already a channel member | Ignore — treat as success |
| `already_reacted` | Reaction already exists | Ignore — treat as success |
| `cant_invite_self` | Trying to invite the bot to a channel it's in | Ignore |
| `msg_too_long` | Message text exceeds 40,000 chars | Split into multiple messages |
| `no_text` | Empty `text` and no `blocks` | Always provide `text` as fallback |
| `restricted_action` | Workspace admin has blocked this action | Contact workspace admin |
| `is_archived` | Channel is archived | Unarchive or use a different channel |
| `thread_not_found` | `thread_ts` doesn't match any message | Verify `ts` is stored as a string, not float |
| `ekm_access_denied` | Enterprise Key Management restriction | Use an org-approved token |

### "If you see X, do Y" playbook

- **Bot posts in the wrong channel / no message appears:** Verify the `channel` value is a channel ID (`C...`) not a name. Channel names are not accepted by `chat.postMessage`.
- **Messages appear in the channel but with broken formatting:** You passed `text` with `*bold*` or `_italic_` — use `mrkdwn` format (Slack's dialect), not standard Markdown. Key differences: `*bold*`, `_italic_`, `~strike~`, `<URL|link text>`, `<@U01...>` mentions.
- **Events API URL fails verification:** Your endpoint didn't return `{"challenge": ...}` within 3 seconds, or returned incorrect content. Ensure JSON response with `Content-Type: application/json`.
- **Events arrive but signature verification fails:** Make sure you're reading the raw request body (not parsed JSON) for HMAC calculation. Some frameworks re-encode the body — use the raw bytes.
- **`files.upload` returns `ok: false`:** The old upload method is deprecated. Switch to `files.getUploadURLExternal` + `files.completeUploadExternal`.
- **`chat.update` returns `cant_update_message`:** Only the bot that originally posted the message can update it. You cannot update messages posted by other bots or users.
- **Thread replies not appearing in thread:** You passed `thread_ts` correctly but used a different channel ID. The `channel` and `thread_ts` must both match the original message.

### Debug logging

Log: API method, channel/user ID, response `ok` field, `error` field (if any), HTTP status, `Retry-After` (on 429).
Do NOT log: token values, full message text (may contain PII), file contents.

---

## Security, privacy, compliance

- **Least privilege:** Request only the scopes your app needs. Slack's permission model is per-scope, not per-channel — a `channels:history` scope grants access to all public channels the bot is in.
- **Token storage:** Never expose bot tokens in client-side code, logs, or URLs. Store in environment variables or a secrets manager. Bot tokens do not expire but can be revoked — implement `auth.test` health checks.
- **Signing secret:** Always verify `X-Slack-Signature` on all incoming webhooks and Events API payloads. Do not process unsigned requests.
- **DMs and private channels:** Private messages are sensitive. Minimize bot access to DMs and private channels; request only the scopes needed. Slack Enterprise Grid adds Data Loss Prevention (DLP) controls.
- **User data (PII):** `users.list` and `users.info` return display names, real names, and email addresses. Handle this data per your privacy policy — do not store more than necessary.
- **Message content:** Slack messages can contain PII, credentials, or confidential data. Treat message content as sensitive; do not log full message text in production.
- **Audit logs:** Slack Enterprise Grid provides an Audit Logs API (`audit.logs.v1`) for compliance logging. Standard Slack does not expose per-workspace audit logs via API.
- **Bot impersonation:** Never use `as_user: true` with a user token to post as a human user in automated flows — this is misleading and may violate your workspace's acceptable use policy.
- **GDPR:** Slack supports data export requests. If a user requests deletion, messages they sent cannot be deleted via API by bots (only the user or workspace admin can delete messages). Plan for this in your data retention policy.

---

## Testing checklist

- [ ] **Auth test:** `GET https://slack.com/api/auth.test` → `ok: true`, bot name and team visible.
- [ ] **Post message test:** `chat.postMessage` to a test channel → message appears with correct formatting; both `text` and `blocks` render correctly.
- [ ] **Thread test:** Reply to the posted message using `thread_ts` → reply appears in thread, not in main channel.
- [ ] **DM test:** `conversations.open` with a test user ID → `chat.postMessage` to returned DM channel → message arrives.
- [ ] **User lookup test:** `users.lookupByEmail` with a valid email → returns correct `user_id`.
- [ ] **Channel list test:** `conversations.list` with pagination → all channels returned; cursor exhausted.
- [ ] **History test:** `conversations.history` with `oldest` param → only messages after cutoff returned.
- [ ] **File upload test:** Full three-step upload flow → file appears in channel with comment.
- [ ] **Reaction test:** `reactions.add` → emoji visible on message; calling again returns `already_reacted` (not an error).
- [ ] **Rate limit test:** Send >1 req/sec to the same channel → 429 received → `Retry-After` respected → retry succeeds.
- [ ] **Events API test:** Post a message in a subscribed channel → event received at your endpoint within 3s → `event_id` logged; posting same message again doesn't reprocess.
- [ ] **Signature verification test:** Send request with invalid signature → 403 returned.
- [ ] **Negative tests:**
  - Bot not in channel → `not_in_channel`
  - Invalid token → `invalid_auth`
  - Non-existent channel ID → `channel_not_found`
  - `thread_ts` stored as float → `thread_not_found` (must be string)
  - Missing `text` field with blocks → `no_text`

---

## Sources

- Slack Web API methods: https://api.slack.com/methods
- Authentication & token types: https://api.slack.com/authentication/token-types
- OAuth scopes: https://api.slack.com/scopes
- Block Kit (rich message formatting): https://api.slack.com/block-kit
- Block Kit Builder (interactive): https://app.slack.com/block-kit-builder
- Events API: https://api.slack.com/events-api
- Signing secrets & request verification: https://api.slack.com/authentication/verifying-requests-from-slack
- Rate limits: https://api.slack.com/docs/rate-limits
- File upload (new API): https://api.slack.com/methods/files.getUploadURLExternal
- Conversations API: https://api.slack.com/docs/conversations-api
- Pagination: https://api.slack.com/docs/pagination
- Incoming Webhooks: https://api.slack.com/messaging/webhooks
- Socket Mode: https://api.slack.com/apis/socket-mode
- Enterprise Grid Audit Logs API: https://api.slack.com/admins/audit-logs
- mrkdwn formatting reference: https://api.slack.com/reference/surfaces/formatting
