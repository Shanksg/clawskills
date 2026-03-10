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

// ---------------------------------------------------------------------------
// Search helper
// ---------------------------------------------------------------------------

interface SearchResult {
  skill: string;
  excerpts: string[];
}

function searchSkills(skills: Map<string, string>, query: string): SearchResult[] {
  const results: SearchResult[] = [];
  const lowerQuery = query.toLowerCase();
  const CONTEXT_LINES = 3;
  const MAX_PER_SKILL = 5;

  for (const [slug, content] of skills.entries()) {
    const lines = content.split("\n");
    const excerpts: string[] = [];
    const usedRanges: Array<[number, number]> = [];

    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].toLowerCase().includes(lowerQuery)) continue;

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
      results.push({ skill: slug, excerpts });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Skill summary (first meaningful line)
// ---------------------------------------------------------------------------

function skillSummary(content: string): string {
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) return trimmed;
  }
  return "";
}

// ---------------------------------------------------------------------------
// Exports for testing
// ---------------------------------------------------------------------------

export { resolveSkillsDir, resolvePackageVersion, loadSkills, extractSection, findSkill, searchSkills, skillSummary };

// ---------------------------------------------------------------------------
// MCP Server setup
// ---------------------------------------------------------------------------

const SKILLS_DIR = resolveSkillsDir();
const PACKAGE_VERSION = resolvePackageVersion();
const skills = loadSkills(SKILLS_DIR);

const server = new Server(
  { name: "clawskills-mcp", version: PACKAGE_VERSION },
  { capabilities: { tools: {} } }
);

// List tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "list_skills",
      description: "List all available ClawSkills API integration skill docs.",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "get_skill",
      description:
        "Retrieve a ClawSkills skill doc by name (slug). Optionally specify a section (e.g. 'auth', 'rate-limits', 'recipes') to get just that part.",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Skill slug, e.g. 'salesforce', 'github', 'figma'" },
          section: {
            type: "string",
            description:
              "Optional section name. Aliases: auth, rate-limits, errors, pagination, recipes, gotchas, webhooks, overview, fields",
          },
        },
        required: ["name"],
      },
    },
    {
      name: "search_skills",
      description:
        "Search across all skill docs for a query string. Returns matching excerpts with context. Useful when you don't know which skill to fetch.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query, e.g. '429 retry', 'OAuth scopes', 'webhook signature'" },
        },
        required: ["query"],
      },
    },
  ],
}));

// Call tools
const GetSkillSchema = z.object({ name: z.string(), section: z.string().optional() });
const SearchSkillsSchema = z.object({ query: z.string() });

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
      .map(({ skill, excerpts }) => {
        const blocks = excerpts.map((e, i) => `--- match ${i + 1} ---\n${e}`).join("\n\n");
        return `### ${skill}\n\n${blocks}`;
      })
      .join("\n\n---\n\n");

    return { content: [{ type: "text", text: `Search results for "${query}":\n\n${output}` }] };
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
