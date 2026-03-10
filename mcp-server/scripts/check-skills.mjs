import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(__dirname, "..");
const canonicalSkillsDir = path.resolve(packageDir, "../skills");
const bundledSkillsDir = path.resolve(packageDir, "skills");
const MAX_AGE_DAYS = 90;

function listSkillSlugs(skillsDir) {
  if (!fs.existsSync(skillsDir)) return [];
  return fs.readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function readSkillContent(skillsDir, slug) {
  return fs.readFileSync(path.join(skillsDir, slug, "skill.md"), "utf-8");
}

function parseLastValidated(content) {
  const match = content.match(/Last validated:\*\*\s*(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}

function daysSince(dateString) {
  const validatedAt = new Date(`${dateString}T00:00:00Z`);
  const now = new Date();
  return Math.floor((now.getTime() - validatedAt.getTime()) / (1000 * 60 * 60 * 24));
}

function checkFreshness() {
  const failures = [];
  const slugs = listSkillSlugs(canonicalSkillsDir);

  for (const slug of slugs) {
    const content = readSkillContent(canonicalSkillsDir, slug);
    const lastValidated = parseLastValidated(content);

    if (!lastValidated) {
      failures.push(`${slug}: missing "Last validated" header`);
      continue;
    }

    const ageDays = daysSince(lastValidated);
    if (ageDays > MAX_AGE_DAYS) {
      failures.push(`${slug}: last validated ${lastValidated} (${ageDays} days old)`);
    }
  }

  if (failures.length === 0) {
    console.log(`[check-skills] Freshness OK for ${slugs.length} skills`);
    return true;
  }

  console.error("[check-skills] Freshness check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  return false;
}

function checkParity() {
  const failures = [];
  const canonicalSlugs = listSkillSlugs(canonicalSkillsDir);
  const bundledSlugs = listSkillSlugs(bundledSkillsDir);

  if (canonicalSlugs.join("\n") !== bundledSlugs.join("\n")) {
    failures.push(
      `skill directory mismatch\n  canonical: ${canonicalSlugs.join(", ")}\n  bundled:   ${bundledSlugs.join(", ")}`
    );
  }

  for (const slug of canonicalSlugs) {
    const bundledSkillPath = path.join(bundledSkillsDir, slug, "skill.md");
    if (!fs.existsSync(bundledSkillPath)) {
      failures.push(`${slug}: missing bundled skill.md`);
      continue;
    }

    const canonicalContent = readSkillContent(canonicalSkillsDir, slug);
    const bundledContent = readSkillContent(bundledSkillsDir, slug);
    if (canonicalContent !== bundledContent) {
      failures.push(`${slug}: bundled skill content differs from canonical source`);
    }
  }

  if (failures.length === 0) {
    console.log(`[check-skills] Parity OK for ${canonicalSlugs.length} skills`);
    return true;
  }

  console.error("[check-skills] Parity check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  return false;
}

const modes = new Set(process.argv.slice(2));
const runFreshness = modes.size === 0 || modes.has("--freshness");
const runParity = modes.size === 0 || modes.has("--parity");

const results = [
  !runFreshness || checkFreshness(),
  !runParity || checkParity(),
];

if (results.every(Boolean)) {
  process.exit(0);
}

process.exit(1);
