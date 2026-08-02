import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { fileURLToPath } from "url";
import {
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
} from "./index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REAL_SKILLS_DIR = path.resolve(__dirname, "../../skills");
const REAL_PLAYBOOKS_DIR = path.resolve(__dirname, "../../playbooks");

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

function makeTempPlaybooksDir(playbooks: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clawskills-playbooks-test-"));
  for (const [slug, content] of Object.entries(playbooks)) {
    fs.writeFileSync(path.join(dir, `${slug}.md`), content, "utf-8");
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
let tempPlaybooksDir: string;

beforeAll(() => {
  tempDir = makeTempSkillsDir({ github: SAMPLE_CONTENT, salesforce: "# Salesforce\nCRM platform.\n## Overview\nSalesforce is a CRM." });
  tempPlaybooksDir = makeTempPlaybooksDir({
    "zendesk-jira": "---\ntitle: Zendesk -> Jira\nsystems:\n  - zendesk\n  - jira\ntags:\n  - support\n  - escalation\ntrigger_type: webhook\n---\n# Zendesk -> Jira\n\nEscalate bugs from support into engineering.\n\n## Idempotency\n\nUse zendesk:{ticket_id}.",
    "hubspot-asana": "---\ntitle: HubSpot -> Asana\nsystems:\n  - hubspot\n  - asana\ntags:\n  - onboarding\n  - handoff\ntrigger_type: webhook\n---\n# HubSpot -> Asana\n\nCreate onboarding work from closed won deals.",
  });
});

afterAll(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
  fs.rmSync(tempPlaybooksDir, { recursive: true, force: true });
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
// Environment and package metadata
// ---------------------------------------------------------------------------

describe("resolveSkillsDir", () => {
  it("prefers the canonical repo-root skills directory", () => {
    expect(path.basename(resolveSkillsDir())).toBe("skills");
    expect(loadSkills(resolveSkillsDir()).has("linear")).toBe(true);
    expect(loadSkills(resolveSkillsDir()).has("stripe")).toBe(true);
  });
});

describe("resolvePlaybooksDir", () => {
  it("prefers the canonical repo-root playbooks directory", () => {
    expect(path.basename(resolvePlaybooksDir())).toBe("playbooks");
    expect(loadPlaybooks(resolvePlaybooksDir()).has("zendesk-jira-bug-escalation")).toBe(true);
  });
});

describe("resolvePackageVersion", () => {
  it("matches package.json", () => {
    const packageJsonPath = path.resolve(__dirname, "../package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8")) as { version: string };
    expect(resolvePackageVersion()).toBe(packageJson.version);
  });
});

// ---------------------------------------------------------------------------
// loadPlaybooks
// ---------------------------------------------------------------------------

describe("loadPlaybooks", () => {
  it("loads markdown files from a directory", () => {
    const playbooks = loadPlaybooks(tempPlaybooksDir);
    expect(playbooks.size).toBe(2);
    expect(playbooks.has("zendesk-jira")).toBe(true);
  });

  it("returns empty map for missing directory", () => {
    const playbooks = loadPlaybooks("/nonexistent/playbooks/path");
    expect(playbooks.size).toBe(0);
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

describe("findPlaybook", () => {
  let playbooks: Map<string, string>;

  beforeAll(() => {
    playbooks = loadPlaybooks(tempPlaybooksDir);
  });

  it("returns key for exact match", () => {
    expect(findPlaybook(playbooks, "zendesk-jira")).toBe("zendesk-jira");
  });

  it("matches normalized input", () => {
    expect(findPlaybook(playbooks, "zendesk jira")).toBe("zendesk-jira");
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
    expect(results[0].name).toBe("github");
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

describe("searchPlaybooks", () => {
  let playbooks: Map<string, string>;

  beforeAll(() => {
    playbooks = loadPlaybooks(tempPlaybooksDir);
  });

  it("returns results for a matching query", () => {
    const results = searchPlaybooks(playbooks, "idempotency");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe("zendesk-jira");
  });
});

describe("getPlaybookMetadata", () => {
  it("parses frontmatter metadata from playbooks", () => {
    const playbooks = loadPlaybooks(tempPlaybooksDir);
    const metadata = getPlaybookMetadata(playbooks.get("zendesk-jira")!);
    expect(metadata.systems).toContain("zendesk");
    expect(metadata.tags).toContain("escalation");
    expect(metadata.triggerType).toBe("webhook");
  });
});

describe("searchClawskills", () => {
  it("prefers playbooks for workflow-shaped queries", () => {
    const skills = new Map([["hubspot", "HubSpot CRM API.\nUse for contacts and deals."]]);
    const playbooks = loadPlaybooks(tempPlaybooksDir);
    const results = searchClawskills(skills, playbooks, "closed won onboarding");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].contentType).toBe("playbook");
    expect(results[0].name).toBe("hubspot-asana");
  });

  it("still returns skill hits for non-workflow queries", () => {
    const skills = loadSkills(tempDir);
    const playbooks = loadPlaybooks(tempPlaybooksDir);
    const results = searchClawskills(skills, playbooks, "Personal Access Token");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((result) => result.contentType === "skill" && result.name === "github")).toBe(true);
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

  it("uses the frontmatter title instead of the --- delimiter", () => {
    const summary = skillSummary("---\ntitle: Slack Incident -> Jira Issue\nsystems:\n  - slack\n---\n\n# Heading\n\nBody text.");
    expect(summary).toBe("Slack Incident -> Jira Issue");
  });

  it("falls through past frontmatter that has no title", () => {
    const summary = skillSummary("---\nsystems:\n  - slack\n---\n\n# Heading\n\nBody text.");
    expect(summary).toBe("Body text.");
  });

  it("strips the blockquote marker from skill headers", () => {
    const summary = skillSummary("# Jira Skill\n\n> **Last validated:** 2026-08-02\n");
    expect(summary).toBe("**Last validated:** 2026-08-02");
  });

  it("gives every real playbook a summary that is not the --- delimiter", () => {
    for (const [slug, content] of loadPlaybooks(REAL_PLAYBOOKS_DIR)) {
      const summary = skillSummary(content);
      expect(summary, `${slug} has no usable summary`).not.toBe("");
      expect(summary, `${slug} summary is the frontmatter delimiter`).not.toBe("---");
    }
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
  "slack", "stripe", "notion", "linear",
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

describe("real playbooks", () => {
  let playbooks: Map<string, string>;

  beforeAll(() => {
    playbooks = loadPlaybooks(REAL_PLAYBOOKS_DIR);
  });

  it("loads all expected playbooks", () => {
    const knownPlaybooks = [
      "hubspot-asana-onboarding",
      "salesforce-hubspot-lead-sync",
      "zendesk-jira-bug-escalation",
    ];

    for (const slug of knownPlaybooks) {
      expect(playbooks.has(slug), `Missing playbook: ${slug}`).toBe(true);
    }
  });

  it("every playbook has a non-empty summary line", () => {
    for (const [slug, content] of playbooks.entries()) {
      const summary = skillSummary(content);
      expect(summary, `${slug}: empty summary`).not.toBe("");
    }
  });
});
