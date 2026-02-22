# GitHub Skill

> **Last validated:** 2026-02-22 | **API:** GitHub REST API + GraphQL API v4
> **REST base URL:** `https://api.github.com`
> **API version header:** `X-GitHub-Api-Version: 2022-11-28` (current stable)
> **Assumed product:** GitHub.com (cloud). GitHub Enterprise Server differs in base URL and some rate limits.

---

## What this skill enables

- Automate repository operations: create repos, manage branches, merge PRs, and tag releases from any external trigger.
- Read and write code: fetch file contents, commit changes, and open pull requests entirely through the API.
- Manage the software delivery lifecycle: open, label, assign, and close Issues and PRs; enforce branch protection; trigger and monitor GitHub Actions workflows.
- Integrate with CI/CD: post commit statuses, check runs, and deployment events so external systems surface build results in GitHub UI.
- Sync development activity to other tools: mirror Issues to Jira/ServiceNow, post PR summaries to Slack, or create Zendesk tickets from Issue comments.
- Audit and report: query commit history, PR cycle times, contributor activity, and release cadence for engineering metrics.
- Webhook-driven automation: react to any GitHub event (push, PR opened, review submitted, workflow completed) in real time without polling.

---

## Best-fit use cases

| Use case | Why it matters | Primary objects/entities | Typical trigger | Success criteria |
|----------|---------------|--------------------------|-----------------|------------------|
| Create PR from feature branch | Automate PR creation after CI passes or branch is pushed | Repository, Branch, Pull Request | Push to feature branch | PR opened; reviewers assigned; labels set |
| Sync GitHub Issue → Jira ticket | Keep engineering and project tracking in sync | Issue, Label, Milestone | Issue opened or labeled | Jira ticket created with GitHub Issue URL in description |
| Post commit status / check run | Surface external CI results in GitHub UI | Commit, Status, Check Run | CI build completes | Green/red status visible on PR; merge blocked if failing |
| Merge PR after approvals | Auto-merge when review count and CI pass | Pull Request, Review | PR approved + checks pass | PR merged; branch deleted; release notes updated |
| Create and publish a release | Tag a release and attach build artifacts | Tag, Release, Release Asset | Version bump commit merged | Release published; changelog drafted from PR titles |
| Trigger a GitHub Actions workflow | Run deployment or automation from external system | Workflow, Workflow Run | External event (e.g., CRM deal closed) | Workflow triggered; run ID returned for polling |
| Enforce branch protection rules | Prevent direct pushes to main; require reviews | Branch Protection Rule | Repository setup / policy change | Direct push rejected; PR required for merge |
| Mirror PR activity to Slack/Teams | Keep non-engineers informed without GitHub access | Pull Request, Review, Comment | PR webhook event | Message posted with PR link, author, and status |
| Bulk label Issues | Triage backlog with consistent labeling | Issue, Label | Scheduled triage job | All matching issues labeled correctly |
| Fetch file content for AI processing | Read source files, configs, or docs without cloning | Repository Content | On-demand or scheduled | File content returned as decoded string |
| Track commit activity for metrics | Calculate cycle time, deploy frequency, lead time | Commit, Branch, Release | Daily scheduled job | Commit timestamps and PR merge times aggregated |
| Rotate secrets / update env vars | Keep CI secrets current across repositories | Repository Secret, Environment | Secret rotation policy trigger | Secret updated; encrypted with repo public key |

---

## Key concepts & data model

### Core objects

| Object | Description | Identified by |
|--------|-------------|---------------|
| **Repository** | Container for code, issues, PRs, actions | `{owner}/{repo}` string (e.g., `acme/api-service`) |
| **Branch** | Named pointer to a commit | String name (e.g., `main`, `feature/auth`) |
| **Commit** | Snapshot of the repository at a point in time | 40-char SHA (e.g., `a1b2c3d4...`); abbreviated: 7 chars |
| **Pull Request** | Proposed merge from one branch into another | Integer `number` (e.g., `42`); also has a node ID for GraphQL |
| **Issue** | Task, bug, or discussion thread | Integer `number` within the repo |
| **Label** | Tag on an Issue or PR | String `name` (e.g., `bug`, `priority:high`) |
| **Milestone** | Sprint or release grouping for Issues/PRs | Integer `number` |
| **Release** | Tagged version with changelog and optional assets | Integer `id`; string `tag_name` (e.g., `v1.2.3`) |
| **Tag** | Lightweight or annotated pointer to a commit | String name; backed by a Git ref |
| **Workflow** | GitHub Actions YAML file defining automation | Integer `id`; string `name` or filename |
| **Workflow Run** | An execution of a workflow | Integer `id` |
| **Check Run** | A CI/CD check result reported via API | Integer `id`; associated with a commit SHA |
| **Commit Status** | Simple pass/fail/pending status on a commit | `state` string (`success`, `failure`, `pending`, `error`) |
| **Repository Secret** | Encrypted secret for Actions or Dependabot | String `name`; value write-only |
| **Deployment** | A record of a deploy event for a ref | Integer `id`; string `environment` |

### Identifying records

- Repositories: always use `{owner}/{repo}` — never assume `repo` alone is unique.
- Issues and PRs share the same number namespace in a repo (an Issue `#42` and a PR `#42` cannot both exist in the same repo).
- Use `node_id` (GraphQL global ID) when working with the GraphQL API.
- Commits: use the full 40-char SHA in API calls; abbreviated SHAs can be ambiguous.

### Relationships

```
Organization / User (owner)
  └── Repository
        ├── Branch (refs/heads/*)
        │     └── Commit history
        ├── Pull Request
        │     ├── Review
        │     ├── Review Comment
        │     └── Check Runs / Statuses
        ├── Issue
        │     ├── Comment
        │     └── Label, Milestone, Assignee
        ├── Release
        │     └── Release Asset
        ├── Actions Workflow
        │     └── Workflow Run
        │           └── Job → Step
        ├── Repository Secret / Environment Secret
        └── Webhook
```

---

## Authentication & permissions

### Supported auth methods

| Method | Best for | Token format |
|--------|----------|-------------|
| **Fine-grained PAT** | Server-to-server automation (recommended) | `github_pat_...` — scoped to specific repos and permissions |
| **Classic PAT** | Broad access; legacy scripts | `ghp_...` — coarse scopes (repo, workflow, admin:org) |
| **GitHub App** | Multi-repo, multi-org, production integrations | Short-lived installation access tokens generated from a private key |
| **OAuth App** | User-delegated access (acting on behalf of a user) | Standard OAuth 2.0 bearer token |
| **`GITHUB_TOKEN`** | Inside GitHub Actions workflows only | Auto-generated per-run; limited to the repository |

### Fine-grained PAT (recommended for automation)

Fine-grained PATs are scoped to a single owner (user or org) and specific repositories, with per-permission grants instead of broad scopes.

1. Go to GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token.
2. Select **Repository access**: specific repos (preferred) or all repos.
3. Select **Permissions** (see table below).

```bash
curl -s https://api.github.com/repos/acme/api-service \
  -H "Authorization: Bearer github_pat_..." \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -H "Accept: application/vnd.github+json"
```

> **Note:** Fine-grained PATs do not support the GitHub Packages API or some older admin endpoints. Use a classic PAT or GitHub App for those.

### Required permissions (fine-grained — least privilege)

| Permission | Access | Use case |
|-----------|--------|----------|
| `Contents: Read` | Read files, commits, branches | Fetch file contents, read commit history |
| `Contents: Write` | Create/update files, branches, tags | Commit files, create branches |
| `Pull requests: Read` | List/read PRs and reviews | Monitoring, reporting |
| `Pull requests: Write` | Create, update, merge PRs | Automation |
| `Issues: Read` | List/read issues | Sync to external tools |
| `Issues: Write` | Create, update, label, close issues | Triage automation |
| `Actions: Read` | List workflows and runs | CI monitoring |
| `Actions: Write` | Trigger workflows, cancel runs | Deployment automation |
| `Commit statuses: Write` | Post commit status checks | CI integration |
| `Checks: Write` | Create/update check runs | Rich CI reporting |
| `Secrets: Write` | Create/update repository secrets | Secret rotation |
| `Metadata: Read` | Read basic repo info | Always included automatically |
| `Deployments: Write` | Create deployment events | Deployment tracking |
| `Webhooks: Write` | Create/manage webhooks | Automation setup |

### GitHub App (recommended for production multi-repo integrations)

GitHub Apps generate short-lived (1-hour) installation access tokens, making them more secure than long-lived PATs.

```bash
# Step 1 — Generate a JWT signed with your App's private key (RS256)
# Payload: {"iat": now-60, "exp": now+600, "iss": APP_ID}

# Step 2 — Get an installation access token
curl -s -X POST \
  "https://api.github.com/app/installations/{installation_id}/access_tokens" \
  -H "Authorization: Bearer {jwt}" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -H "Accept: application/vnd.github+json"
# Response: {"token": "ghs_...", "expires_at": "2026-02-22T15:00:00Z", ...}

# Step 3 — Use the installation token like a PAT
curl -s https://api.github.com/repos/acme/api-service \
  -H "Authorization: Bearer ghs_..."
```

### Required headers (always include)

```
Authorization: Bearer {token}
X-GitHub-Api-Version: 2022-11-28
Accept: application/vnd.github+json
User-Agent: your-app-name/1.0    ← required; 403 without it
```

### Token storage

- Store tokens in environment variables or a secrets manager — never in code.
- Fine-grained PATs expire (organization policy enforces max 366 days). Implement pre-expiry rotation alerts.
- GitHub App private keys should be stored in a secrets manager (AWS Secrets Manager, HashiCorp Vault). Rotate if exposed.
- `GITHUB_TOKEN` is scoped to the current workflow run and expires automatically — no rotation needed.

### Multi-tenant / multi-org

- Fine-grained PATs are scoped to a **single owner**. For multi-org automation, use a GitHub App (which can be installed in multiple orgs).
- GitHub App installation tokens are org/repo scoped — generate a separate token per installation.

---

## Common workflows (recipes)

### Recipe 1: Create a branch and open a Pull Request

**Goal:** Programmatically create a feature branch and open a PR against `main`.

```bash
BASE="https://api.github.com"
REPO="acme/api-service"
HEADERS='-H "Authorization: Bearer $GH_TOKEN" -H "X-GitHub-Api-Version: 2022-11-28" -H "Accept: application/vnd.github+json"'

# Step 1 — get the SHA of main
MAIN_SHA=$(curl -s "$BASE/repos/$REPO/git/ref/heads/main" \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -H "Accept: application/vnd.github+json" \
  | jq -r '.object.sha')

# Step 2 — create the branch
curl -s -X POST "$BASE/repos/$REPO/git/refs" \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -H "Accept: application/vnd.github+json" \
  -H "Content-Type: application/json" \
  -d "{\"ref\": \"refs/heads/feature/auto-update\", \"sha\": \"$MAIN_SHA\"}"

# Step 3 — open a PR
curl -s -X POST "$BASE/repos/$REPO/pulls" \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -H "Accept: application/vnd.github+json" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Auto: Update config for Q1 2026",
    "body": "Automated PR — updates generated by config sync job.\n\nCloses #142",
    "head": "feature/auto-update",
    "base": "main",
    "draft": false
  }'
# Response: {"number": 57, "html_url": "https://github.com/acme/api-service/pull/57", ...}
```

**Edge cases:**
- If the branch already exists, Step 2 returns 422 `Reference already exists`. Catch and skip.
- The `head` must have at least one commit different from `base` — you cannot open a PR on an empty branch. Create or update a file first (Recipe 5) before opening the PR.
- `"Closes #142"` in the body auto-links the PR to an Issue and closes it on merge.

---

### Recipe 2: Read/search Issues and PRs

**Goal:** Find all open Issues labeled `bug` updated in the last 7 days.

```bash
# REST search endpoint
curl -s -G "https://api.github.com/search/issues" \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -H "Accept: application/vnd.github+json" \
  --data-urlencode 'q=repo:acme/api-service is:issue is:open label:bug updated:>2026-02-15' \
  --data-urlencode 'sort=updated' \
  --data-urlencode 'order=desc' \
  --data-urlencode 'per_page=50'
```

**Response:**
```json
{
  "total_count": 23,
  "incomplete_results": false,
  "items": [{ "number": 142, "title": "NPE in auth handler", "updated_at": "2026-02-21T..." }]
}
```

**List Issues directly from a repo (simpler, no search quota):**
```bash
curl -s -G "https://api.github.com/repos/acme/api-service/issues" \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -H "Accept: application/vnd.github+json" \
  --data-urlencode 'state=open' \
  --data-urlencode 'labels=bug' \
  --data-urlencode 'since=2026-02-15T00:00:00Z' \
  --data-urlencode 'per_page=100'
```

**Pitfall:** `/repos/{owner}/{repo}/issues` returns both Issues **and** PRs (PRs are Issues in GitHub's model). Filter by checking `"pull_request"` key is absent to get Issues-only.

---

### Recipe 3: Update an Issue (label, assign, close)

**Goal:** Assign an Issue to a user, add a label, and close it.

```bash
ISSUE_NUMBER=142

curl -s -X PATCH "https://api.github.com/repos/acme/api-service/issues/$ISSUE_NUMBER" \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -H "Accept: application/vnd.github+json" \
  -H "Content-Type: application/json" \
  -d '{
    "state": "closed",
    "state_reason": "completed",
    "assignees": ["janesmith"],
    "labels": ["bug", "fixed-in-v2.3", "priority:high"]
  }'
# 200 with updated issue object
```

**`state_reason` values:** `completed`, `not_planned`, `reopened` (only valid when reopening).

**Add a label without replacing existing ones:**
```bash
curl -s -X POST "https://api.github.com/repos/acme/api-service/issues/$ISSUE_NUMBER/labels" \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -H "Accept: application/vnd.github+json" \
  -H "Content-Type: application/json" \
  -d '["needs-review", "P1"]'
```

---

### Recipe 4: Post a comment on an Issue or PR

**Goal:** Add a structured comment with context (e.g., automated triage note or deployment result).

```bash
curl -s -X POST "https://api.github.com/repos/acme/api-service/issues/142/comments" \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -H "Accept: application/vnd.github+json" \
  -H "Content-Type: application/json" \
  -d '{
    "body": "## Automated Triage\n\n**Linked Jira ticket:** [ENG-4521](https://acme.atlassian.net/browse/ENG-4521)\n\n**Severity:** P1 — production impact confirmed\n\n**Assigned to:** @janesmith for hotfix\n\n> This comment was posted automatically by the triage bot."
  }'
# Response: {"id": 1234567890, "html_url": "https://github.com/...", ...}
```

**Markdown is fully supported.** Use it for tables, code blocks, and links.

**Minimize bot noise:** Add a distinctive HTML comment to detect your bot's prior comments and edit instead of re-posting:
```
<!-- bot:triage-bot -->
Your content here
```
Then search existing comments: `GET /repos/{owner}/{repo}/issues/{number}/comments` and check if any contain `<!-- bot:triage-bot -->`. If found, use `PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}` to update.

---

### Recipe 5: Create or update a file (commit via API)

**Goal:** Write a file to a branch without a local Git clone.

```bash
import base64, requests

REPO = "acme/api-service"
PATH = "config/env.json"
BRANCH = "feature/auto-update"
TOKEN = "github_pat_..."

headers = {
    "Authorization": f"Bearer {TOKEN}",
    "X-GitHub-Api-Version": "2022-11-28",
    "Accept": "application/vnd.github+json"
}

# Step 1 — get current file SHA (required for updates; omit for new files)
resp = requests.get(
    f"https://api.github.com/repos/{REPO}/contents/{PATH}",
    headers=headers,
    params={"ref": BRANCH}
)
current_sha = resp.json().get("sha") if resp.status_code == 200 else None

# Step 2 — create or update
content = '{"env": "production", "version": "2.3.1"}'
encoded = base64.b64encode(content.encode()).decode()

body = {
    "message": "chore: update env config for v2.3.1",
    "content": encoded,
    "branch": BRANCH
}
if current_sha:
    body["sha"] = current_sha  # required for update; omit for create

resp = requests.put(
    f"https://api.github.com/repos/{REPO}/contents/{PATH}",
    headers=headers,
    json=body
)
# 201 Created (new file) or 200 OK (update)
print(resp.json()["commit"]["sha"])
```

**Pitfall:** Forgetting `sha` on an update returns `422 Unprocessable Entity: "sha" wasn't supplied`. Always GET the file first to retrieve the current SHA.

**File size limit:** 100 MB via API. Files over 1 MB in the response are truncated — use the Git Data API for large files.

---

### Recipe 6: Register a webhook for repository events

**Goal:** Receive push notifications for PR and push events without polling.

```bash
curl -s -X POST "https://api.github.com/repos/acme/api-service/hooks" \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -H "Accept: application/vnd.github+json" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "web",
    "active": true,
    "events": ["push", "pull_request", "issues", "check_run", "deployment_status"],
    "config": {
      "url": "https://your-server.example.com/github-webhook",
      "content_type": "json",
      "secret": "your_webhook_secret_here",
      "insecure_ssl": "0"
    }
  }'
# Response: {"id": 123456, "active": true, ...}
```

**Available events (selection):** `push`, `pull_request`, `pull_request_review`, `issues`, `issue_comment`, `check_run`, `check_suite`, `workflow_run`, `deployment`, `deployment_status`, `release`, `create` (branch/tag), `delete`.

**Webhook payload headers:**
```
X-GitHub-Event: pull_request
X-GitHub-Delivery: 72d3162c-cc78-11e3-81ab-4c9367dc0958
X-Hub-Signature-256: sha256=...
```

**Validating webhook signatures (Python):**
```python
import hmac, hashlib

def verify_github_webhook(payload_bytes: bytes, signature_header: str, secret: str) -> bool:
    expected = "sha256=" + hmac.new(
        secret.encode(), payload_bytes, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature_header)

# In your handler:
sig = request.headers.get("X-Hub-Signature-256", "")
if not verify_github_webhook(request.body, sig, WEBHOOK_SECRET):
    return 403  # reject
```

**Always use `hmac.compare_digest`** (not `==`) to prevent timing attacks.

---

### Recipe 7: Trigger a GitHub Actions workflow

**Goal:** Kick off a deployment workflow from an external system (e.g., after a CRM deal closes).

```bash
# workflow_dispatch — the workflow YAML must have `on: workflow_dispatch` defined
curl -s -X POST "https://api.github.com/repos/acme/api-service/actions/workflows/deploy.yml/dispatches" \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -H "Accept: application/vnd.github+json" \
  -H "Content-Type: application/json" \
  -d '{
    "ref": "main",
    "inputs": {
      "environment": "production",
      "version": "v2.3.1",
      "triggered_by": "crm-automation"
    }
  }'
# 204 No Content on success (no run ID returned directly)
```

**Getting the run ID after dispatch** (there's no run ID in the 204 response — poll instead):
```python
import time, requests

# Wait a few seconds for the run to appear
time.sleep(3)

runs = requests.get(
    "https://api.github.com/repos/acme/api-service/actions/workflows/deploy.yml/runs",
    headers=headers,
    params={"event": "workflow_dispatch", "per_page": 5}
).json()

latest_run = runs["workflow_runs"][0]
run_id = latest_run["id"]
run_status = latest_run["status"]   # queued, in_progress, completed
run_conclusion = latest_run.get("conclusion")  # success, failure, cancelled
```

**Poll run status until complete:**
```python
while True:
    run = requests.get(
        f"https://api.github.com/repos/{REPO}/actions/runs/{run_id}",
        headers=headers
    ).json()
    if run["status"] == "completed":
        print(f"Conclusion: {run['conclusion']}")
        break
    time.sleep(10)
```

---

### Recipe 8: Post a commit status or check run (CI integration)

**Goal:** Report a build result from an external CI system onto a specific commit.

**Commit Status (simple, 4 states):**
```bash
curl -s -X POST "https://api.github.com/repos/acme/api-service/statuses/$COMMIT_SHA" \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -H "Accept: application/vnd.github+json" \
  -H "Content-Type: application/json" \
  -d '{
    "state": "success",
    "target_url": "https://ci.example.com/builds/1234",
    "description": "All 847 tests passed in 2m 13s",
    "context": "ci/external-build"
  }'
```

**Check Run (richer — annotations, steps, custom UI):**
```bash
curl -s -X POST "https://api.github.com/repos/acme/api-service/check-runs" \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -H "Accept: application/vnd.github+json" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Security Scan",
    "head_sha": "'"$COMMIT_SHA"'",
    "status": "completed",
    "conclusion": "failure",
    "completed_at": "2026-02-22T10:30:00Z",
    "output": {
      "title": "2 vulnerabilities found",
      "summary": "CVE-2026-1234 in lodash@4.17.20\nCVE-2026-5678 in axios@0.21.1",
      "annotations": [
        {
          "path": "package.json",
          "start_line": 12,
          "end_line": 12,
          "annotation_level": "failure",
          "message": "lodash@4.17.20 has a known critical vulnerability (CVE-2026-1234)"
        }
      ]
    }
  }'
```

`conclusion` values: `success`, `failure`, `neutral`, `cancelled`, `skipped`, `timed_out`, `action_required`.

**Pitfall:** Check Runs require a **GitHub App token** (not a PAT) to render properly in the GitHub UI "Checks" tab. PATs can create check runs but they appear without the app icon and may have limited functionality.

---

### Recipe 9: Create a release with auto-generated notes

**Goal:** Tag a release and generate a changelog from PR titles since the last release.

```bash
curl -s -X POST "https://api.github.com/repos/acme/api-service/releases" \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -H "Accept: application/vnd.github+json" \
  -H "Content-Type: application/json" \
  -d '{
    "tag_name": "v2.3.1",
    "target_commitish": "main",
    "name": "v2.3.1 — Hotfix Release",
    "generate_release_notes": true,
    "draft": false,
    "prerelease": false
  }'
# Response: {"id": 987654, "html_url": "https://github.com/acme/api-service/releases/tag/v2.3.1", ...}
```

`generate_release_notes: true` automatically pulls PR titles and authors since the previous release — no manual changelog needed.

**Upload a release asset (e.g., compiled binary):**
```bash
RELEASE_ID=987654
UPLOAD_URL="https://uploads.github.com/repos/acme/api-service/releases/$RELEASE_ID/assets"

curl -s -X POST "$UPLOAD_URL?name=api-service-linux-amd64" \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -H "Accept: application/vnd.github+json" \
  -H "Content-Type: application/octet-stream" \
  --data-binary @dist/api-service-linux-amd64
```

---

### Recipe 10: Update a repository secret (secret rotation)

**Goal:** Rotate an API key stored as a GitHub Actions secret.

```bash
# Step 1 — get the repo's public key (used to encrypt the secret)
PUB_KEY_RESP=$(curl -s "https://api.github.com/repos/acme/api-service/actions/secrets/public-key" \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -H "Accept: application/vnd.github+json")

KEY_ID=$(echo $PUB_KEY_RESP | jq -r '.key_id')
PUB_KEY=$(echo $PUB_KEY_RESP | jq -r '.key')

# Step 2 — encrypt the secret value with libsodium (sealed box)
# Python: use PyNaCl
python3 -c "
from nacl import encoding, public
import base64
key = public.PublicKey(base64.b64decode('$PUB_KEY'))
box = public.SealedBox(key)
encrypted = box.encrypt(b'new_secret_value_here')
print(base64.b64encode(encrypted).decode())
" # → base64-encoded encrypted value

# Step 3 — upsert the secret
curl -s -X PUT "https://api.github.com/repos/acme/api-service/actions/secrets/THIRD_PARTY_API_KEY" \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -H "Accept: application/vnd.github+json" \
  -H "Content-Type: application/json" \
  -d "{
    \"encrypted_value\": \"$ENCRYPTED\",
    \"key_id\": \"$KEY_ID\"
  }"
# 201 Created or 204 No Content (if updating existing)
```

**Library:** Use `PyNaCl` (Python), `tweetnacl` (JS), or `libsodium` bindings for your language. GitHub requires `crypto_box_seal` (sealed box) encryption.

---

## Query patterns & filtering

### Search syntax (Issues, PRs, code, commits)

```
# Issues & PRs
repo:owner/name is:issue is:open label:bug
repo:owner/name is:pr is:merged merged:>2026-01-01
repo:owner/name is:pr review:approved assignee:username
repo:owner/name is:issue milestone:"Q1 2026"
org:acme is:issue is:open no:assignee

# Code search
repo:owner/name language:python "def authenticate"
repo:owner/name path:src/auth filename:*.py "jwt"

# Commit search (limited)
repo:owner/name author:username committer-date:>2026-01-01
```

Search API endpoint: `GET /search/issues`, `GET /search/code`, `GET /search/commits`

### Pagination

GitHub REST uses offset-based pagination via `page` + `per_page` query params, and signals next/prev pages via the `Link` response header:

```
Link: <https://api.github.com/repos/.../issues?page=2&per_page=100>; rel="next",
      <https://api.github.com/repos/.../issues?page=5&per_page=100>; rel="last"
```

```python
import requests, re

def paginate(url, headers, params=None):
    params = params or {}
    params["per_page"] = 100
    all_items = []

    while url:
        resp = requests.get(url, headers=headers, params=params)
        resp.raise_for_status()
        all_items.extend(resp.json())
        params = {}  # params are in the Link URL on subsequent pages

        link = resp.headers.get("Link", "")
        next_url = re.search(r'<([^>]+)>;\s*rel="next"', link)
        url = next_url.group(1) if next_url else None

    return all_items
```

Max `per_page`: **100** for most endpoints. The Search API: max **100**, capped at **1,000 total results** (`total_count` may be higher — use date range splitting to work around the 1,000-result cap).

### Incremental sync

Use `since` parameter (ISO 8601 timestamp) for Issues, comments, and commits:

```
GET /repos/{owner}/{repo}/issues?since=2026-02-20T00:00:00Z&state=all
GET /repos/{owner}/{repo}/issues/comments?since=2026-02-20T00:00:00Z
GET /repos/{owner}/{repo}/commits?since=2026-02-20T00:00:00Z&sha=main
```

Store the max `updated_at` from each sync run as the next `since` value.

### Handling duplicates

- GitHub Issues and PRs have stable integer `number`s within a repo — use `{owner}/{repo}#{number}` as your canonical external key.
- For commit statuses, the `context` string is the dedup key — posting to the same `context` overwrites the previous status.
- Webhooks can deliver the same event multiple times (retries). Use `X-GitHub-Delivery` as an idempotency key in your handler.

---

## Reliability: rate limits, retries, idempotency

### Primary rate limits (verified 2026-02-22)

| Auth type | Requests / hour |
|-----------|----------------|
| Unauthenticated | 60 |
| Fine-grained PAT / Classic PAT | **5,000** |
| GitHub App installation token | 5,000–12,500 (scales with repo/user count) |
| GitHub App on Enterprise Cloud org | **15,000** |
| `GITHUB_TOKEN` (Actions) | **1,000 / repo** (15,000 on Enterprise Cloud) |
| OAuth App | 5,000 (15,000 on Enterprise Cloud) |

Check remaining: `x-ratelimit-remaining` response header. When `0`, wait until `x-ratelimit-reset` (Unix timestamp).

### Secondary rate limits

These apply regardless of the primary limit:
- **100 concurrent requests** maximum
- **900 points per minute** (REST endpoints; each request = 1 point by default)
- **80 content-creating requests per minute** (creating issues, PRs, comments, etc.); **500 per hour**

Secondary limit responses return **403** or **429** with a `retry-after` header (seconds to wait).

### Retry strategy

```python
import time, requests

def github_request(method, url, **kwargs):
    headers = kwargs.pop("headers", {})
    headers.setdefault("X-GitHub-Api-Version", "2022-11-28")
    headers.setdefault("Accept", "application/vnd.github+json")

    for attempt in range(5):
        resp = requests.request(method, url, headers=headers, **kwargs)

        # Primary rate limit
        if resp.status_code in (403, 429) and resp.headers.get("x-ratelimit-remaining") == "0":
            reset_at = int(resp.headers.get("x-ratelimit-reset", time.time() + 60))
            time.sleep(max(reset_at - time.time(), 1))
            continue

        # Secondary rate limit (retry-after header)
        if resp.status_code in (403, 429) and "retry-after" in resp.headers:
            time.sleep(int(resp.headers["retry-after"]))
            continue

        # Transient server errors
        if resp.status_code in (500, 502, 503, 504):
            time.sleep(2 ** attempt)
            continue

        resp.raise_for_status()
        return resp

    raise Exception("Max retries exceeded")
```

### Idempotency patterns

- **Branch creation:** Check if ref exists first (`GET /repos/{owner}/{repo}/git/ref/heads/{branch}`); create only if 404.
- **File updates:** Always read the current `sha` before writing — the PUT endpoint is naturally idempotent when using the correct sha.
- **Commit statuses:** Posting to the same `context` is idempotent — only the latest status per context is shown.
- **Webhook events:** Store `X-GitHub-Delivery` in your database; skip processing if already seen.
- **Releases:** Check if a tag already exists before creating (`GET /repos/{owner}/{repo}/releases/tags/{tag}`).

---

## Error handling & troubleshooting

### Common errors

| HTTP Status | Message | Meaning | Fix |
|-------------|---------|---------|-----|
| 401 | `Bad credentials` | Token invalid, expired, or malformed | Re-generate token; check `Authorization: Bearer` format |
| 403 | `Resource not accessible by personal access token` | Fine-grained PAT missing a required permission | Add the required permission to the token |
| 403 | `Must have admin rights to Repository` | Operation requires repo admin | Use a token with `administration:write` or make the user an admin |
| 403 + `x-ratelimit-remaining: 0` | Rate limited (primary) | Request cap hit | Wait until `x-ratelimit-reset` |
| 404 | `Not Found` | Repo/resource doesn't exist or token can't see it | Verify `owner/repo`; check token has `Contents: Read` |
| 409 | `Conflict` | Branch/ref already exists | Check before creating; use PATCH to update |
| 422 | `Validation Failed` | Invalid field value (e.g., `sha` missing on file update) | Read the `errors[]` array in the response for field details |
| 451 | `Unavailable For Legal Reasons` | DMCA takedown | Cannot be resolved via API |

### "If you see X, do Y" playbook

- **Fine-grained PAT returns 403 on repos it should access:** Verify the token was created with "All repositories" or explicitly included the target repo. Fine-grained PATs can only access one owner's repos.
- **Webhook stops delivering:** Check the webhook's "Recent Deliveries" in the GitHub UI (Settings → Webhooks). GitHub disables webhooks with repeated failures. Re-enable and fix your endpoint URL.
- **`per_page=100` still returns 30:** The endpoint caps at 30 by default for some resources. Check the docs for that specific endpoint's max.
- **Search returns 0 results for a known issue:** The search index has a slight delay (~30s). Add a short delay after creating issues before searching for them.
- **Workflow dispatch returns 422:** The workflow file does not have `on: workflow_dispatch:` defined, or the `ref` doesn't exist.

### Debug logging

Log: HTTP method, URL (redacted of tokens), response status, `x-ratelimit-remaining`, `X-GitHub-Delivery` (for webhooks).
Do NOT log: `Authorization` header value, webhook `secret`, repository secret values.

---

## Security, privacy, compliance

- **Least privilege:** Always use fine-grained PATs or GitHub Apps with the minimum permissions. Avoid classic PATs with broad `repo` scope.
- **Secret scanning:** GitHub automatically scans pushes for known token patterns. If a PAT is committed, it is revoked within minutes. Treat any committed token as compromised immediately.
- **Audit log:** Organization audit logs record all OAuth app authorizations, PAT usage, and repo access events. Access via `GET /orgs/{org}/audit-log` (requires `audit_log:read` permission on a GitHub App or classic PAT with `admin:org` scope).
- **Branch protection:** Enforce required reviews, status checks, and signed commits via branch protection rules — do not bypass them in automation even if the token has permission.
- **Webhook secrets:** Always set and validate the `secret` field. Never expose your webhook secret in code.
- **GitHub App private keys:** Rotate private keys immediately if exposed. Generate a new key in the App settings and update your secrets manager before revoking the old key.
- **GDPR:** GitHub does not expose PII beyond what users have made public. User email addresses may be masked (noreply addresses) in commit data. Always use `author.login` (username) rather than `author.email` in integrations.
- **Data residency:** GitHub Enterprise Cloud offers data residency options. GitHub.com data is US-based by default.

---

## Testing checklist

- [ ] **Auth test:** `GET https://api.github.com/user` with your token — returns the authenticated user's login.
- [ ] **Permission test (fine-grained PAT):** Attempt an action (e.g., create issue) without the required permission — expect `403 Resource not accessible by personal access token`.
- [ ] **CRUD test:** Create an Issue → read it by number → update label → add comment → close it.
- [ ] **File write test:** Create a file in a test branch → read it back via API → update it (verify `sha` flow) → delete it.
- [ ] **Pagination test:** List issues with `per_page=10` on a repo with >10 issues; follow `Link: rel="next"` until exhausted; count matches `total_count` from search.
- [ ] **Rate limit test:** Check `x-ratelimit-remaining` before and after a batch of requests; verify counter decrements; verify retry logic fires on 403/429.
- [ ] **Webhook test:** Register a webhook on a test repo; create an issue; verify payload received within 5s at your endpoint; validate `X-Hub-Signature-256` HMAC; return 200; check delivery marked successful in GitHub UI.
- [ ] **Workflow dispatch test:** Trigger `workflow_dispatch` on a test workflow with `inputs`; poll run until `completed`; verify conclusion is `success`.
- [ ] **Negative tests:**
  - Invalid repo (`owner/nonexistent`) → 404
  - Wrong `sha` on file update → 409 or 422
  - Expired/revoked token → 401
  - Missing `User-Agent` header → 403
  - `per_page > 100` → capped at 100 (no error, just silently capped)

---

## Sources

- GitHub REST API overview: https://docs.github.com/en/rest
- API versioning (`X-GitHub-Api-Version`): https://docs.github.com/en/rest/about-the-rest-api/api-versions
- Rate limits (REST): https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
- Rate limits (GitHub Apps): https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/rate-limits-for-github-apps
- Authentication: https://docs.github.com/en/rest/authentication/authenticating-to-the-rest-api
- Fine-grained PATs: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens
- Fine-grained PAT permissions reference: https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens
- GitHub Apps: https://docs.github.com/en/apps/creating-github-apps/about-creating-github-apps/about-creating-github-apps
- Webhooks: https://docs.github.com/en/webhooks/about-webhooks
- Webhook events and payloads: https://docs.github.com/en/webhooks/webhook-events-and-payloads
- Pagination: https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api
- Search API: https://docs.github.com/en/rest/search/search
- Commit statuses: https://docs.github.com/en/rest/commits/statuses
- Check runs: https://docs.github.com/en/rest/checks/runs
- GitHub Actions API: https://docs.github.com/en/rest/actions
- Repository secrets: https://docs.github.com/en/rest/actions/secrets
- Releases: https://docs.github.com/en/rest/releases/releases
- GraphQL API: https://docs.github.com/en/graphql
- Audit log API: https://docs.github.com/en/rest/orgs/orgs#get-the-audit-log-for-an-organization
