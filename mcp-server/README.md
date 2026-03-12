# clawskills-mcp

An MCP (Model Context Protocol) server that exposes [ClawSkills](https://github.com/Shanksg/clawskills) API integration skill docs to AI agents.

ClawSkills currently contains 14 structured Markdown skill docs plus workflow playbooks for cross-tool automations. Each skill tracks its own API version and `Last validated` date, while `clawskills-mcp` has its own npm version for the server itself.

---

## Install & run

### Via npx (recommended for Claude Desktop / Claude Code)

No install needed. Add this to your MCP client config:

```json
{
  "mcpServers": {
    "clawskills": {
      "command": "npx",
      "args": ["-y", "clawskills-mcp"]
    }
  }
}
```

**Claude Desktop config path:**
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

**Claude Code config:** Add to `.claude/settings.json` in your project, or `~/.claude/settings.json` globally.

### Via Docker

```bash
# From repo root
docker build -t clawskills-mcp -f mcp-server/Dockerfile .
docker run --rm -i clawskills-mcp
```

---

## Tools

| Tool | Description |
|------|-------------|
| `list_skills` | List all available skill slugs with descriptions |
| `get_skill` | Fetch a full skill doc or a specific section |
| `search_skills` | Full-text search across all skill docs |
| `list_playbooks` | List all available cross-tool workflow playbooks |
| `get_playbook` | Fetch a full playbook by slug |
| `search_playbooks` | Full-text search across all workflow playbooks |
| `search_clawskills` | Unified search across both skills and playbooks |

For most user queries, start with `search_clawskills`. It biases toward playbooks for workflow-shaped searches like `closed won onboarding`, `zendesk jira escalation`, or `lead sync`.

### `list_skills`

No arguments. Returns all available skills.

### `get_skill`

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | string | yes | Skill slug: `salesforce`, `github`, `hubspot`, etc. Fuzzy matched. |
| `section` | string | no | Section alias: `auth`, `rate-limits`, `errors`, `pagination`, `recipes`, `gotchas`, `webhooks`, `overview`, `fields` |

Examples:
- Get the full Salesforce skill: `{ "name": "salesforce" }`
- Get only the auth section: `{ "name": "github", "section": "auth" }`
- Get rate limit info: `{ "name": "hubspot", "section": "rate-limits" }`

### `search_skills`

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `query` | string | yes | Search string, e.g. `"429 retry"`, `"OAuth"`, `"cursor pagination"` |

Returns matching excerpts (±3 lines of context) grouped by skill, capped at 5 matches per skill.

### `list_playbooks`

No arguments. Returns all available playbooks.

### `get_playbook`

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | string | yes | Playbook slug: `zendesk-jira-bug-escalation`, `hubspot-asana-onboarding`, etc. Fuzzy matched. |

### `search_playbooks`

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `query` | string | yes | Search string, e.g. `"idempotency"`, `"rollback"`, `"closed won"` |

Returns matching excerpts (±3 lines of context) grouped by playbook, capped at 5 matches per playbook.

### `search_clawskills`

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `query` | string | yes | Search string, e.g. `"closed won onboarding"`, `"zendesk jira escalation"`, `"lead sync"` |

Returns combined results across skills and playbooks. Workflow-oriented queries rank playbooks ahead of generic skill matches.

---

## Configuration

Skills and playbooks are bundled inside the npm package — no extra configuration is needed for the standard `npx` setup.

`SKILLS_DIR` and `PLAYBOOKS_DIR` are available if you want to point the server at custom or local content directories:

| Env var | Default | Description |
|---------|---------|-------------|
| `SKILLS_DIR` | bundled `skills/` inside the package | Absolute path to a directory of `{slug}/skill.md` files |
| `PLAYBOOKS_DIR` | bundled `playbooks/` inside the package | Absolute path to a directory of `{slug}.md` playbook files |

```json
{
  "mcpServers": {
    "clawskills": {
      "command": "npx",
      "args": ["-y", "clawskills-mcp"],
      "env": {
        "SKILLS_DIR": "/path/to/your/skills",
        "PLAYBOOKS_DIR": "/path/to/your/playbooks"
      }
    }
  }
}
```

---

## Available skills

- `asana` — Asana REST API
- `dynamics365` — Microsoft Dynamics 365
- `figma` — Figma REST API
- `github` — GitHub REST API + GraphQL
- `hubspot` — HubSpot CRM API
- `jira` — Jira Cloud REST API
- `linear` — Linear GraphQL API
- `monday` — Monday.com GraphQL API
- `notion` — Notion REST API (Pages, Databases, Blocks)
- `salesforce` — Salesforce REST API
- `servicenow` — ServiceNow Table API
- `slack` — Slack Web API + Events API
- `stripe` — Stripe Payments API (Billing, Connect)
- `zendesk` — Zendesk Support API

---

## Development

```bash
cd mcp-server
npm install
npm run build
npm start
```

Test with the MCP inspector:

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```
