# Skills Roadmap

## Objectives

This skill set enables end-to-end automation and integration across the most commonly used SaaS platforms in modern go-to-market and operations stacks. Concretely, it allows an agent or automation builder to:

- **Capture and route work** — convert external events (alerts, form submissions, emails) into tickets, tasks, or records in the right system.
- **Synchronize data** — keep CRM, project, and support systems consistent without manual re-entry.
- **Automate handoffs** — trigger downstream actions when records change status, owner, or stage.
- **Log activity** — append structured notes, calls, and comments for audit and reporting purposes.
- **Report and surface insights** — pull pipeline, queue, and project data into dashboards or summaries.

---

## Current state (as of 2026-03-01)

### What's shipped

| Layer | Status |
|-------|--------|
| **11 skill docs** — Monday.com, Salesforce, Jira, Dynamics 365, HubSpot, ServiceNow, Zendesk, Asana, GitHub, Figma, Slack | ✅ Live |
| **MCP server** — `clawskills-mcp` v0.2.3 on npm; `list_skills`, `get_skill`, `search_skills` | ✅ Live |
| **CI pipeline** — build + test on every push/PR via `ci.yml` | ✅ Live |
| **Release automation** — `release.yml` workflow_dispatch → bump, tag, npm publish via OIDC | ✅ Live |
| **Test suite** — Vitest unit tests + real-skills validation (required sections, ≥5 KB, all 11 tools) | ✅ Live |
| **Public repo readiness** — MIT license, `.gitignore`, full `package.json` metadata | ✅ Ready |

### Content coverage by original phase

| Phase | Theme | Status |
|-------|-------|--------|
| Phase 1 — Foundation (Auth + Core CRUD) | Auth flows, basic CRUD, retry patterns | ✅ Complete — all 11 tools |
| Phase 2 — High-Frequency Workflows | 6–12 recipes per tool | ✅ Complete — all 11 tools |
| Phase 3 — Event-Driven & Real-Time | Webhook setup, signature verification, event handling | ✅ Complete — all 11 tools |
| Phase 4 — Bulk & Advanced Operations | Batch APIs, large-volume patterns | ⚠️ Partial — documented for most tools; not all have >500-record examples |
| Phase 5 — Cross-Tool Orchestration | Multi-system recipes spanning 2+ tools | ❌ Not started — patterns listed in INDEX.md but no dedicated recipes |

---

## Next development phase

### Priority 1 — Content expansion: 3 new skills

Each new skill follows the 11-section template, lives on a `skill/<name>` branch, and is validated by CI before merge.

| Skill | Why | Key areas to cover |
|-------|-----|--------------------|
| **Stripe** | Most common payments API; revenue-critical workflows missing from current library | Webhooks (event types + signature), Checkout Sessions, subscriptions, refunds, idempotency keys, Connect (multi-account) |
| **Notion** | Knowledge base + lightweight PM; high demand for doc/wiki automation | Pages API, Databases + filters + sorts, Blocks API (rich text), Search, cursor pagination |
| **Linear** | Fast-growing engineering tool, increasingly replacing Jira at startups | Issues, Projects, Teams, Cycles, GraphQL API, webhooks, OAuth + PAT auth |

**Order:** Stripe → Notion → Linear (payments coverage is the biggest gap).

**Acceptance criteria for each:**
- [ ] All 11 required sections present (CI enforces)
- [ ] `Last validated:` date in header
- [ ] Auth section has working `curl` example tested against sandbox/dev environment
- [ ] At least 8 recipes with request/response examples
- [ ] Rate limits verified against official docs
- [ ] INDEX.md and README.md updated

---

### Priority 2 — Freshness CI pipeline (the moat)

A weekly automated check that skill docs aren't stale and that key API patterns still work.

**Phase A — Staleness detection (low-effort, high-value):**
- Parse `Last validated:` date from each `skill.md` header
- Flag any doc older than 90 days in CI output
- Open a GitHub issue automatically when a doc exceeds the threshold
- Deliverable: `.github/workflows/freshness.yml` (weekly cron, `0 9 * * 1`) + `scripts/check-freshness.ts`

**Phase B — Live smoke tests (medium-effort, highest-value — the real moat):**
- For each tool, maintain a minimal test that hits: auth endpoint + one read
- Run weekly against sandbox environments using stored credentials (GitHub Secrets)
- Failure creates a doc-review issue with the tool name and failing assertion
- Candidates to start with: Jira (`/rest/api/3/myself`), GitHub (`/user`), HubSpot (`/crm/v3/objects/contacts?limit=1`)

**Acceptance criteria:**
- [ ] Weekly cron runs without manual intervention
- [ ] A PR that backdates a `Last validated:` date beyond 90 days fails the staleness check
- [ ] Smoke test failure creates an issue and does not block `main` CI (it's a separate workflow)

---

### Priority 3 — Distribution

| Channel | Status | Next action |
|---------|--------|-------------|
| GitHub (public) | Ready to flip | Make repo public |
| npm (`clawskills-mcp`) | ✅ Live — v0.2.3 | Maintain via `release.yml` |
| MCP registry listings | Not submitted | Submit to glama.ai, mcp.so, smithery.ai after public launch |
| Docs website | Planned | Mintlify — fastest path to SEO-friendly browsable docs |
| Lane A vs B | TBD | Revisit after first traction signals from public launch |

---

### Priority 4 — Complete Phase 4 & 5 gaps

These are lower priority than new skills but worth finishing:

**Phase 4 gaps (Bulk operations):**
- Salesforce Bulk API v2: end-to-end CSV ingest tested at ≥500 rows with error-row reporting
- HubSpot batch create/update: tested at max batch size (100 records), partial-success handling
- Zendesk Incremental Export API: full-sync recipe with cursor continuation

**Phase 5 (Cross-tool orchestration) — first 3 recipes:**
- Zendesk Ticket → Jira Bug (bidirectional status sync)
- HubSpot Deal Won → Asana project creation (onboarding trigger)
- Salesforce Lead → HubSpot Contact sync (dedup on email)

Each recipe lives as a `## Cross-tool recipe` appendix section in the relevant primary skill doc (e.g., the Zendesk→Jira recipe goes in both `zendesk/skill.md` and `jira/skill.md`).

---

## Prioritization framework

Each skill/recipe is scored on five dimensions (1–5 each):

| Dimension | Description |
|-----------|-------------|
| **Impact** | Business value if automated (revenue, hours saved, error reduction) |
| **Frequency** | How often the workflow runs daily/weekly |
| **Complexity** | Inverse score — simpler = higher priority |
| **Risk** | Inverse score — lower risk of data loss = higher priority |
| **Dependencies** | Whether other workflows depend on this one being stable |

**Priority score = (Impact × 2) + (Frequency × 1.5) + Complexity + Risk + Dependencies**

---

## Quality bar & governance

### Keeping docs accurate

- **Version pinning:** Each skill.md notes the API version it was validated against. Update the version header when re-validating.
- **Quarterly review cycle:** Docs older than 90 days are flagged by the freshness pipeline for re-review.
- **Changelog notes:** Major API changes (new auth flows, deprecated endpoints, rate limit changes) noted inline with `> ⚠️ Changed [date]:` callouts.

### Validation approach

- **CI test suite:** Real-skills tests in `mcp-server/src/index.test.ts` verify all skills load, have required sections, and are ≥5 KB.
- **Freshness pipeline:** Weekly cron checks `Last validated:` dates (see Priority 2 above).
- **Live smoke tests:** Optional phase B — weekly auth + read tests against sandboxes.
- **Breaking change monitoring:** Subscribe to each vendor's developer changelog:
  - Monday: https://developer.monday.com/changelog
  - Salesforce: https://help.salesforce.com/s/articleView?id=release-notes.salesforce_release_notes.htm
  - Jira: https://developer.atlassian.com/cloud/jira/platform/changelog/
  - Dynamics 365: https://learn.microsoft.com/en-us/dynamics365/release-plans/
  - HubSpot: https://developers.hubspot.com/changelog
  - ServiceNow: https://developer.servicenow.com/dev.do
  - Zendesk: https://developer.zendesk.com/api-reference/ticketing/introduction/#api-changelog
  - Asana: https://developers.asana.com/docs/changelog
  - GitHub: https://github.blog/changelog/
  - Figma: https://www.figma.com/developers/api#changelog
  - Slack: https://api.slack.com/changelog
  - Stripe: https://stripe.com/docs/changelog
  - Notion: https://developers.notion.com/page/changelog
  - Linear: https://linear.app/changelog

### Handling deprecations

1. When a deprecation notice is detected, create a tracking issue with the sunset date.
2. Update the affected recipe with a `> ⚠️ DEPRECATED as of [date]: use [new approach] instead.` callout.
3. Re-test and update the recipe before the sunset date.
4. Remove the deprecated recipe/example once the endpoint is gone.

### Contribution process

- PRs to `skill.md` files require: (a) reference to official doc, (b) tested curl/pseudocode example, (c) updated `Last validated:` date.
- Branch convention: `skill/<toolname>` → PR → merge to main.
- CI runs `npm test` on every PR — validates skill loads and has all required sections.
- Releases: merge to main, then GitHub Actions → **Release** → Run workflow → pick `patch / minor / major`.

---

## Backlog (tracked, not yet scheduled)

| Item | Tool(s) | Value | Complexity |
|------|---------|-------|------------|
| AI-powered ticket summarization (append LLM summary to description) | Zendesk, Jira, ServiceNow | High | Medium |
| Automated lead scoring sync | Salesforce, HubSpot | High | Medium |
| Revenue analytics aggregation (pull pipeline across CRMs) | Salesforce, HubSpot, Dynamics 365 | High | High |
| Token rotation automation (refresh before expiry) | All OAuth tools | High | Low |
| Twilio skill (SMS/voice notifications) | Twilio | High | Medium |
| Intercom skill (in-app messaging, user segments) | Intercom | Medium | Medium |
| Okta/Auth0 skill (identity + SSO) | Okta | Medium | Medium |
| PagerDuty skill (on-call, incident escalation) | PagerDuty | Medium | Low |
| Docs website (Mintlify/Docusaurus) | — | High | Medium |
| VS Code extension (inject skill doc into editor context) | — | Medium | High |
| REST API / hosted endpoint for skill doc retrieval | — | Medium | High |
| Admin automation: user provisioning/deprovisioning | All tools | Medium | Medium |
| Compliance export (GDPR data subject requests) | Zendesk, Salesforce, HubSpot | Medium | High |
| Zendesk → Salesforce Case sync (bidirectional) | Zendesk, Salesforce | High | High |
| ServiceNow CMDB auto-discovery integration | ServiceNow | High | High |
| Multi-workspace / multi-org management recipes | All tools | Medium | High |
| Audit log export to SIEM | Salesforce, Zendesk, ServiceNow | Medium | Medium |
