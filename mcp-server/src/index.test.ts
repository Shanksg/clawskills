import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { fileURLToPath } from "url";
import { loadSkills, extractSection, findSkill, searchSkills, skillSummary } from "./index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REAL_SKILLS_DIR = path.resolve(__dirname, "../../skills");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempSkillsDir(skills: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clawskills-test-"));
  for (const [slug, content] of Object.entries(skills)) {
    const skillDir = path.join(dir, slug);
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, "skill.md"), content, "utf-8");
  }
  return dir;
}

const SAMPLE_CONTENT = `# GitHub Skill

A skill doc for GitHub API.

## Overview

GitHub is a code hosting platform for version control and collaboration.

## Authentication & permissions

Use a Personal Access Token (PAT) or OAuth token.

Scopes: repo, read:user, etc.

## Rate limits

- Authenticated: 5000 req/hour
- Unauthenticated: 60 req/hour

## Recipes

### Create an issue

POST /repos/{owner}/{repo}/issues
`;

let tempDir: string;

beforeAll(() => {
  tempDir = makeTempSkillsDir({ github: SAMPLE_CONTENT, salesforce: "# Salesforce\nCRM platform.\n## Overview\nSalesforce is a CRM." });
});

afterAll(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// loadSkills
// ---------------------------------------------------------------------------

describe("loadSkills", () => {
  it("loads skill files from a directory", () => {
    const skills = loadSkills(tempDir);
    expect(skills.size).toBe(2);
    expect(skills.has("github")).toBe(true);
    expect(skills.has("salesforce")).toBe(true);
  });

  it("returns empty map for missing directory", () => {
    const skills = loadSkills("/nonexistent/path/that/does/not/exist");
    expect(skills.size).toBe(0);
  });

  it("skips directories without skill.md", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clawskills-test-noskill-"));
    try {
      fs.mkdirSync(path.join(dir, "nodoc"), { recursive: true });
      const skills = loadSkills(dir);
      expect(skills.size).toBe(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// findSkill
// ---------------------------------------------------------------------------

describe("findSkill", () => {
  let skills: Map<string, string>;

  beforeAll(() => {
    skills = loadSkills(tempDir);
  });

  it("returns key for exact match", () => {
    expect(findSkill(skills, "github")).toBe("github");
  });

  it("is case-insensitive", () => {
    expect(findSkill(skills, "GitHub")).toBe("github");
    expect(findSkill(skills, "GITHUB")).toBe("github");
  });

  it("matches slug-normalized input (hub-spot → hubspot)", () => {
    const m = new Map([["hubspot", "content"]]);
    expect(findSkill(m, "hub-spot")).toBe("hubspot");
  });

  it("matches by prefix", () => {
    expect(findSkill(skills, "git")).toBe("github");
  });

  it("returns undefined for no match", () => {
    expect(findSkill(skills, "zzznomatch")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// extractSection
// ---------------------------------------------------------------------------

describe("extractSection", () => {
  it("resolves alias 'auth' to the correct header", () => {
    const result = extractSection(SAMPLE_CONTENT, "auth");
    expect(result).not.toBeNull();
    expect(result).toContain("Personal Access Token");
  });

  it("finds section by direct header text", () => {
    const result = extractSection(SAMPLE_CONTENT, "Rate limits");
    expect(result).not.toBeNull();
    expect(result).toContain("5000 req/hour");
  });

  it("returns null for missing section", () => {
    const result = extractSection(SAMPLE_CONTENT, "nonexistent-section-xyz");
    expect(result).toBeNull();
  });

  it("stops at the next ## header", () => {
    const result = extractSection(SAMPLE_CONTENT, "Rate limits");
    expect(result).not.toContain("POST /repos");
  });
});

// ---------------------------------------------------------------------------
// searchSkills
// ---------------------------------------------------------------------------

describe("searchSkills", () => {
  let skills: Map<string, string>;

  beforeAll(() => {
    skills = loadSkills(tempDir);
  });

  it("returns results for a matching query", () => {
    const results = searchSkills(skills, "Personal Access Token");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].skill).toBe("github");
    expect(results[0].excerpts.length).toBeGreaterThan(0);
  });

  it("is case-insensitive", () => {
    const results = searchSkills(skills, "personal access token");
    expect(results.length).toBeGreaterThan(0);
  });

  it("returns empty array on no match", () => {
    const results = searchSkills(skills, "zzznomatchquery");
    expect(results).toEqual([]);
  });

  it("caps excerpts at 5 per skill", () => {
    // Create a skill with many matches
    const manyMatches = Array.from({ length: 20 }, (_, i) => `line ${i}: keyword`).join("\n");
    const m = new Map([["test", manyMatches]]);
    const results = searchSkills(m, "keyword");
    expect(results[0].excerpts.length).toBeLessThanOrEqual(5);
  });
});

// ---------------------------------------------------------------------------
// skillSummary
// ---------------------------------------------------------------------------

describe("skillSummary", () => {
  it("skips # headers and returns first non-empty line", () => {
    const summary = skillSummary(SAMPLE_CONTENT);
    expect(summary).toBe("A skill doc for GitHub API.");
  });

  it("handles content that starts with text immediately", () => {
    const summary = skillSummary("Hello world\n## Section");
    expect(summary).toBe("Hello world");
  });

  it("returns empty string for all-header content", () => {
    const summary = skillSummary("# Title\n## Subtitle\n");
    expect(summary).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Real skills validation
// Each skill added to the repo must pass these checks.
// ---------------------------------------------------------------------------

const REQUIRED_SECTIONS = [
  "Authentication & permissions",
  "Reliability: rate limits, retries, idempotency",
  "Error handling & troubleshooting",
  "Common workflows (recipes)",
];

const KNOWN_SKILLS = [
  "asana", "dynamics365", "figma", "github", "hubspot",
  "jira", "monday", "salesforce", "servicenow", "zendesk",
  "slack", "stripe", "notion",
];

describe("real skills", () => {
  let skills: Map<string, string>;

  beforeAll(() => {
    skills = loadSkills(REAL_SKILLS_DIR);
  });

  it("loads all expected skills", () => {
    for (const slug of KNOWN_SKILLS) {
      expect(skills.has(slug), `Missing skill: ${slug}`).toBe(true);
    }
  });

  it("every skill has a non-empty summary line", () => {
    for (const [slug, content] of skills.entries()) {
      const summary = skillSummary(content);
      expect(summary, `${slug}: empty summary`).not.toBe("");
    }
  });

  it("every skill contains the required sections", () => {
    for (const [slug, content] of skills.entries()) {
      for (const section of REQUIRED_SECTIONS) {
        const extracted = extractSection(content, section);
        expect(extracted, `${slug}: missing section "${section}"`).not.toBeNull();
      }
    }
  });

  it("every skill file is at least 5KB", () => {
    for (const [slug, content] of skills.entries()) {
      expect(content.length, `${slug}: suspiciously short skill file`).toBeGreaterThan(5000);
    }
  });
});
