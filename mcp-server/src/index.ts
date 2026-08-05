#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// ---------------------------------------------------------------------------
// Skill loading
// ---------------------------------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveSkillsDir(): string {
  if (process.env.SKILLS_DIR) return process.env.SKILLS_DIR;

  // Prefer the repo-root skills directory in local development, but fall back
  // to the bundled package copy for published installs.
  const candidates = [
    path.resolve(__dirname, "../../skills"),
    path.resolve(__dirname, "../skills"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return candidates[0];
}

function resolvePlaybooksDir(): string {
  if (process.env.PLAYBOOKS_DIR) return process.env.PLAYBOOKS_DIR;

  const candidates = [
    path.resolve(__dirname, "../../playbooks"),
    path.resolve(__dirname, "../playbooks"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return candidates[0];
}

function resolvePackageVersion(): string {
  const packageJsonPath = path.resolve(__dirname, "../package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8")) as { version?: string };
  return packageJson.version ?? "0.0.0";
}

function loadSkills(skillsDir: string): Map<string, string> {
  const skills = new Map<string, string>();

  if (!fs.existsSync(skillsDir)) {
    process.stderr.write(`[clawskills-mcp] Skills directory not found: ${skillsDir}\n`);
    return skills;
  }

  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillFile = path.join(skillsDir, entry.name, "skill.md");
    if (!fs.existsSync(skillFile)) continue;
    const content = fs.readFileSync(skillFile, "utf-8");
    skills.set(entry.name, content);
  }

  process.stderr.write(`[clawskills-mcp] Loaded ${skills.size} skills: ${[...skills.keys()].join(", ")}\n`);
  return skills;
}

function loadPlaybooks(playbooksDir: string): Map<string, string> {
  const playbooks = new Map<string, string>();

  if (!fs.existsSync(playbooksDir)) {
    process.stderr.write(`[clawskills-mcp] Playbooks directory not found: ${playbooksDir}\n`);
    return playbooks;
  }

  const entries = fs.readdirSync(playbooksDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md") || entry.name === "INDEX.md") continue;
    const slug = entry.name.replace(/\.md$/, "");
    const content = fs.readFileSync(path.join(playbooksDir, entry.name), "utf-8");
    playbooks.set(slug, content);
  }

  process.stderr.write(`[clawskills-mcp] Loaded ${playbooks.size} playbooks: ${[...playbooks.keys()].join(", ")}\n`);
  return playbooks;
}

// ---------------------------------------------------------------------------
// Section extraction
// ---------------------------------------------------------------------------

const SECTION_ALIASES: Record<string, string> = {
  auth: "Authentication & permissions",
  authentication: "Authentication & permissions",
  "rate-limits": "Reliability: rate limits, retries, idempotency",
  "rate_limits": "Reliability: rate limits, retries, idempotency",
  ratelimits: "Reliability: rate limits, retries, idempotency",
  reliability: "Reliability: rate limits, retries, idempotency",
  errors: "Error handling & troubleshooting",
  "error-handling": "Error handling & troubleshooting",
  pagination: "Query patterns & filtering",
  recipes: "Common workflows (recipes)",
  gotchas: "Gotchas",
  webhooks: "Webhooks",
  overview: "Overview",
  fields: "Field reference",
  "field-reference": "Field reference",
};

function extractSection(content: string, sectionQuery: string): string | null {
  const normalized = sectionQuery.toLowerCase().trim();
  const targetHeader = SECTION_ALIASES[normalized] ?? sectionQuery;

  const lines = content.split("\n");
  let inSection = false;
  const sectionLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (inSection) break; // Next ## means we've left the section
      if (line.slice(3).trim().toLowerCase() === targetHeader.toLowerCase()) {
        inSection = true;
        sectionLines.push(line);
        continue;
      }
    }
    if (inSection) sectionLines.push(line);
  }

  return sectionLines.length > 0 ? sectionLines.join("\n").trimEnd() : null;
}

// ---------------------------------------------------------------------------
// Fuzzy name matching
// ---------------------------------------------------------------------------

function findSkill(skills: Map<string, string>, name: string): string | undefined {
  const lower = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  // Exact match first
  if (skills.has(name)) return name;
  // Case-insensitive exact
  for (const key of skills.keys()) {
    if (key.toLowerCase() === name.toLowerCase()) return key;
  }
  // Slug-normalized match
  for (const key of skills.keys()) {
    if (key.toLowerCase().replace(/[^a-z0-9]/g, "") === lower) return key;
  }
  // Prefix match
  for (const key of skills.keys()) {
    if (key.toLowerCase().startsWith(lower) || lower.startsWith(key.toLowerCase())) return key;
  }
  return undefined;
}

function findPlaybook(playbooks: Map<string, string>, name: string): string | undefined {
  return findSkill(playbooks, name);
}

// ---------------------------------------------------------------------------
// Search helper
// ---------------------------------------------------------------------------

interface SearchResult {
  name: string;
  excerpts: string[];
}

interface PlaybookMetadata {
  title?: string;
  systems: string[];
  tags: string[];
  triggerType?: string;
}

interface UnifiedSearchResult extends SearchResult {
  contentType: "skill" | "playbook";
  score: number;
}

function parseFrontmatter(content: string): Record<string, string | string[]> {
  if (!content.startsWith("---\n")) return {};

  const end = content.indexOf("\n---\n", 4);
  if (end === -1) return {};

  const block = content.slice(4, end);
  const metadata: Record<string, string | string[]> = {};
  let currentKey: string | null = null;

  for (const rawLine of block.split("\n")) {
    const line = rawLine.trimEnd();
    const keyMatch = line.match(/^([a-zA-Z0-9_]+):\s*(.*)$/);
    if (keyMatch) {
      const [, key, value] = keyMatch;
      if (value === "") {
        metadata[key] = [];
        currentKey = key;
      } else {
        metadata[key] = value.trim();
        currentKey = null;
      }
      continue;
    }

    const listMatch = line.match(/^\s*-\s+(.*)$/);
    if (listMatch && currentKey) {
      const current = metadata[currentKey];
      if (Array.isArray(current)) {
        current.push(listMatch[1].trim());
      }
    }
  }

  return metadata;
}

function getPlaybookMetadata(content: string): PlaybookMetadata {
  const frontmatter = parseFrontmatter(content);
  const systems = Array.isArray(frontmatter.systems) ? frontmatter.systems : [];
  const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];
  return {
    title: typeof frontmatter.title === "string" ? frontmatter.title : undefined,
    systems,
    tags,
    triggerType: typeof frontmatter.trigger_type === "string" ? frontmatter.trigger_type : undefined,
  };
}

function searchDocuments(documents: Map<string, string>, query: string): SearchResult[] {
  const results: SearchResult[] = [];
  const lowerQuery = query.toLowerCase();
  const queryTerms = lowerQuery.split(/[^a-z0-9]+/).filter(Boolean);
  const CONTEXT_LINES = 3;
  const MAX_PER_SKILL = 5;

  for (const [name, content] of documents.entries()) {
    const lines = content.split("\n");
    const excerpts: string[] = [];
    const usedRanges: Array<[number, number]> = [];

    for (let i = 0; i < lines.length; i++) {
      const lowerLine = lines[i].toLowerCase();
      const matchesExact = lowerLine.includes(lowerQuery);
      const matchesTerm = queryTerms.some((term) => lowerLine.includes(term));
      if (!matchesExact && !matchesTerm) continue;

      const start = Math.max(0, i - CONTEXT_LINES);
      const end = Math.min(lines.length - 1, i + CONTEXT_LINES);

      // Skip if overlaps with an existing range
      const overlaps = usedRanges.some(([s, e]) => start <= e && end >= s);
      if (overlaps) continue;

      usedRanges.push([start, end]);
      const excerpt = lines.slice(start, end + 1).join("\n");
      excerpts.push(excerpt);

      if (excerpts.length >= MAX_PER_SKILL) break;
    }

    if (excerpts.length > 0) {
      results.push({ name, excerpts });
    }
  }

  return results;
}

function searchSkills(skills: Map<string, string>, query: string): SearchResult[] {
  return searchDocuments(skills, query);
}

function searchPlaybooks(playbooks: Map<string, string>, query: string): SearchResult[] {
  return searchDocuments(playbooks, query);
}

function searchClawskills(skills: Map<string, string>, playbooks: Map<string, string>, query: string): UnifiedSearchResult[] {
  const normalizedQuery = query.toLowerCase();
  const queryTerms = normalizedQuery.split(/[^a-z0-9]+/).filter(Boolean);
  const workflowHints = new Set([
    "sync", "onboarding", "closed", "won", "handoff", "escalate",
    "escalation", "workflow", "playbook", "incident", "notify",
  ]);
  const workflowShaped = queryTerms.some((term) => workflowHints.has(term));

  const skillResults: UnifiedSearchResult[] = searchSkills(skills, query).map((result) => ({
    ...result,
    contentType: "skill",
    score: result.excerpts.length * 10 + (workflowShaped ? 0 : 5),
  }));

  const playbookResults: UnifiedSearchResult[] = searchPlaybooks(playbooks, query).map((result) => {
    const metadata = getPlaybookMetadata(playbooks.get(result.name)!);
    const metadataText = [metadata.title, ...metadata.systems, ...metadata.tags, metadata.triggerType]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const metadataMatches = queryTerms.filter((term) => metadataText.includes(term)).length;
    return {
      ...result,
      contentType: "playbook",
      score: result.excerpts.length * 10 + metadataMatches * 5 + (workflowShaped ? 15 : 0),
    };
  });

  return [...playbookResults, ...skillResults]
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, 12);
}

// ---------------------------------------------------------------------------
// Skill summary (first meaningful line)
// ---------------------------------------------------------------------------

// Playbooks open with a YAML frontmatter block; skills open with an H1 followed
// by a blockquote. Without the frontmatter handling below, every playbook
// summary came out as the literal "---" delimiter.
function skillSummary(content: string): string {
  const lines = content.split("\n");
  let start = 0;

  if (lines[0]?.trim() === "---") {
    const closing = lines.findIndex((line, i) => i > 0 && line.trim() === "---");
    if (closing !== -1) {
      for (const line of lines.slice(1, closing)) {
        const title = line.match(/^title:\s*(.+)$/);
        if (title) return title[1].trim().replace(/^["']|["']$/g, "");
      }
      start = closing + 1;
    }
  }

  for (const line of lines.slice(start)) {
    const trimmed = line.trim().replace(/^>\s*/, "");
    if (trimmed && trimmed !== "---" && !trimmed.startsWith("#")) return trimmed;
  }
  return "";
}

// ---------------------------------------------------------------------------
// Exports for testing
// ---------------------------------------------------------------------------

export {
  resolveSkillsDir,
  resolvePlaybooksDir,
  resolvePackageVersion,
  loadSkills,
  loadPlaybooks,
  extractSection,
  findSkill,
  findPlaybook,
  searchSkills,
  searchPlaybooks,
  searchClawskills,
  getPlaybookMetadata,
  skillSummary,
};

// ---------------------------------------------------------------------------
// MCP Server setup
// ---------------------------------------------------------------------------

const SKILLS_DIR = resolveSkillsDir();
const PLAYBOOKS_DIR = resolvePlaybooksDir();
const PACKAGE_VERSION = resolvePackageVersion();
const skills = loadSkills(SKILLS_DIR);
const playbooks = loadPlaybooks(PLAYBOOKS_DIR);

const server = new Server(
  { name: "clawskills-mcp", version: PACKAGE_VERSION },
  { capabilities: { tools: {} } }
);

// List tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "list_skills",
      description:
        "List the slugs of every available API integration skill doc, with a one-line summary of each. " +
        "Read-only; takes no arguments; returns a short list (currently 14 entries), not the doc bodies. " +
        "Call this first when you do not yet know which platform slug to pass to get_skill, or to check whether a platform is covered at all before falling back to general knowledge.",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "get_skill",
      description:
        "Fetch the integration guide for one SaaS platform: authentication, rate limits, pagination, error handling, and tested request recipes. " +
        "Read-only. Returns Markdown. A whole doc is large (roughly 20-40 KB), so pass `section` to retrieve just the part you need unless you genuinely want everything. " +
        "Use this when you already know the platform; use search_skills instead when you know the problem but not the platform. " +
        "Each doc carries a `Last validated` date in its header indicating when it was last checked against the vendor's live documentation.",
      inputSchema: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description:
              "Skill slug, lowercase, exactly as returned by list_skills. One of: asana, dynamics365, figma, github, hubspot, jira, linear, monday, notion, salesforce, servicenow, slack, stripe, zendesk.",
          },
          section: {
            type: "string",
            description:
              "Optional. Return only this section instead of the whole document. One of: auth, rate-limits, errors, pagination, recipes, gotchas, webhooks, overview, fields. Omit to return the full doc.",
          },
        },
        required: ["name"],
      },
    },
    {
      name: "search_skills",
      description:
        "Full-text search across all 14 platform skill docs, returning matching excerpts with surrounding context rather than whole documents. " +
        "Read-only. Use when you know the problem but not which platform doc answers it — for example a specific error code, header, or auth mechanism. " +
        "Searches single-platform docs only; use search_clawskills if the task spans two systems.",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Free-text query matched against document contents. Works best with concrete API terms, e.g. '429 retry', 'OAuth scopes', 'webhook signature'.",
          },
        },
        required: ["query"],
      },
    },
    {
      name: "list_playbooks",
      description:
        "List the slugs of every available cross-tool workflow playbook, with a one-line summary of each. " +
        "Read-only; takes no arguments; returns a short list (currently 4 entries), not the playbook bodies. " +
        "Playbooks describe how to wire two systems together end to end; single-platform API questions are covered by list_skills instead.",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "get_playbook",
      description:
        "Fetch one cross-tool workflow playbook: the trigger, source of truth, field mapping, idempotency and dedup keys, retry and partial-failure policy, and reconciliation steps for syncing two systems. " +
        "Read-only. Returns Markdown, typically a few KB. " +
        "Use this when the task spans two platforms (for example 'create a Jira issue from a Zendesk ticket'); use get_skill when the task involves only one.",
      inputSchema: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description:
              "Playbook slug, lowercase, exactly as returned by list_playbooks. One of: hubspot-asana-onboarding, salesforce-hubspot-lead-sync, slack-jira-incident, zendesk-jira-bug-escalation.",
          },
        },
        required: ["name"],
      },
    },
    {
      name: "search_playbooks",
      description:
        "Full-text search across the cross-tool workflow playbooks, returning matching excerpts with surrounding context. " +
        "Read-only. Use for orchestration concerns that recur across integrations — idempotency, dedup keys, rollback, partial failure — when you do not know which playbook covers them.",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Free-text query matched against playbook contents, e.g. 'idempotency', 'rollback', 'customer impact'.",
          },
        },
        required: ["query"],
      },
    },
    {
      name: "search_clawskills",
      description:
        "Full-text search across both the platform skill docs and the workflow playbooks in one call, returning matching excerpts with context. " +
        "Read-only. Playbooks are ranked ahead of skill matches for workflow-shaped queries. " +
        "Prefer this as the default entry point when you are unsure whether the answer is a single-platform API detail or a two-system workflow; reach for search_skills or search_playbooks only when you want to restrict results to one of the two.",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Free-text query matched against both corpora, e.g. 'closed won onboarding', 'zendesk jira escalation', 'lead sync'.",
          },
        },
        required: ["query"],
      },
    },
  ],
}));

// Call tools
const GetSkillSchema = z.object({ name: z.string(), section: z.string().optional() });
const GetPlaybookSchema = z.object({ name: z.string() });
const SearchSkillsSchema = z.object({ query: z.string() });
const SearchPlaybooksSchema = z.object({ query: z.string() });
const SearchClawskillsSchema = z.object({ query: z.string() });

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "list_skills") {
    if (skills.size === 0) {
      return { content: [{ type: "text", text: "No skills loaded. Check SKILLS_DIR." }] };
    }
    const lines = [...skills.entries()].map(([slug, content]) => {
      const summary = skillSummary(content);
      return `• **${slug}** — ${summary}`;
    });
    return { content: [{ type: "text", text: `Available skills (${skills.size}):\n\n${lines.join("\n")}` }] };
  }

  if (name === "list_playbooks") {
    if (playbooks.size === 0) {
      return { content: [{ type: "text", text: "No playbooks loaded. Check PLAYBOOKS_DIR." }] };
    }
    const lines = [...playbooks.entries()].map(([slug, content]) => `• **${slug}** — ${skillSummary(content)}`);
    return { content: [{ type: "text", text: `Available playbooks (${playbooks.size}):\n\n${lines.join("\n")}` }] };
  }

  if (name === "get_skill") {
    const parsed = GetSkillSchema.safeParse(args);
    if (!parsed.success) {
      return { content: [{ type: "text", text: `Invalid arguments: ${parsed.error.message}` }], isError: true };
    }
    const { name: skillName, section } = parsed.data;
    const slug = findSkill(skills, skillName);

    if (!slug) {
      const available = [...skills.keys()].join(", ");
      return {
        content: [{ type: "text", text: `Skill "${skillName}" not found. Available skills: ${available}` }],
        isError: true,
      };
    }

    const content = skills.get(slug)!;

    if (section) {
      const extracted = extractSection(content, section);
      if (!extracted) {
        return {
          content: [{ type: "text", text: `Section "${section}" not found in skill "${slug}". Try: auth, rate-limits, errors, pagination, recipes, gotchas, webhooks, overview, fields` }],
          isError: true,
        };
      }
      return { content: [{ type: "text", text: extracted }] };
    }

    return { content: [{ type: "text", text: content }] };
  }

  if (name === "search_skills") {
    const parsed = SearchSkillsSchema.safeParse(args);
    if (!parsed.success) {
      return { content: [{ type: "text", text: `Invalid arguments: ${parsed.error.message}` }], isError: true };
    }
    const { query } = parsed.data;
    const results = searchSkills(skills, query);

    if (results.length === 0) {
      return { content: [{ type: "text", text: `No results found for "${query}".` }] };
    }

    const output = results
      .map(({ name: skill, excerpts }) => {
        const blocks = excerpts.map((e, i) => `--- match ${i + 1} ---\n${e}`).join("\n\n");
        return `### ${skill}\n\n${blocks}`;
      })
      .join("\n\n---\n\n");

    return { content: [{ type: "text", text: `Search results for "${query}":\n\n${output}` }] };
  }

  if (name === "get_playbook") {
    const parsed = GetPlaybookSchema.safeParse(args);
    if (!parsed.success) {
      return { content: [{ type: "text", text: `Invalid arguments: ${parsed.error.message}` }], isError: true };
    }
    const slug = findPlaybook(playbooks, parsed.data.name);
    if (!slug) {
      const available = [...playbooks.keys()].join(", ");
      return {
        content: [{ type: "text", text: `Playbook "${parsed.data.name}" not found. Available playbooks: ${available}` }],
        isError: true,
      };
    }
    return { content: [{ type: "text", text: playbooks.get(slug)! }] };
  }

  if (name === "search_playbooks") {
    const parsed = SearchPlaybooksSchema.safeParse(args);
    if (!parsed.success) {
      return { content: [{ type: "text", text: `Invalid arguments: ${parsed.error.message}` }], isError: true };
    }
    const { query } = parsed.data;
    const results = searchPlaybooks(playbooks, query);

    if (results.length === 0) {
      return { content: [{ type: "text", text: `No playbook results found for "${query}".` }] };
    }

    const output = results
      .map(({ name: playbook, excerpts }) => {
        const blocks = excerpts.map((e, i) => `--- match ${i + 1} ---\n${e}`).join("\n\n");
        return `### ${playbook}\n\n${blocks}`;
      })
      .join("\n\n---\n\n");

    return { content: [{ type: "text", text: `Playbook search results for "${query}":\n\n${output}` }] };
  }

  if (name === "search_clawskills") {
    const parsed = SearchClawskillsSchema.safeParse(args);
    if (!parsed.success) {
      return { content: [{ type: "text", text: `Invalid arguments: ${parsed.error.message}` }], isError: true };
    }
    const { query } = parsed.data;
    const results = searchClawskills(skills, playbooks, query);

    if (results.length === 0) {
      return { content: [{ type: "text", text: `No results found for "${query}".` }] };
    }

    const output = results
      .map(({ name: itemName, contentType, excerpts }) => {
        const blocks = excerpts.map((e, i) => `--- match ${i + 1} ---\n${e}`).join("\n\n");
        return `### [${contentType}] ${itemName}\n\n${blocks}`;
      })
      .join("\n\n---\n\n");

    return { content: [{ type: "text", text: `Unified search results for "${query}":\n\n${output}` }] };
  }

  return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("[clawskills-mcp] Server running on stdio\n");
}

if (process.env.NODE_ENV !== "test") {
  main().catch((err) => {
    process.stderr.write(`[clawskills-mcp] Fatal: ${err}\n`);
    process.exit(1);
  });
}
