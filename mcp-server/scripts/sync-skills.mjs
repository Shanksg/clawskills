import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(__dirname, "..");
const canonicalSkillsDir = path.resolve(packageDir, "../skills");
const bundledSkillsDir = path.resolve(packageDir, "skills");
const canonicalPlaybooksDir = path.resolve(packageDir, "../playbooks");
const bundledPlaybooksDir = path.resolve(packageDir, "playbooks");

if (!fs.existsSync(canonicalSkillsDir)) {
  console.error(`[sync-skills] Canonical skills directory not found: ${canonicalSkillsDir}`);
  process.exit(1);
}

fs.rmSync(bundledSkillsDir, { recursive: true, force: true });
fs.cpSync(canonicalSkillsDir, bundledSkillsDir, { recursive: true });

if (fs.existsSync(canonicalPlaybooksDir)) {
  fs.rmSync(bundledPlaybooksDir, { recursive: true, force: true });
  fs.cpSync(canonicalPlaybooksDir, bundledPlaybooksDir, { recursive: true });
}

const count = fs.readdirSync(bundledSkillsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).length;
const playbookCount = fs.existsSync(bundledPlaybooksDir)
  ? fs.readdirSync(bundledPlaybooksDir, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith(".md")).length - 1
  : 0;
console.log(`[sync-skills] Synced ${count} skills into ${bundledSkillsDir}`);
console.log(`[sync-skills] Synced ${playbookCount} playbooks into ${bundledPlaybooksDir}`);
