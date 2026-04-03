/**
 * Migration script: Move tasks from Daily Notes to category-based Task files.
 *
 * Usage:
 *   npm run migrate:tasks              # Dry run (prints what would happen)
 *   npm run migrate:tasks -- --execute # Actually writes files
 */
import fs from "fs";
import path from "path";
import { resolveCategory, ensureTaskFile } from "./task-files.js";

const VAULT_PATH = "/Users/joshroberts/Workspace/Josh Vault";
const DAILY_DIR = path.join(VAULT_PATH, "Daily");
const TASKS_DIR = path.join(VAULT_PATH, "Tasks");

const TASK_RE = /^- \[([ x])\] (.+)$/;
const BET_LINK_RE = /\[\[([a-z][a-z0-9-]*[a-z0-9])\]\]/;
const JIRA_KEY_RE = /(?:#|\[\[)([A-Z]+-\d+)(?:\]\])?/;
const CLIENT_LINK_RE = /\{\{client:([a-z][a-z0-9-]*[a-z0-9])\}\}/;
const PARTNER_LINK_RE = /\{\{partner:([a-z][a-z0-9-]*[a-z0-9])\}\}/;

interface ParsedTask {
  rawLine: string;
  descriptionLines: string[];
  completed: boolean;
  text: string;
  betSlug: string | null;
  jiraKey: string | null;
  clientSlug: string | null;
  partnerSlug: string | null;
  date: string;
}

function parseDailyTasks(markdown: string, date: string): ParsedTask[] {
  const lines = markdown.split("\n");
  const tasks: ParsedTask[] = [];
  let inTasksSection = false;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    if (/^## Tasks/.test(trimmed)) {
      inTasksSection = true;
      continue;
    }
    if (inTasksSection && /^## /.test(trimmed)) break;
    if (!inTasksSection) continue;

    const match = trimmed.match(TASK_RE);
    if (!match) continue;

    const completed = match[1] === "x";
    const rawText = match[2];

    // Collect description lines
    const descLines: string[] = [];
    for (let j = i + 1; j < lines.length; j++) {
      const raw = lines[j];
      if (/^(?:  |\t)/.test(raw) && !TASK_RE.test(raw.trim())) {
        descLines.push(raw);
      } else {
        break;
      }
    }

    tasks.push({
      rawLine: lines[i],
      descriptionLines: descLines,
      completed,
      text: rawText,
      betSlug: rawText.match(BET_LINK_RE)?.[1] ?? null,
      jiraKey: rawText.match(JIRA_KEY_RE)?.[1] ?? null,
      clientSlug: rawText.match(CLIENT_LINK_RE)?.[1] ?? null,
      partnerSlug: rawText.match(PARTNER_LINK_RE)?.[1] ?? null,
      date,
    });
  }

  return tasks;
}

function cleanTaskTextForLog(text: string): string {
  return text
    .replace(/\[\[[a-z0-9-]+\]\]/g, "")
    .replace(/(?:#|\[\[)[A-Z]+-\d+(?:\]\])?/g, "")
    .replace(/\{\{client:[a-z0-9-]+\}\}/g, "")
    .replace(/\{\{partner:[a-z0-9-]+\}\}/g, "")
    .replace(/\{\{urgency:(high|medium|low)\}\}/g, "")
    .trim();
}

function buildActivityLog(tasks: ParsedTask[]): string {
  const created: string[] = [];
  const completed: string[] = [];

  for (const task of tasks) {
    const category = resolveCategory(task);
    const cleanText = cleanTaskTextForLog(task.text);
    created.push(`- [[Tasks/${category}]] - ${cleanText}`);
    if (task.completed) {
      completed.push(`- [[Tasks/${category}]] - ${cleanText}`);
    }
  }

  const lines: string[] = [];
  lines.push("### Created");
  if (created.length > 0) {
    lines.push(...created);
  }
  lines.push("");
  lines.push("### Completed");
  if (completed.length > 0) {
    lines.push(...completed);
  }

  return lines.join("\n");
}

function replaceDailyTasksSection(markdown: string, newContent: string): string {
  const lines = markdown.split("\n");
  let sectionStart = -1;
  let sectionEnd = lines.length;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (/^## Tasks/.test(trimmed)) {
      sectionStart = i + 1;
      continue;
    }
    if (sectionStart >= 0 && /^## /.test(trimmed)) {
      sectionEnd = i;
      break;
    }
  }

  if (sectionStart < 0) return markdown;

  const before = lines.slice(0, sectionStart);
  const after = lines.slice(sectionEnd);
  return [...before, "", newContent, "", ...after].join("\n");
}

// --- Main ---

const execute = process.argv.includes("--execute");

console.log(execute ? "=== EXECUTING MIGRATION ===" : "=== DRY RUN (use --execute to apply) ===");
console.log();

// 1. Scan daily notes
const files = fs.readdirSync(DAILY_DIR)
  .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
  .sort();

console.log(`Found ${files.length} daily note files`);

// 2. Parse tasks from all daily notes
interface CategoryGroup {
  open: { line: string; descLines: string[]; date: string }[];
  completed: { line: string; descLines: string[]; date: string }[];
}

const categoryGroups = new Map<string, CategoryGroup>();
const dailyUpdates: { file: string; content: string }[] = [];

let totalTasks = 0;

for (const file of files) {
  const date = file.replace(".md", "");
  const filePath = path.join(DAILY_DIR, file);
  const content = fs.readFileSync(filePath, "utf-8");
  const tasks = parseDailyTasks(content, date);

  if (tasks.length === 0) continue;

  totalTasks += tasks.length;

  // Group tasks by category
  for (const task of tasks) {
    const category = resolveCategory(task);

    if (!categoryGroups.has(category)) {
      categoryGroups.set(category, { open: [], completed: [] });
    }

    const group = categoryGroups.get(category)!;
    // Add (created: date) to the task line
    const lineWithDate = task.rawLine.trimEnd() + ` (created: ${task.date})`;
    const entry = { line: lineWithDate, descLines: task.descriptionLines, date: task.date };

    if (task.completed) {
      // Add (completed: date) annotation too
      entry.line += ` (completed: ${task.date})`;
      group.completed.push(entry);
    } else {
      group.open.push(entry);
    }
  }

  // Build new daily note content
  const activityLog = buildActivityLog(tasks);
  const updatedContent = replaceDailyTasksSection(content, activityLog);
  dailyUpdates.push({ file, content: updatedContent });
}

console.log(`Found ${totalTasks} tasks across ${dailyUpdates.length} daily notes`);
console.log(`Resolved to ${categoryGroups.size} categories:`);

for (const [category, group] of categoryGroups) {
  console.log(`  - ${category}: ${group.open.length} open, ${group.completed.length} completed`);
}
console.log();

if (execute) {
  // 3. Backup daily notes
  const backupDir = path.join(DAILY_DIR, `.backup-${Date.now()}`);
  fs.mkdirSync(backupDir, { recursive: true });

  for (const file of files) {
    const src = path.join(DAILY_DIR, file);
    const dest = path.join(backupDir, file);
    fs.copyFileSync(src, dest);
  }
  console.log(`Backed up ${files.length} daily notes to ${backupDir}`);

  // 4. Write category files
  if (!fs.existsSync(TASKS_DIR)) {
    fs.mkdirSync(TASKS_DIR, { recursive: true });
  }

  for (const [category, group] of categoryGroups) {
    ensureTaskFile(category);
    const filePath = path.join(TASKS_DIR, `${category}.md`);

    const heading = category === "general" ? "# General" : `# ${category}`;
    const lines: string[] = [heading, ""];

    // Open tasks
    for (const entry of group.open) {
      lines.push(entry.line);
      lines.push(...entry.descLines);
    }

    // Completed section
    lines.push("", "## Completed");
    for (const entry of group.completed) {
      lines.push(entry.line);
      lines.push(...entry.descLines);
    }

    lines.push(""); // trailing newline
    fs.writeFileSync(filePath, lines.join("\n"), "utf-8");
    console.log(`Wrote ${filePath}`);
  }

  // 5. Update daily notes
  for (const update of dailyUpdates) {
    const filePath = path.join(DAILY_DIR, update.file);
    fs.writeFileSync(filePath, update.content, "utf-8");
  }
  console.log(`Updated ${dailyUpdates.length} daily notes with activity logs`);

  // 6. Update the daily note template
  const templatePath = path.join(VAULT_PATH, "Templates/Daily Rundown.md");
  if (fs.existsSync(templatePath)) {
    const templateContent = fs.readFileSync(templatePath, "utf-8");
    const updatedTemplate = templateContent.replace(
      /## Tasks\n\n- \[ \] /,
      "## Tasks\n### Created\n\n### Completed"
    );
    fs.writeFileSync(templatePath, updatedTemplate, "utf-8");
    console.log("Updated daily note template");
  }

  console.log("\nMigration complete!");
} else {
  console.log("Would create the following category files:");
  for (const [category, group] of categoryGroups) {
    console.log(`  Tasks/${category}.md (${group.open.length} open, ${group.completed.length} completed)`);
  }
  console.log(`Would update ${dailyUpdates.length} daily notes with activity logs`);
  console.log("\nRun with --execute to apply changes.");
}
