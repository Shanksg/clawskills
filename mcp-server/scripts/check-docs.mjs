import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(__dirname, "..");
const repoDir = path.resolve(packageDir, "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(packageDir, "package.json"), "utf-8"));
const packageVersion = packageJson.version;

const canonicalSkillsDir = path.join(repoDir, "skills");
const skillCount = fs.readdirSync(canonicalSkillsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).length;

const checks = [
  {
    file: path.join(repoDir, "mcp-server/README.md"),
    pattern: /contains \d+ structured Markdown skill docs/,
    expected: `contains ${skillCount} structured Markdown skill docs`,
    label: "MCP README skill count",
  },
  {
    file: path.join(repoDir, "skills/ROADMAP.md"),
    pattern: /\*\*\d+ skill docs\*\*/,
    expected: `**${skillCount} skill docs**`,
    label: "Roadmap skill count",
  },
  {
    file: path.join(repoDir, "skills/ROADMAP.md"),
    pattern: /clawskills-mcp` v\d+\.\d+\.\d+/,
    expected: `clawskills-mcp\` v${packageVersion}`,
    label: "Roadmap package version",
  },
  {
    file: path.join(repoDir, "skills/ROADMAP.md"),
    pattern: /Live — v\d+\.\d+\.\d+/,
    expected: `Live — v${packageVersion}`,
    label: "Roadmap npm version",
  },
];

const failures = [];

for (const check of checks) {
  const content = fs.readFileSync(check.file, "utf-8");
  const match = content.match(check.pattern);

  if (!match) {
    failures.push(`${check.label}: pattern not found in ${path.relative(repoDir, check.file)}`);
    continue;
  }

  if (match[0] !== check.expected) {
    failures.push(
      `${check.label}: expected "${check.expected}" but found "${match[0]}" in ${path.relative(repoDir, check.file)}`
    );
  }
}

if (failures.length > 0) {
  console.error("[check-docs] Documentation consistency check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`[check-docs] Documentation consistency OK for ${skillCount} skills and package ${packageVersion}`);
