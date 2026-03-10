import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(__dirname, "..");
const canonicalSkillsDir = path.resolve(packageDir, "../skills");
const bundledSkillsDir = path.resolve(packageDir, "skills");

if (!fs.existsSync(canonicalSkillsDir)) {
  console.error(`[sync-skills] Canonical skills directory not found: ${canonicalSkillsDir}`);
  process.exit(1);
}

fs.rmSync(bundledSkillsDir, { recursive: true, force: true });
fs.cpSync(canonicalSkillsDir, bundledSkillsDir, { recursive: true });

const count = fs.readdirSync(bundledSkillsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).length;
console.log(`[sync-skills] Synced ${count} skills into ${bundledSkillsDir}`);
