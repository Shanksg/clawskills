# Skills Roadmap

## Objectives

This skill set enables end-to-end automation and integration across the most commonly used SaaS platforms in modern go-to-market and operations stacks. Concretely, it allows an agent or automation builder to:

- **Capture and route work** — convert external events (alerts, form submissions, emails) into tickets, tasks, or records in the right system.
- **Synchronize data** — keep CRM, project, and support systems consistent without manual re-entry.
- **Automate handoffs** — trigger downstream actions when records change status, owner, or stage.
- **Log activity** — append structured notes, calls, and comments for audit and reporting purposes.
- **Report and surface insights** — pull pipeline, queue, and project data into dashboards or summaries.

---

## Current state (as of 2026-03-12)

### What's shipped

| Layer | Status |
|-------|--------|
| **14 skill docs** — Monday.com, Salesforce, Jira, Dynamics 365, HubSpot, ServiceNow, Zendesk, Asana, GitHub, Figma, Slack, Stripe, Notion, Linear | ✅ Live |
| **MCP server** — `clawskills-mcp` v0.6.0 on npm; `list_skills`, `get_skill`, `search_skills` | ✅ Live |
| **CI pipeline** — build + test on every push/PR via `ci.yml` | ✅ Live |
| **Release automation** — `release.yml` workflow_dispatch → bump, tag, npm publish via OIDC | ✅ Live |
| **Test suite** — Vitest unit tests + real-skills validation (required sections, ≥5 KB, all 14 tools) | ✅ Live |
| **Public repo readiness** — MIT license, `.gitignore`, full `package.json` metadata | ✅ Ready |

### Content coverage by original phase

| Phase | Theme | Status |
|-------|-------|--------|
| Phase 1 — Foundation (Auth + Core CRUD) | Auth flows, basic CRUD, retry patterns | ✅ Complete — all 14 tools |
| Phase 2 — High-Frequency Workflows | 6–12 recipes per tool | ✅ Complete — all 14 tools |
| Phase 3 — Event-Driven & Real-Time | Webhook setup, signature verification, event handling | ✅ Complete — all 14 tools |
| Phase 4 — Bulk & Advanced Operations | Batch APIs, large-volume patterns | ⚠️ Partial — documented for most tools; not all have >500-record examples |
| Phase 5 — Cross-Tool Orchestration | Multi-system recipes spanning 2+ tools | ❌ Not started — patterns listed in INDEX.md but no dedicated recipes |

---

## Next development phase

### Priority 1 — Freshness and accuracy pipeline

Now that the core 14-skill library exists, the next moat is keeping it accurate as vendor APIs change.

**Phase A — Staleness detection (low-effort, high-value):**
- Parse `Last validated:` date from each `skill.md` header
- Flag any doc older than 90 days in CI output
- Open a GitHub issue automatically when a doc exceeds the threshold
- Deliverable: `.github/workflows/freshness.yml` (weekly cron, `0 9 * * 1`) + `scripts/check-freshness.ts`

**Phase B — Live smoke tests (medium-effort, highest-value):**
- For each tool, maintain a minimal test that hits: auth endpoint + one read
- Run weekly against sandbox environments using stored credentials (GitHub Secrets)
- Failure creates a doc-review issue with the tool name and failing assertion
- Candidates to start with: Jira (`/rest/api/3/myself`), GitHub (`/user`), HubSpot (`/crm/v3/objects/contacts?limit=1`)

**Acceptance criteria:**
- [ ] Weekly cron runs without manual intervention
- [ ] A PR that backdates a `Last validated:` date beyond 90 days fails the staleness check
- [ ] Smoke test failure creates an issue and does not block `main` CI (it's a separate workflow)

---

### Priority 2 — Packaging and distribution hygiene

The repo now needs tighter alignment between the canonical `skills/` directory, the bundled npm package contents, and the docs that describe them.

- Eliminate stale bundled skill copies during local development
- Ensure the MCP server reports the package version rather than a hardcoded value
- Add a CI check that the packaged `mcp-server/skills` tree matches root `skills/`
- Add a CI/doc check that skill counts and package versions referenced in README/ROADMAP stay current

**Acceptance criteria:**
- [ ] `npm run build` and `npm start` use the same skill set locally and in published packages
- [ ] The server-reported version matches `mcp-server/package.json`
- [ ] CI fails if docs or packaged skill copies drift from the canonical source

---

### Priority 3 — Distribution

| Channel | Status | Next action |
|---------|--------|-------------|
| GitHub (public) | Ready to flip | Make repo public |
| npm (`clawskills-mcp`) | ✅ Live — v0.6.0 | Maintain via `release.yml` |
| MCP registry listings | Not submitted | Submit to glama.ai, mcp.so, smithery.ai after public launch |
| Docs website | Planned | Mintlify — fastest path to SEO-friendly browsable docs |
| Lane A vs B | TBD | Revisit after first traction signals from public launch |

---

### Priority 4 — Complete Phase 4 & 5 gaps

These are lower priority than freshness and packaging work, but worth finishing:

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

### Priority 5 — Workflow playbooks and retrieval UX

The next product layer is workflow-first guidance, not only tool-by-tool references. This means shipping opinionated playbooks that show how multiple systems fit together operationally, then exposing them cleanly through MCP.

**Backlog:**
- Add a `playbooks/` directory with high-value cross-tool workflows
- Ship 3 flagship playbooks first:
  - Zendesk Ticket -> Jira Bug escalation
  - HubSpot Deal Won -> Asana onboarding kickoff
  - Salesforce Lead -> HubSpot Contact sync
- Expand to additional high-frequency workflows:
  - Slack incident -> Jira issue
  - GitHub PR -> Slack notification
  - Zendesk -> Salesforce case sync
  - Stripe payment failed -> HubSpot task
  - Notion request -> Asana task
- Standardize each playbook format:
  - business trigger
  - systems involved
  - source-of-truth decision
  - field mapping
  - idempotency strategy
  - retry and partial-failure policy
  - reconciliation and rollback guidance
  - observability / alerting checks
- Expose playbooks through MCP after the doc layer stabilizes:
  - `list_playbooks`
  - `get_playbook`
  - search/ranking that prefers recipes and playbooks over generic mentions

**Acceptance criteria:**
- [ ] At least 3 production-grade playbooks checked into the repo
- [ ] README and INDEX reference the playbooks layer
- [ ] MCP server plan defined for playbook retrieval and discovery

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
  - Monday: https://developer.monday.com/api-reference/docs/api-versioning (versioning table) + https://developer.monday.com/changelog (entries)
  - Salesforce: https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/rest_rns.htm — ⚠️ JS-rendered; WebFetch returns header only. Use a browser or a headless-browser tool to read.
  - Jira: https://developer.atlassian.com/cloud/jira/platform/changelog/
  - Dynamics 365: https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/web-api-versions (Web API version differences) + https://learn.microsoft.com/en-us/dynamics365/released-versions/microsoft-dataverse (weekly release notes)
  - HubSpot: https://developers.hubspot.com/changelog
  - ServiceNow: https://www.servicenow.com/docs/bundle/yokohama-release-notes/page/release-notes/family-release-notes.html (current named release; rotate URL on each new release)
  - Zendesk: https://developer.zendesk.com/api-reference/changelog/changelog/
  - Asana: https://forum.asana.com/c/forum-en/api/api-change-log/204 — Asana hosts their dated API changelog as a forum category (individual entries are threads under it); the developer-portal page just redirects here
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
