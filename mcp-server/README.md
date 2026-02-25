# clawskills-mcp

An MCP (Model Context Protocol) server that exposes [ClawSkills](https://github.com/Shanksg/clawskills) API integration skill docs to AI agents.

ClawSkills contains structured Markdown guides for 10+ SaaS APIs (Salesforce, HubSpot, GitHub, Jira, etc.) covering auth, rate limits, pagination, error handling, and recipes — everything an agent needs to make reliable API calls.

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

---

## Configuration

Skills are bundled inside the npm package — no `SKILLS_DIR` configuration needed for the standard `npx` setup.

`SKILLS_DIR` is available if you want to point the server at a custom or local skills directory (e.g. your own forks of the docs):

| Env var | Default | Description |
|---------|---------|-------------|
| `SKILLS_DIR` | bundled `skills/` inside the package | Absolute path to a directory of `{slug}/skill.md` files |

```json
{
  "mcpServers": {
    "clawskills": {
      "command": "npx",
      "args": ["-y", "clawskills-mcp"],
      "env": {
        "SKILLS_DIR": "/path/to/your/skills"
      }
    }
  }
}
```

---

## Available skills

- `asana` — Asana API
- `dynamics365` — Microsoft Dynamics 365
- `figma` — Figma API
- `github` — GitHub REST API
- `hubspot` — HubSpot CRM API
- `jira` — Jira Cloud REST API
- `monday` — Monday.com API
- `salesforce` — Salesforce REST API
- `servicenow` — ServiceNow REST API
- `zendesk` — Zendesk REST API

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
