# ClawSkills

A library of integration skill documents for the most common SaaS platforms used in go-to-market and operations workflows. Each skill doc teaches an **AI agent, automation builder, or LLM** how to reliably use a platform's API with working code examples, rate limit rules, error playbooks, and platform-specific version details.

---

## What's in here

```
playbooks/
├── INDEX.md                 ← Workflow-level guides spanning multiple tools
├── hubspot-asana-onboarding.md
├── salesforce-hubspot-lead-sync.md
└── zendesk-jira-bug-escalation.md

skills/
├── INDEX.md                 ← Start here: all tools, top workflows, quick-ref tables
├── ROADMAP.md               ← Phased build plan and governance model
├── monday/skill.md          ← Monday.com (GraphQL API v2026-01)
├── salesforce/skill.md      ← Salesforce Sales Cloud (REST API v66.0)
├── jira/skill.md            ← Jira Cloud (REST API v3)
├── dynamics365/skill.md     ← Microsoft Dynamics 365 (Dataverse Web API v9.2)
├── hubspot/skill.md         ← HubSpot CRM (API v3, 190 req/10s)
├── servicenow/skill.md      ← ServiceNow (Yokohama release, Table API)
├── zendesk/skill.md         ← Zendesk Support (API v2)
├── asana/skill.md           ← Asana (REST API 1.0)
├── github/skill.md          ← GitHub (REST API + GraphQL v4, 2022-11-28)
├── figma/skill.md           ← Figma (REST API v1, Webhooks V2)
├── slack/skill.md           ← Slack (Web API, Block Kit, Events API)
├── stripe/skill.md          ← Stripe (Payments API v2026-02-25, Billing, Connect)
├── notion/skill.md          ← Notion (REST API v2025-09-03, Pages, Databases, Blocks)
└── linear/skill.md          ← Linear (GraphQL API, Issues, Cycles, Webhooks)
```

Each `skill.md` follows the same structure:
- **What this skill enables** — outcome-focused bullets
- **Best-fit use cases** — table of 8–15 real workflows with triggers and success criteria
- **Key concepts & data model** — objects, fields, relationships, IDs
- **Authentication & permissions** — auth flows with working `curl` examples, least-privilege scopes
- **Common workflows (recipes)** — 6–12 step-by-step recipes with request/response examples
- **Query patterns & filtering** — pagination, incremental sync, dedup
- **Reliability: rate limits, retries, idempotency** — verified limits, backoff code in Python
- **Error handling & troubleshooting** — "if you see X, do Y" playbook
- **Security & compliance** — PII, audit trails, token guidance
- **Testing checklist** — QA checklist you can run against a sandbox
- **Sources** — official doc links

Each skill tracks its own platform version and `Last validated` date in the document header. The MCP package has a separate npm version because it versions the server/tooling layer, not the underlying SaaS APIs.

The `playbooks/` layer captures cross-tool workflows end to end: trigger, system sequence, field mapping, idempotency, failure policy, and operational guardrails.

---

## Use with Claude via MCP (recommended)

ClawSkills ships as an MCP server that exposes all skill docs as tools directly inside Claude.

```bash
npx -y clawskills-mcp
```

Or install permanently:

```bash
npm install -g clawskills-mcp
```

Add to your Claude Desktop / Claude Code config:

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

Once connected, Claude can call three tools:
- **`list_skills`** — see all available skill docs
- **`get_skill`** — fetch a full skill or a specific section (`auth`, `rate-limits`, `recipes`, `errors`, etc.)
- **`search_skills`** — full-text search across all skills

---

## How to use these skills with AI tools

### With Claude (claude.ai or Claude Code)

The most direct use: paste a skill doc (or a section of it) into your conversation as context, then ask Claude to write integration code, debug an error, or plan a workflow.

**Option 1 — Reference a specific section**

```
[paste the "Authentication & permissions" section from skills/salesforce/skill.md]

Using the above, write a Python function that exchanges a JWT for an access token
and caches it until 5 minutes before expiry.
```

**Option 2 — Full skill as system context**

If you're using the Claude API, load the skill doc as part of the system prompt:

```python
import anthropic

with open("skills/jira/skill.md") as f:
    jira_skill = f.read()

client = anthropic.Anthropic()
response = client.messages.create(
    model="claude-opus-4-6",
    max_tokens=4096,
    system=f"""You are an integration engineer. Use the following Jira skill doc as your
reference for all API calls, auth patterns, and error handling:

{jira_skill}

Always follow the rate limit and retry patterns from the skill doc.""",
    messages=[{
        "role": "user",
        "content": "Write a function that creates a Jira bug from a PagerDuty alert payload."
    }]
)
```

**Option 3 — Claude Code (this repo)**

If you're already in Claude Code with this repo open, just reference the file:

```
Using skills/hubspot/skill.md, write a Python script that syncs new Salesforce
leads (created in the last hour) to HubSpot contacts, deduplicating by email.
```

---

### With ChatGPT / GPT-4

Use the skill docs as file attachments or pasted context in the ChatGPT interface.

**In the ChatGPT web UI:**
1. Open a new conversation.
2. Click the paperclip (attach file) and upload the relevant `skill.md`.
3. Ask your question — ChatGPT will use the skill doc as reference.

**Via the OpenAI API:**

```python
from openai import OpenAI

with open("skills/zendesk/skill.md") as f:
    zendesk_skill = f.read()

client = OpenAI()
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {
            "role": "system",
            "content": f"You are an integration engineer. Reference this Zendesk skill doc for all API patterns:\n\n{zendesk_skill}"
        },
        {
            "role": "user",
            "content": "Write a webhook handler that creates a Zendesk ticket from an incoming JSON alert."
        }
    ]
)
```

---

### With Cursor / GitHub Copilot (editor context)

Both tools pick up files in your project as context.

**Cursor:**
- Add the relevant `skill.md` to your Cursor context via `@file` mention:
  ```
  @skills/monday/skill.md  Write a function that creates a Monday.com item
  from a webhook payload with these fields: name, status, due_date, assignee_email
  ```
- Or add `skills/` to your Cursor rules (`.cursorrules`) so the agent always has context available for integration-related tasks.

**GitHub Copilot Chat:**
```
#file:skills/servicenow/skill.md

Write a Python function that creates a ServiceNow incident from a CloudWatch alarm.
Include proper error handling and the work_notes vs comments distinction.
```

---

### With LangChain / LlamaIndex (RAG pipeline)

Use the skill docs as a knowledge base for a retrieval-augmented generation system. Each skill doc is self-contained and works well as a RAG document.

**LangChain example:**

```python
from langchain_community.document_loaders import DirectoryLoader, TextLoader
from langchain.text_splitter import MarkdownHeaderTextSplitter
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import Chroma
from langchain.chains import RetrievalQA
from langchain_openai import ChatOpenAI

# Load all skill docs
loader = DirectoryLoader("skills/", glob="**/*.md", loader_cls=TextLoader)
docs = loader.load()

# Split by Markdown headers to keep sections coherent
splitter = MarkdownHeaderTextSplitter(
    headers_to_split_on=[("##", "section"), ("###", "subsection")]
)
chunks = []
for doc in docs:
    chunks.extend(splitter.split_text(doc.page_content))

# Index into vector store
vectorstore = Chroma.from_documents(
    chunks,
    embedding=OpenAIEmbeddings(),
    persist_directory="./skills_index"
)

# Query
qa = RetrievalQA.from_chain_type(
    llm=ChatOpenAI(model="gpt-4o"),
    retriever=vectorstore.as_retriever(search_kwargs={"k": 4})
)

answer = qa.invoke("What is the rate limit for HubSpot Pro and how do I handle 429s?")
```

**LlamaIndex example:**

```python
from llama_index.core import SimpleDirectoryReader, VectorStoreIndex

documents = SimpleDirectoryReader("skills/", recursive=True).load_data()
index = VectorStoreIndex.from_documents(documents)
query_engine = index.as_query_engine()

response = query_engine.query(
    "How do I upsert a Salesforce contact by email and log a Task against it in one operation?"
)
print(response)
```

---

### Injecting skill docs into Claude API calls

If you're building a custom agent using the Claude API with tool use, you can inject relevant skill docs based on which tool the agent is about to call:

```python
import anthropic
from pathlib import Path

SKILL_DIR = Path("skills")

def get_skill(tool_name: str) -> str:
    """Load skill doc for a given tool slug."""
    skill_path = SKILL_DIR / tool_name / "skill.md"
    if skill_path.exists():
        return skill_path.read_text()
    return ""

def run_integration_agent(task: str, tools_needed: list[str]) -> str:
    """Run an agent that has skill docs injected for the tools it needs."""
    skill_context = "\n\n---\n\n".join(
        f"# {tool.upper()} SKILL REFERENCE\n{get_skill(tool)}"
        for tool in tools_needed
        if get_skill(tool)
    )

    client = anthropic.Anthropic()
    response = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=8192,
        system=f"""You are an integration engineer building reliable API integrations.

Use the following skill references for all API calls, auth flows, rate limiting,
and error handling. Do not deviate from the patterns described.

{skill_context}""",
        messages=[{"role": "user", "content": task}]
    )
    return response.content[0].text

# Example
result = run_integration_agent(
    task="Write a Python script that syncs Zendesk tickets (status=open, priority=urgent) to Jira bugs.",
    tools_needed=["zendesk", "jira"]
)
```

---

### In a `.claude/CLAUDE.md` project instruction file

If you work in Claude Code regularly, you can tell Claude to always use these docs:

```markdown
# Integration Skills

When writing code that integrates with any of the following tools, always read the
corresponding skill doc before writing code:

- Monday.com → @skills/monday/skill.md
- Salesforce → @skills/salesforce/skill.md
- Jira → @skills/jira/skill.md
- Dynamics 365 → @skills/dynamics365/skill.md
- HubSpot → @skills/hubspot/skill.md
- ServiceNow → @skills/servicenow/skill.md
- Zendesk → @skills/zendesk/skill.md
- Asana → @skills/asana/skill.md
- GitHub → @skills/github/skill.md
- Figma → @skills/figma/skill.md
- Slack → @skills/slack/skill.md
- Stripe → @skills/stripe/skill.md
- Notion → @skills/notion/skill.md
- Linear → @skills/linear/skill.md

Follow the auth patterns, rate limit handling, and error codes exactly as documented.
Always pin API version headers where specified.
```

---

## Best practices for prompting with skill docs

| Goal | What to include in the prompt |
|------|-------------------------------|
| Write integration code | Full skill doc or the "Auth" + "Recipes" sections |
| Debug an error | "Error handling" section + the exact error message you received |
| Plan a workflow | "Best-fit use cases" table + "Key concepts" section |
| Review existing code | Full skill doc (the AI can spot deviations from documented patterns) |
| Handle rate limits | "Reliability" section only — it's self-contained |
| Set up webhooks | The webhook recipe from "Common workflows" + "Testing checklist" |

**Tips:**
- When working across two tools (e.g., Zendesk → Jira sync), include both skill docs.
- For code generation, always mention the target language — the recipes are in `curl`/Python pseudocode by default.
- The "Testing checklist" section at the bottom of each skill is useful as a prompt to verify generated code: *"Check this code against the testing checklist in the skill doc."*

---

## Keeping skills current

Skills are validated against live API docs. Each doc has a `Last validated:` date in the header. Key things to watch:

- **Monday.com** — new API version released every quarter; always pin `API-Version` header to `2026-01` (current) or check [developer.monday.com/api-reference/docs/api-versioning](https://developer.monday.com/api-reference/docs/api-versioning)
- **Salesforce** — new API version each seasonal release (Spring/Summer/Winter); currently v66.0. Check `/services/data/` on your org for available versions.
- **Jira** — `GET /rest/api/3/search` is deprecated; use `POST /rest/api/3/search/jql`
- **HubSpot** — date-based versioning (`2025-09` style) rolling out alongside v3; rate limits updated Sep 2024
- **ServiceNow** — currently Yokohama release (March 2025); update URL bundle names on instance upgrade
- **GitHub** — always pin `X-GitHub-Api-Version: 2022-11-28`; prefer fine-grained PATs over classic PATs; `GITHUB_TOKEN` in Actions is limited to 1,000 req/repo/hr
- **Figma** — `files:read` scope is deprecated; use granular scopes (`file_content:read`, `file_comments:write`, etc.); rate limits updated Nov 2025 and now vary by plan + seat type

See [ROADMAP.md](skills/ROADMAP.md) for the full governance and update process.

---

## Contributing

To add or update a skill:

1. Create a branch: `git checkout -b skill/<toolname>`
2. Follow the template structure in any existing `skill.md` — all 11 sections required.
3. Verify all endpoints, rate limits, and auth flows against the official vendor docs before committing.
4. Add a `Last validated:` date to the doc header.
5. Update `skills/INDEX.md` and `README.md` when adding a new tool.
6. Link to official sources in the `## Sources` section — no unverified claims.
7. Open a PR — CI runs `npm test` which validates that your skill loads and has all required sections.

**Releases** are automated: merge to `main`, then go to GitHub Actions → **Release** → Run workflow → pick `patch / minor / major`.
