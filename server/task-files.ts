import fs from "fs";
import path from "path";
import type { Task, TaskUrgency } from "../app/types/tasks.js";
import { TASKS_DIR } from "./config.js";

const TASK_RE = /^- \[([ x])\] (.+)$/;
const BET_LINK_RE = /\[\[([a-z][a-z0-9-]*[a-z0-9])\]\]/;
const JIRA_KEY_RE = /(?:#|\[\[)([A-Z]+-\d+)(?:\]\])?/;
const CLIENT_LINK_RE = /\{\{client:([a-z][a-z0-9-]*[a-z0-9])\}\}/;
const PARTNER_LINK_RE = /\{\{partner:([a-z][a-z0-9-]*[a-z0-9])\}\}/;
const URGENCY_RE = /\{\{urgency:(high|medium|low)\}\}/;
const CREATED_RE = /\(created: (\d{4}-\d{2}-\d{2})\)/;
const COMPLETED_RE = /\(completed: (\d{4}-\d{2}-\d{2})\)/;

/**
 * Determine which category file a task belongs to.
 * Priority: bet > jira > client > partner > general
 */
export function resolveCategory(opts: {
  betSlug?: string | null;
  jiraKey?: string | null;
  clientSlug?: string | null;
  partnerSlug?: string | null;
}): string {
  if (opts.betSlug) return opts.betSlug;
  if (opts.jiraKey) return opts.jiraKey;
  if (opts.clientSlug) return opts.clientSlug;
  if (opts.partnerSlug) return opts.partnerSlug;
  return "general";
}

function taskFilePath(category: string): string {
  return path.join(TASKS_DIR, `${category}.md`);
}

/**
 * Ensure the Tasks directory and category file exist.
 * Returns the file path.
 */
export function ensureTaskFile(category: string): string {
  if (!fs.existsSync(TASKS_DIR)) {
    fs.mkdirSync(TASKS_DIR, { recursive: true });
  }

  const filePath = taskFilePath(category);
  if (!fs.existsSync(filePath)) {
    const heading = category === "general" ? "# General" : `# ${category}`;
    fs.writeFileSync(filePath, `${heading}\n\n## Completed\n`, "utf-8");
  }
  return filePath;
}

/**
 * Extract metadata from a raw task text line.
 */
function extractMetadata(rawText: string) {
  const betMatch = rawText.match(BET_LINK_RE);
  const jiraMatch = rawText.match(JIRA_KEY_RE);
  const clientMatch = rawText.match(CLIENT_LINK_RE);
  const partnerMatch = rawText.match(PARTNER_LINK_RE);
  const urgencyMatch = rawText.match(URGENCY_RE);
  const createdMatch = rawText.match(CREATED_RE);
  const completedMatch = rawText.match(COMPLETED_RE);

  return {
    betSlug: betMatch?.[1] ?? null,
    jiraKey: jiraMatch?.[1] ?? null,
    clientSlug: clientMatch?.[1] ?? null,
    partnerSlug: partnerMatch?.[1] ?? null,
    urgency: (urgencyMatch?.[1] as TaskUrgency) ?? null,
    createdDate: createdMatch?.[1] ?? "",
    completedDate: completedMatch?.[1] ?? null,
  };
}

/**
 * Parse all tasks from a category file.
 * Open tasks come before ## Completed, completed tasks after.
 */
export function parseTaskFile(markdown: string, category: string): Task[] {
  const lines = markdown.split("\n");
  const tasks: Task[] = [];
  let inCompleted = false;
  let taskIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    // Detect ## Completed heading
    if (/^## Completed/.test(trimmed)) {
      inCompleted = true;
      continue;
    }

    // Skip the file heading
    if (/^# /.test(trimmed)) continue;

    const match = trimmed.match(TASK_RE);
    if (!match) continue;

    const completed = match[1] === "x";
    const rawText = match[2];

    // Collect indented description lines
    const descLines: string[] = [];
    for (let j = i + 1; j < lines.length; j++) {
      const raw = lines[j];
      if (/^(?:  |\t)/.test(raw) && !TASK_RE.test(raw.trim())) {
        descLines.push(raw.replace(/^(?:  |\t)/, "").trimEnd());
      } else {
        break;
      }
    }

    const meta = extractMetadata(rawText);

    tasks.push({
      id: `${category}:${taskIndex}`,
      text: rawText,
      description: descLines.join("\n"),
      completed: inCompleted ? true : completed,
      betSlug: meta.betSlug,
      jiraKey: meta.jiraKey,
      clientSlug: meta.clientSlug,
      partnerSlug: meta.partnerSlug,
      urgency: meta.urgency,
      category,
      createdDate: meta.createdDate,
      completedDate: meta.completedDate,
      lineIndex: taskIndex,
    });

    taskIndex++;
  }

  return tasks;
}

/**
 * Toggle a task's completion status.
 * When completing: moves task to ## Completed section with (completed: date).
 * When uncompleting: moves task back to the open section, removes (completed: date).
 */
export function toggleTaskInFile(markdown: string, lineIndex: number, todayDate: string): string {
  const lines = markdown.split("\n");
  let taskIndex = 0;
  let completedHeadingLine = -1;

  // Find the ## Completed heading
  for (let i = 0; i < lines.length; i++) {
    if (/^## Completed/.test(lines[i].trim())) {
      completedHeadingLine = i;
      break;
    }
  }

  // Find the target task
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (/^# /.test(trimmed) || /^## /.test(trimmed)) continue;

    if (TASK_RE.test(trimmed)) {
      if (taskIndex === lineIndex) {
        const isCompleted = lines[i].includes("- [x] ");

        if (isCompleted) {
          // Uncompleting: move to open section, remove (completed: ...) annotation
          let taskLine = lines[i].replace("- [x] ", "- [ ] ");
          taskLine = taskLine.replace(/\s*\(completed: \d{4}-\d{2}-\d{2}\)/, "");

          // Collect description lines
          const descLines: string[] = [];
          let j = i + 1;
          while (j < lines.length && /^(?:  |\t)/.test(lines[j]) && !TASK_RE.test(lines[j].trim())) {
            descLines.push(lines[j]);
            j++;
          }

          // Remove from current position
          lines.splice(i, 1 + descLines.length);

          // Insert before ## Completed (or at end of open section)
          const insertAt = completedHeadingLine >= 0
            ? (i < completedHeadingLine ? completedHeadingLine - 1 - descLines.length : completedHeadingLine)
            : lines.length;
          // Adjust if we removed lines before the heading
          const adjustedInsertAt = i < insertAt ? insertAt : insertAt;
          lines.splice(adjustedInsertAt, 0, taskLine, ...descLines);
        } else {
          // Completing: move to ## Completed section, add (completed: date)
          let taskLine = lines[i].replace("- [ ] ", "- [x] ");
          taskLine += ` (completed: ${todayDate})`;

          // Collect description lines
          const descLines: string[] = [];
          let j = i + 1;
          while (j < lines.length && /^(?:  |\t)/.test(lines[j]) && !TASK_RE.test(lines[j].trim())) {
            descLines.push(lines[j]);
            j++;
          }

          // Remove from current position
          lines.splice(i, 1 + descLines.length);

          // Ensure ## Completed exists
          let insertAt: number;
          if (completedHeadingLine >= 0) {
            // Adjust heading position if we removed lines before it
            const adjustedHeading = i < completedHeadingLine
              ? completedHeadingLine - (1 + descLines.length)
              : completedHeadingLine;
            insertAt = adjustedHeading + 1;
          } else {
            lines.push("", "## Completed");
            insertAt = lines.length;
          }

          lines.splice(insertAt, 0, taskLine, ...descLines);
        }

        return lines.join("\n");
      }
      taskIndex++;
    }
  }

  return markdown;
}

/**
 * Delete a task by its line index.
 */
export function deleteTaskFromFile(markdown: string, lineIndex: number): string {
  const lines = markdown.split("\n");
  let taskIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (/^# /.test(trimmed) || /^## /.test(trimmed)) continue;

    if (TASK_RE.test(trimmed)) {
      if (taskIndex === lineIndex) {
        // Count description lines
        let descCount = 0;
        for (let j = i + 1; j < lines.length; j++) {
          if (/^(?:  |\t)/.test(lines[j]) && !TASK_RE.test(lines[j].trim())) {
            descCount++;
          } else {
            break;
          }
        }
        lines.splice(i, 1 + descCount);
        return lines.join("\n");
      }
      taskIndex++;
    }
  }

  return markdown;
}

/**
 * Update a task's description by its line index.
 */
export function updateTaskDescriptionInFile(markdown: string, lineIndex: number, description: string): string {
  const lines = markdown.split("\n");
  let taskIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (/^# /.test(trimmed) || /^## /.test(trimmed)) continue;

    if (TASK_RE.test(trimmed)) {
      if (taskIndex === lineIndex) {
        // Remove existing description lines
        let removeCount = 0;
        for (let j = i + 1; j < lines.length; j++) {
          if (/^(?:  |\t)/.test(lines[j]) && !TASK_RE.test(lines[j].trim())) {
            removeCount++;
          } else {
            break;
          }
        }
        lines.splice(i + 1, removeCount);

        // Insert new description lines
        if (description.trim()) {
          const descLines = description.split("\n").map((l) => `  ${l}`);
          lines.splice(i + 1, 0, ...descLines);
        }

        return lines.join("\n");
      }
      taskIndex++;
    }
  }

  return markdown;
}

/**
 * Append a new task to the open section (before ## Completed).
 */
export function appendTaskToFile(markdown: string, taskText: string, createdDate: string): string {
  const lines = markdown.split("\n");

  const taskLine = taskText.startsWith("- [")
    ? `${taskText} (created: ${createdDate})`
    : `- [ ] ${taskText} (created: ${createdDate})`;

  // Find ## Completed heading
  for (let i = 0; i < lines.length; i++) {
    if (/^## Completed/.test(lines[i].trim())) {
      // Insert before ## Completed, with a blank line before it
      lines.splice(i, 0, taskLine, "");
      return lines.join("\n");
    }
  }

  // No ## Completed heading — append at end
  lines.push(taskLine);
  return lines.join("\n");
}

/**
 * List all category file names (without .md extension).
 */
export function listTaskFiles(): string[] {
  if (!fs.existsSync(TASKS_DIR)) return [];

  return fs.readdirSync(TASKS_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(".md", ""))
    .sort();
}

/**
 * Get all tasks across all category files.
 */
export function getAllTasks(): Task[] {
  const categories = listTaskFiles();
  const allTasks: Task[] = [];

  for (const category of categories) {
    const filePath = taskFilePath(category);
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      allTasks.push(...parseTaskFile(content, category));
    } catch {
      // Skip unreadable files
    }
  }

  return allTasks;
}

/**
 * Get all open (incomplete) tasks across all category files.
 */
export function getOpenTasks(): Task[] {
  return getAllTasks().filter((t) => !t.completed);
}

/**
 * Read and parse a specific category file.
 */
export function getCategoryTasks(category: string): Task[] {
  const filePath = taskFilePath(category);
  if (!fs.existsSync(filePath)) return [];

  const content = fs.readFileSync(filePath, "utf-8");
  return parseTaskFile(content, category);
}

/**
 * Read raw markdown for a category file.
 */
export function readCategoryFile(category: string): string | null {
  const filePath = taskFilePath(category);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, "utf-8");
}

/**
 * Write markdown back to a category file.
 */
export function writeCategoryFile(category: string, content: string): void {
  ensureTaskFile(category);
  const filePath = taskFilePath(category);
  fs.writeFileSync(filePath, content, "utf-8");
}

/**
 * Clean task text for display by removing metadata and date annotations.
 */
export function cleanTaskText(text: string): string {
  return text
    .replace(/\[\[[a-z0-9-]+\]\]/g, "")
    .replace(/(?:#|\[\[)[A-Z]+-\d+(?:\]\])?/g, "")
    .replace(/\{\{client:[a-z0-9-]+\}\}/g, "")
    .replace(/\{\{partner:[a-z0-9-]+\}\}/g, "")
    .replace(/\{\{urgency:(high|medium|low)\}\}/g, "")
    .replace(/\(created: \d{4}-\d{2}-\d{2}\)/g, "")
    .replace(/\(completed: \d{4}-\d{2}-\d{2}\)/g, "")
    .trim();
}
