# Figma Skill Reference

**Last validated:** 2026-08-02
**API version:** REST API v1 (stable) | Webhooks V2 (stable) | Pin `X-Figma-Api-Version` not required — versioning is path-based (`/v1/`, `/v2/`)
**Base URL:** `https://api.figma.com` (Government: `https://api.figma-gov.com`)

> **New since 2026-02:**
> - **Plan access tokens — GA July 23, 2026.** Organization- and Enterprise-plan tokens that are **not tied to an individual user account**, with expiry up to one year and optional allowlists, managed by plan admins. This is now the recommended credential for CI/CD and org automation — it survives the token owner leaving the company, which personal access tokens do not. See Authentication below.
> - **oEmbed API — March 25, 2026.** `oEmbed 1.0`-spec endpoint returning metadata for Figma files and published Makes. Requires the `file_metadata:read` scope.
> - **AI Usage API — June 12, 2026.** Enterprise-only endpoint returning per-user, per-day AI credit usage. Requires the `org:ai_metering_usage_read` scope and a plan access token.
>
> **Docs moved:** the developer docs are now at `developers.figma.com/docs/rest-api/`; the old `figma.com/developers/api` URL redirects there.

> **Breaking changes to be aware of:**
> - **Nov 17, 2025** — New tiered rate limits in effect; rate limits now vary by plan (Starter/Professional/Organization/Enterprise) and seat type (View/Collab vs Dev/Full).
> - **May 28, 2025** — Webhooks V2 major update: webhooks now attach to teams, files, or projects. `GET /v2/teams/:team_id/webhooks` deprecated → use `GET /v2/webhooks`. `DEV_MODE_STATUS_UPDATE` event added.
> - **Nov 17, 2025** — OAuth apps must complete the new publishing flow (mandatory as of this date).
> - **`files:read` scope** is deprecated — use granular scopes (`file_content:read`, `file_metadata:read`, etc.).

---

## What this skill enables

- Read the full JSON structure of any Figma file (nodes, frames, components, styles, variables)
- Export/render nodes as PNG, SVG, PDF, or JPEG via the Images API
- Create, read, and reply to comments on design files
- Inspect published components, styles, and variables for design-system automation
- List team projects and files programmatically
- Register webhooks that fire on file changes, comments, version publishes, and Dev Mode updates
- Automate design-to-dev handoff workflows: extract dev resources, inspect variable values

---

## Best-fit use cases

| Use Case | Trigger | Success Criteria |
|----------|---------|-----------------|
| Design-to-ticket sync | New Figma comment mentioning `@dev` | Jira/GitHub issue created with screenshot + frame link |
| Component catalog export | Scheduled daily | All published components exported to JSON/PNG with metadata |
| Design token extraction | File version published | Variables/styles exported as JSON design tokens (Style Dictionary format) |
| Asset pipeline | Frame or component exported | PNG/SVG assets committed to repo or uploaded to CDN |
| Design review notification | `FILE_VERSION_UPDATE` webhook | Slack/email sent to reviewers with changelog summary |
| Spec link on PR | Pull request opened | Figma frame URL attached to PR description automatically |
| Accessibility audit trigger | `FILE_UPDATE` webhook | Automated accessibility checker run on changed frames |
| Dev Mode status tracking | `DEV_MODE_STATUS_UPDATE` webhook | Engineering ticket updated when frame marked "Ready for Dev" |
| Stale component detection | Weekly cron | Report of components not updated in 90+ days |
| Design system analytics | Monthly | Usage report of which components appear in which files |

---

## Key concepts & data model

### Document hierarchy

```
File (file_key)
└── Document (node type: DOCUMENT)
    └── Canvas / Page (node type: CANVAS) — one per page tab
        └── Frame (node type: FRAME) — top-level frames (artboards)
            └── Group / Component / Instance / Text / Vector / etc.
```

**Key IDs:**
- **`file_key`** — alphanumeric string in the Figma file URL: `figma.com/file/<file_key>/`
- **`node_id`** — identifies any node within a file; format `<page>:<node>` e.g. `1:23`. URL-encoded as `1%3A23`
- **`component_key`** — globally unique key for a published component (different from node_id)
- **`style_key`** — globally unique key for a published style

### Node types (common)
| Type | Description |
|------|-------------|
| `DOCUMENT` | Root node of a file |
| `CANVAS` | A page in the file |
| `FRAME` | Artboard / container |
| `GROUP` | Logical group |
| `COMPONENT` | Reusable component definition |
| `COMPONENT_SET` | Container for component variants |
| `INSTANCE` | Instance of a COMPONENT |
| `TEXT` | Text layer |
| `VECTOR` | Vector shape |
| `RECTANGLE`, `ELLIPSE`, `LINE`, `POLYGON`, `STAR` | Primitive shapes |
| `BOOLEAN_OPERATION` | Union/subtract/intersect/exclude of shapes |
| `SECTION` | Section container (org/enterprise) |

### Components vs Instances
- **COMPONENT** — the source definition; has a `key` used for cross-file references
- **INSTANCE** — a linked copy; has `componentId` pointing back to the COMPONENT node, and `mainComponent` when resolved
- **COMPONENT_SET** — groups related variants; child components are the individual variants

### Styles
Published styles (colors, text, effects, grids) have a `key`, `name`, `description`, `style_type` (`FILL`, `TEXT`, `EFFECT`, `GRID`), and `remote` flag.

### Variables (Enterprise only)
Variables are scoped to a collection. Types: `BOOLEAN`, `COLOR`, `FLOAT`, `STRING`. Modes define different values per variable (e.g., Light/Dark). Accessed via `/v1/files/:key/variables/local` and `/v1/files/:key/variables/published`.

---

## Authentication & permissions

### Option 1 — Plan access token [recommended for org automation and CI/CD, GA 2026-07-23]

Organization- and Enterprise-plan only. Created and managed by plan admins, **not tied to a user account**, so the token keeps working when the person who created it leaves. Supports expiry up to one year and optional allowlists restricting where it can be used.

```bash
curl https://api.figma.com/v1/me \
  -H "X-Figma-Token: YOUR_PLAN_ACCESS_TOKEN"
```

Same `X-Figma-Token` header as a PAT — only the provenance and lifecycle differ. Prefer this over a PAT for anything running unattended: a PAT dies with its owner's account, which is the most common cause of silently broken Figma automations.

### Option 2 — Personal Access Token (PAT) [scripts and local tooling]

Generate at **Figma → Account Settings → Personal access tokens**.
Set an expiry (required since 2024) and select scopes at creation time.

```bash
curl https://api.figma.com/v1/me \
  -H "X-Figma-Token: YOUR_PAT"
```

> On Organization/Enterprise plans, use a plan access token for shared automation and keep PATs for individual development work.

### Option 3 — OAuth 2.0 [recommended for user-facing apps]

**Authorization URL:**
```
GET https://www.figma.com/oauth
  ?client_id=CLIENT_ID
  &redirect_uri=REDIRECT_URI
  &scope=file_content:read,file_comments:write
  &state=RANDOM_STATE
  &response_type=code
```

**Exchange code for token:**
```bash
curl -X POST https://api.figma.com/v1/oauth/token \
  -d "client_id=CLIENT_ID" \
  -d "client_secret=CLIENT_SECRET" \
  -d "redirect_uri=REDIRECT_URI" \
  -d "code=AUTH_CODE" \
  -d "grant_type=authorization_code"
```

Response:
```json
{
  "access_token": "...",
  "refresh_token": "...",
  "expires_in": 7776000,
  "token_type": "bearer"
}
```

**Refresh token** (access tokens expire after 90 days):
```bash
curl -X POST https://api.figma.com/v1/oauth/refresh \
  -d "client_id=CLIENT_ID" \
  -d "client_secret=CLIENT_SECRET" \
  -d "refresh_token=REFRESH_TOKEN"
```
> Note: `POST /v1/oauth/token` also accepts refresh (migrated May 2025); legacy `/v1/oauth/refresh` still supported.

**Use OAuth token:**
```bash
curl https://api.figma.com/v1/me \
  -H "Authorization: Bearer OAUTH_ACCESS_TOKEN"
```

### Scopes reference (least-privilege)

| Scope | Access Granted |
|-------|---------------|
| `current_user:read` | User profile (name, email, avatar) |
| `file_content:read` | Node contents, editor type |
| `file_metadata:read` | File metadata (name, thumbnail, last modified) |
| `file_versions:read` | Version history |
| `file_comments:read` | Read comments |
| `file_comments:write` | Post/delete comments and reactions |
| `file_variables:read` | Variables + collections (Enterprise only) |
| `file_variables:write` | Create/update variables (Enterprise only) |
| `file_dev_resources:read` | Dev resources (links, specs) |
| `file_dev_resources:write` | Create/update dev resources |
| `library_assets:read` | Published components and styles |
| `library_analytics:read` | Design system analytics (Enterprise only) |
| `projects:read` | List projects and files in a team |
| `webhooks:read` | View webhook metadata |
| `webhooks:write` | Create/update/delete webhooks |
| `org:activity_log_read` | Activity logs (Enterprise admin only) |

> `files:read` is **deprecated** — use granular scopes above.

**Minimum scopes for common tasks:**
- Read file structure: `file_content:read`
- Post a comment: `file_comments:write` (implies read)
- Register webhooks: `webhooks:write`
- Export components: `file_content:read`, `library_assets:read`

---

## Common workflows (recipes)

### Recipe 1 — Read a file's full node tree

```bash
curl "https://api.figma.com/v1/files/FILE_KEY" \
  -H "X-Figma-Token: YOUR_PAT"
```

Response (abbreviated):
```json
{
  "name": "My Design File",
  "lastModified": "2026-01-15T10:30:00Z",
  "thumbnailUrl": "https://...",
  "version": "1234567890",
  "document": {
    "id": "0:0",
    "name": "Document",
    "type": "DOCUMENT",
    "children": [
      {
        "id": "0:1",
        "name": "Page 1",
        "type": "CANVAS",
        "children": [ ... ]
      }
    ]
  },
  "components": { "component_key": { "name": "...", "description": "..." } },
  "styles": { "style_key": { "name": "...", "style_type": "FILL" } }
}
```

**Fetch specific nodes only** (avoid downloading the full file for large docs):
```bash
curl "https://api.figma.com/v1/files/FILE_KEY/nodes?ids=1:23,1:45" \
  -H "X-Figma-Token: YOUR_PAT"
```

```python
import requests

def get_figma_nodes(file_key: str, node_ids: list[str], token: str) -> dict:
    ids = ",".join(node_ids)
    r = requests.get(
        f"https://api.figma.com/v1/files/{file_key}/nodes",
        params={"ids": ids},
        headers={"X-Figma-Token": token},
    )
    r.raise_for_status()
    return r.json()["nodes"]
```

---

### Recipe 2 — Export nodes as images (PNG/SVG/PDF)

Renders specified node IDs at a given scale and format. Returns pre-signed S3 URLs (valid ~30 minutes).

```bash
curl "https://api.figma.com/v1/images/FILE_KEY?ids=1:23&scale=2&format=png" \
  -H "X-Figma-Token: YOUR_PAT"
```

Response:
```json
{
  "err": null,
  "images": {
    "1:23": "https://figma-alpha-api.s3.us-west-2.amazonaws.com/..."
  }
}
```

```python
import requests

def export_nodes(
    file_key: str,
    node_ids: list[str],
    token: str,
    format: str = "png",   # png | svg | pdf | jpg
    scale: float = 2.0,
) -> dict[str, str]:
    """Returns {node_id: presigned_url}."""
    r = requests.get(
        f"https://api.figma.com/v1/images/{file_key}",
        params={"ids": ",".join(node_ids), "scale": scale, "format": format},
        headers={"X-Figma-Token": token},
    )
    r.raise_for_status()
    data = r.json()
    if data.get("err"):
        raise RuntimeError(f"Figma image error: {data['err']}")
    return data["images"]

def download_image(url: str, dest_path: str) -> None:
    r = requests.get(url)
    r.raise_for_status()
    with open(dest_path, "wb") as f:
        f.write(r.content)
```

> **SVG export tip:** Use `svg_include_id=true` to embed node IDs as `id` attributes for post-processing.

---

### Recipe 3 — List and read comments

```bash
# Get all comments on a file
curl "https://api.figma.com/v1/files/FILE_KEY/comments" \
  -H "X-Figma-Token: YOUR_PAT"
```

Response:
```json
{
  "comments": [
    {
      "id": "123",
      "uuid": "abc-def",
      "file_key": "FILE_KEY",
      "parent_id": "",
      "user": { "id": "...", "handle": "Alice", "img_url": "..." },
      "created_at": "2026-01-10T09:00:00Z",
      "resolved_at": null,
      "message": "This button padding looks off @Bob",
      "client_meta": { "node_id": "1:23", "node_offset": { "x": 0, "y": 0 } }
    }
  ]
}
```

**Post a comment:**
```python
import requests

def post_comment(
    file_key: str,
    message: str,
    token: str,
    node_id: str | None = None,  # anchor comment to a specific node
) -> dict:
    payload = {"message": message}
    if node_id:
        payload["client_meta"] = {"node_id": node_id}

    r = requests.post(
        f"https://api.figma.com/v1/files/{file_key}/comments",
        json=payload,
        headers={"X-Figma-Token": token, "Content-Type": "application/json"},
    )
    r.raise_for_status()
    return r.json()
```

---

### Recipe 4 — List published components in a team

```bash
curl "https://api.figma.com/v1/teams/TEAM_ID/components" \
  -H "X-Figma-Token: YOUR_PAT"
```

Response:
```json
{
  "status": 200,
  "error": false,
  "meta": {
    "components": [
      {
        "key": "abc123",
        "file_key": "FILE_KEY",
        "node_id": "1:45",
        "thumbnail_url": "https://...",
        "name": "Button/Primary",
        "description": "Primary CTA button",
        "created_at": "2025-06-01T00:00:00Z",
        "updated_at": "2026-01-10T00:00:00Z",
        "containing_frame": { "name": "Buttons", "node_id": "1:10" }
      }
    ],
    "cursor": "eyJsaW1pdCI6MzAsIm9mZnNldCI6MzB9"
  }
}
```

Paginate using the `cursor` value:
```python
import requests

def get_all_components(team_id: str, token: str) -> list[dict]:
    components = []
    params = {"page_size": 30}
    while True:
        r = requests.get(
            f"https://api.figma.com/v1/teams/{team_id}/components",
            params=params,
            headers={"X-Figma-Token": token},
        )
        r.raise_for_status()
        data = r.json()["meta"]
        components.extend(data["components"])
        cursor = data.get("cursor")
        if not cursor:
            break
        params["cursor"] = cursor
    return components
```

---

### Recipe 5 — Extract design tokens (styles + variables)

**Published styles:**
```bash
curl "https://api.figma.com/v1/teams/TEAM_ID/styles" \
  -H "X-Figma-Token: YOUR_PAT"
```

**Local variables (Enterprise):**
```bash
curl "https://api.figma.com/v1/files/FILE_KEY/variables/local" \
  -H "X-Figma-Token: YOUR_PAT"
```

```python
import requests, json

def extract_tokens(file_key: str, token: str) -> dict:
    """
    Extract color and text styles as a Style Dictionary-compatible token map.
    Requires file_content:read and library_assets:read scopes.
    """
    r = requests.get(
        f"https://api.figma.com/v1/files/{file_key}",
        params={"depth": 1},          # depth=1 → only top-level nodes + styles map
        headers={"X-Figma-Token": token},
    )
    r.raise_for_status()
    file_data = r.json()

    tokens = {}
    for style_key, style in file_data.get("styles", {}).items():
        if style["style_type"] == "FILL":
            tokens[style["name"]] = {"$type": "color", "$value": style_key}
        elif style["style_type"] == "TEXT":
            tokens[style["name"]] = {"$type": "typography", "$value": style_key}
    return tokens
```

---

### Recipe 6 — List projects and files in a team

```bash
# Team projects
curl "https://api.figma.com/v1/teams/TEAM_ID/projects" \
  -H "X-Figma-Token: YOUR_PAT"

# Files in a project
curl "https://api.figma.com/v1/projects/PROJECT_ID/files" \
  -H "X-Figma-Token: YOUR_PAT"
```

Projects response:
```json
{
  "name": "Engineering",
  "projects": [
    { "id": "12345", "name": "Design System" },
    { "id": "67890", "name": "Product App" }
  ]
}
```

Files response:
```json
{
  "files": [
    {
      "key": "FILE_KEY",
      "name": "Component Library",
      "thumbnail_url": "https://...",
      "last_modified": "2026-01-20T12:00:00Z"
    }
  ]
}
```

---

### Recipe 7 — Register a webhook

As of May 2025, webhooks attach to a **team**, **file**, or **project** (not just team).

```python
import requests

def register_webhook(
    token: str,
    event_type: str,           # e.g. "FILE_VERSION_UPDATE"
    endpoint: str,             # Your HTTPS receiver URL
    passcode: str,             # Secret for HMAC verification
    context: str = "FILE",     # "TEAM" | "FILE" | "PROJECT"
    context_id: str = "",      # team_id, file_key, or project_id
) -> dict:
    payload = {
        "event_type": event_type,
        "endpoint": endpoint,
        "passcode": passcode,
        "status": "ACTIVE",
        "description": f"Auto-registered {event_type}",
    }

    if context == "TEAM":
        payload["team_id"] = context_id
    elif context == "FILE":
        payload["file_key"] = context_id
    elif context == "PROJECT":
        payload["project_id"] = context_id

    r = requests.post(
        "https://api.figma.com/v2/webhooks",
        json=payload,
        headers={"X-Figma-Token": token, "Content-Type": "application/json"},
    )
    r.raise_for_status()
    return r.json()
```

**Validate incoming webhook signature:**
```python
import hashlib, hmac
from flask import Flask, request, abort

app = Flask(__name__)
WEBHOOK_PASSCODE = "your-passcode-here"

@app.route("/figma-webhook", methods=["POST"])
def figma_webhook():
    # Figma sends the passcode in the JSON body, not a header
    payload = request.get_json(force=True)

    received_passcode = payload.get("passcode", "")
    if not hmac.compare_digest(received_passcode, WEBHOOK_PASSCODE):
        abort(403, "Invalid passcode")

    event_type = payload.get("event_type")

    if event_type == "FILE_VERSION_UPDATE":
        file_key = payload["file_key"]
        label = payload.get("label", "")
        # trigger downstream pipeline...

    elif event_type == "FILE_COMMENT":
        comment = payload.get("comment", [])
        # notify team...

    return {"ok": True}, 200
```

> **Figma webhook security note:** Figma passes the `passcode` inside the JSON body (not an HTTP header). Compare it with `hmac.compare_digest` to prevent timing attacks. All webhook delivery uses HTTPS.

**Webhook event types:**
| Event | Trigger |
|-------|---------|
| `PING` | Sent on webhook creation to verify endpoint |
| `FILE_UPDATE` | File content was updated (autosave) |
| `FILE_VERSION_UPDATE` | Named version saved |
| `FILE_DELETE` | File deleted |
| `LIBRARY_PUBLISH` | Component/style library published |
| `FILE_COMMENT` | Comment posted or resolved on a file |
| `DEV_MODE_STATUS_UPDATE` | Layer Dev Mode status changed (e.g., "Ready for Dev") |

**Retry schedule:** Failed deliveries retried 3 times — 5 min, 30 min, 3 hours after each failure.

**Webhook limits:**
- Per team: 20 webhooks
- Per project: 5 webhooks
- Per file: 3 (Professional), up to 150/300/600 (Pro/Org/Enterprise)

---

### Recipe 8 — Get file version history

```bash
curl "https://api.figma.com/v1/files/FILE_KEY/versions" \
  -H "X-Figma-Token: YOUR_PAT"
```

```json
{
  "versions": [
    {
      "id": "1234567890",
      "created_at": "2026-01-15T10:30:00Z",
      "label": "v2.1 — Button updates",
      "description": "Updated padding and color tokens",
      "user": { "id": "...", "handle": "Alice" }
    }
  ],
  "pagination": { "cursor": "eyJsaW1pdCI6MzB9" }
}
```

To fetch the file at a specific version:
```bash
curl "https://api.figma.com/v1/files/FILE_KEY?version=VERSION_ID" \
  -H "X-Figma-Token: YOUR_PAT"
```

---

### Recipe 9 — Create dev resources (design-to-dev links)

Dev resources attach external links (e.g., Storybook, GitHub) to nodes for handoff.

```python
import requests

def create_dev_resource(
    file_key: str,
    node_id: str,
    name: str,
    url: str,
    token: str,
) -> dict:
    r = requests.post(
        f"https://api.figma.com/v1/files/{file_key}/dev_resources",
        json={
            "dev_resources": [
                {"node_id": node_id, "name": name, "url": url}
            ]
        },
        headers={"X-Figma-Token": token, "Content-Type": "application/json"},
    )
    r.raise_for_status()
    return r.json()

# Example: link a Storybook story to a Button component node
create_dev_resource(
    file_key="AbCdEfGhIj",
    node_id="1:23",
    name="Storybook: Button",
    url="https://storybook.example.com/?path=/docs/button--default",
    token=PAT,
)
```

---

### Recipe 10 — Full asset pipeline (webhook → export → upload)

```python
import requests, boto3, hmac
from flask import Flask, request, abort

app = Flask(__name__)
PASSCODE = "your-passcode"
FIGMA_TOKEN = "your-figma-pat"
S3_BUCKET = "my-design-assets"

@app.route("/webhook", methods=["POST"])
def handle_webhook():
    payload = request.get_json(force=True)
    if not hmac.compare_digest(payload.get("passcode", ""), PASSCODE):
        abort(403)

    if payload.get("event_type") != "FILE_VERSION_UPDATE":
        return {"ok": True}, 200

    file_key = payload["file_key"]
    version_id = payload.get("version_id")

    # 1. Fetch top-level frames from page 1
    nodes_r = requests.get(
        f"https://api.figma.com/v1/files/{file_key}",
        params={"depth": 2},
        headers={"X-Figma-Token": FIGMA_TOKEN},
    )
    pages = nodes_r.json()["document"]["children"]
    page1_frames = [n for n in pages[0]["children"] if n["type"] == "FRAME"]
    node_ids = [f["id"] for f in page1_frames]

    # 2. Get image export URLs
    img_r = requests.get(
        f"https://api.figma.com/v1/images/{file_key}",
        params={"ids": ",".join(node_ids), "scale": 2, "format": "png"},
        headers={"X-Figma-Token": FIGMA_TOKEN},
    )
    images = img_r.json()["images"]

    # 3. Download and upload to S3
    s3 = boto3.client("s3")
    for node_id, url in images.items():
        if not url:
            continue
        img_data = requests.get(url).content
        key = f"figma/{file_key}/{version_id}/{node_id.replace(':', '_')}.png"
        s3.put_object(Bucket=S3_BUCKET, Key=key, Body=img_data, ContentType="image/png")

    return {"ok": True}, 200
```

---

## Query patterns & filtering

### Pagination

Most list endpoints return a `cursor` in `meta.cursor`. Pass it as the `cursor` query parameter on subsequent requests. There is no `page` / `offset` parameter.

```python
def paginate(url: str, token: str, page_size: int = 30) -> list[dict]:
    results = []
    params = {"page_size": page_size}
    while True:
        r = requests.get(url, params=params, headers={"X-Figma-Token": token})
        r.raise_for_status()
        meta = r.json().get("meta", {})
        key = next((k for k in meta if isinstance(meta[k], list)), None)
        if key:
            results.extend(meta[key])
        cursor = meta.get("cursor")
        if not cursor:
            break
        params["cursor"] = cursor
    return results
```

### Depth limiting (performance)

Use `?depth=N` on `/v1/files/:key` to limit traversal depth and reduce response size:
- `depth=1` — only the document root + page list (no children)
- `depth=2` — pages + top-level frames
- Omit for full tree (can be very large for complex files)

### Incremental sync

Files expose a `lastModified` timestamp and a `version` string. Cache these and compare on next poll:
```python
cached_version = load_cache(file_key)
r = requests.get(f"https://api.figma.com/v1/files/{file_key}",
                 params={"depth": 1}, headers={"X-Figma-Token": token})
current_version = r.json()["version"]
if current_version != cached_version:
    # file changed — fetch full data or react to webhook
    save_cache(file_key, current_version)
```

---

## Reliability: rate limits, retries, idempotency

### Tier definitions (as of Nov 17, 2025)

Figma uses a **leaky bucket** algorithm. Rate limits depend on **plan** and **seat type**:

| Plan | Tier 1 (file reads / images) | Tier 2 (components / styles) | Tier 3 (analytics) |
|------|-------------------------------|-------------------------------|---------------------|
| Starter | 10 req/min | 25 req/min | 50 req/min |
| Professional | 15 req/min | 50 req/min | 100 req/min |
| Organization | 20 req/min | 100 req/min | 150 req/min |
| Enterprise | Higher | Higher | Higher |

> View/Collab seat types get lower limits than Dev/Full seats. See `X-Figma-Rate-Limit-Type` header.

**Tier assignment by endpoint:**
- **Tier 1** — `GET /v1/files/:key`, `GET /v1/images/:key` (content-heavy)
- **Tier 2** — components, styles, versions, comments, projects
- **Tier 3** — library analytics, activity logs

### Response headers on 429

| Header | Meaning |
|--------|---------|
| `Retry-After` | Seconds to wait before retrying |
| `X-Figma-Rate-Limit-Type` | `"low"` (View/Collab seat) or `"high"` (Dev/Full seat) |
| `X-Figma-Plan-Tier` | Plan of the resource owner: `starter`, `pro`, `org`, `enterprise` |
| `X-Figma-Upgrade-Link` | URL to upgrade page if limit is plan-based |

### Retry with exponential backoff

```python
import requests, time, random

def figma_request(url: str, token: str, params: dict = None, max_retries: int = 5) -> dict:
    headers = {"X-Figma-Token": token}
    for attempt in range(max_retries):
        r = requests.get(url, params=params, headers=headers)
        if r.status_code == 429:
            retry_after = int(r.headers.get("Retry-After", 60))
            jitter = random.uniform(0, retry_after * 0.1)
            wait = retry_after + jitter
            print(f"Rate limited. Waiting {wait:.1f}s (attempt {attempt + 1}/{max_retries})")
            time.sleep(wait)
            continue
        r.raise_for_status()
        return r.json()
    raise RuntimeError(f"Exceeded {max_retries} retries for {url}")
```

### Idempotency

- **Comments:** Not idempotent by design — deduplicate by checking existing comments before posting.
- **Dev resources:** Check existing dev resources by `GET /v1/files/:key/dev_resources?node_ids=NODE_ID` before creating.
- **Webhooks:** Check existing webhooks before registering to avoid duplicates: `GET /v2/webhooks`.
- **Image exports:** Presigned URLs are short-lived (~30 min); do not cache URLs — cache the downloaded binary instead.

---

## Error handling & troubleshooting

| Code | When | Action |
|------|------|--------|
| `400 Bad Request` | Malformed request (bad node_id, invalid params) | Check node_id format (`page:node`, e.g. `1:23`); validate required fields |
| `401 Unauthorized` | Missing or invalid token | Check `X-Figma-Token` header is present; verify token not expired; ensure token has required scope |
| `403 Forbidden` | Valid token but no access | Check token scopes (use granular scopes, not deprecated `files:read`); user may not have access to the file/team |
| `404 Not Found` | File or node doesn't exist | Verify file_key from URL; verify node_id exists in the file; file may be deleted |
| `429 Too Many Requests` | Rate limit hit | Respect `Retry-After` header; consider upgrading plan/seat type; batch requests |
| `500 / 503` | Figma server error | Retry with exponential backoff; check [status.figma.com](https://status.figma.com) |

**Special error: Images API `err` field**

The images endpoint returns HTTP 200 but includes `"err"` in the body if rendering failed:
```json
{ "err": "Image error (render failed)", "images": { "1:23": null } }
```
Check `data["err"]` and `data["images"][node_id] is None` explicitly.

**Special error: File too large**

Large files may time out on `GET /v1/files/:key`. Mitigate:
- Use `?depth=1` or `?depth=2` for shallow fetches
- Use `/v1/files/:key/nodes?ids=NODE_ID` to fetch only needed subtrees

**Common mistake: Wrong node_id format**

Node IDs in API responses use `:` separator (e.g., `1:23`). In URLs, they must be URL-encoded: `1%3A23`. The Figma web app uses `-` instead of `:` in URLs — convert: `1-23` → `1:23`.

---

## Security & compliance

### Token hygiene
- Set token expiry — never create non-expiring PATs; rotate on a schedule.
- Use granular scopes — do not grant `file_variables:write` or `org:activity_log_read` unless explicitly needed.
- Store tokens in a secrets manager (AWS Secrets Manager, HashiCorp Vault); never hardcode or commit tokens.

### Webhook security
- Use a strong random `passcode` (32+ bytes, hex or base64 encoded).
- Always validate the `passcode` field from the webhook body using `hmac.compare_digest` (constant-time).
- Only accept requests over HTTPS. Reject non-HTTPS webhook endpoints at registration time.
- Log and alert on unexpected `event_type` values.

### Data privacy
- Figma files may contain PII in text layers (user-submitted content, emails, names).
- If storing exported file content or images, ensure it is covered by your data retention policy.
- Variables and styles may contain sensitive design system data — restrict `file_variables:read` accordingly.
- For Enterprise: use `org:activity_log_read` for audit trails; retain logs per your compliance requirements.

### OAuth app publication (mandatory Nov 2025)
All OAuth apps must complete Figma's publishing review flow. Apps not published will lose OAuth functionality.

---

## Testing checklist

- [ ] **Auth — PAT:** Send `GET /v1/me` with your token; confirm `200` and your user info returned
- [ ] **Auth — scopes:** Attempt an endpoint outside your granted scopes; confirm `403`
- [ ] **File read:** `GET /v1/files/FILE_KEY` returns `200` with `document` tree and `styles`/`components` maps
- [ ] **Nodes endpoint:** `GET /v1/files/FILE_KEY/nodes?ids=NODE_ID` returns only the requested node
- [ ] **Images export:** `GET /v1/images/FILE_KEY?ids=NODE_ID&format=png` returns a presigned URL; download the URL returns a valid PNG
- [ ] **Comments — read:** `GET /v1/files/FILE_KEY/comments` returns comment list
- [ ] **Comments — write:** `POST /v1/files/FILE_KEY/comments` with `{"message": "test"}` creates a comment; visible in Figma UI
- [ ] **Webhook — register:** `POST /v2/webhooks` with `event_type: PING` creates webhook and your endpoint receives a PING
- [ ] **Webhook — passcode:** Send a fake request to your webhook endpoint with a wrong passcode; confirm `403`
- [ ] **Rate limit:** Deliberately exceed the rate limit for your plan tier; confirm `429` with `Retry-After` header; confirm retry logic waits correctly
- [ ] **Pagination:** On a team with 30+ components, confirm cursor-based pagination fetches all items
- [ ] **Error — 404:** Request a non-existent file key; confirm `404` handled gracefully
- [ ] **Images — null check:** Request export of an invalid/empty node; confirm `err` field and `null` URL handled
- [ ] **Node ID format:** Confirm node IDs from web URL (hyphen-separated) are converted to colon-separated before API calls
- [ ] **Version history:** `GET /v1/files/FILE_KEY/versions` returns version list with labels

---

## Sources

- [Figma REST API Introduction](https://developers.figma.com/docs/rest-api/)
- [Authentication](https://developers.figma.com/docs/rest-api/authentication/)
- [Scopes](https://developers.figma.com/docs/rest-api/scopes/)
- [Rate Limits](https://developers.figma.com/docs/rest-api/rate-limits/)
- [Webhooks V2](https://developers.figma.com/docs/rest-api/webhooks/)
- [Webhook Event Types](https://developers.figma.com/docs/rest-api/webhooks-types/)
- [Webhook Endpoints](https://developers.figma.com/docs/rest-api/webhooks-endpoints/)
- [REST API Changelog](https://developers.figma.com/docs/rest-api/changelog/)
- [Figma REST API OpenAPI Spec (GitHub)](https://github.com/figma/rest-api-spec)
- [Manage Personal Access Tokens](https://help.figma.com/hc/en-us/articles/8085703771159-Manage-personal-access-tokens)
- [Figma Status Page](https://status.figma.com)
