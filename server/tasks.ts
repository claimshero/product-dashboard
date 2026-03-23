export type TaskUrgency = "high" | "medium" | "low" | null;

export interface Task {
  id: string;
  text: string;
  description: string;
  completed: boolean;
  betSlug: string | null;
  jiraKey: string | null;
  clientSlug: string | null;
  partnerSlug: string | null;
  urgency: TaskUrgency;
  date: string;
  lineIndex: number;
}

const TASK_RE = /^- \[([ x])\] (.+)$/;
const BET_LINK_RE = /\[\[([a-z][a-z0-9-]*[a-z0-9])\]\]/; // lowercase slugs only
const JIRA_KEY_RE = /(?:#|\[\[)([A-Z]+-\d+)(?:\]\])?/; // matches #DB-123 or [[MVP-3026]]
const CLIENT_LINK_RE = /\{\{client:([a-z][a-z0-9-]*[a-z0-9])\}\}/;
const PARTNER_LINK_RE = /\{\{partner:([a-z][a-z0-9-]*[a-z0-9])\}\}/;
const URGENCY_RE = /\{\{urgency:(high|medium|low)\}\}/;

/**
 * Parse tasks from the ## Tasks section of a daily note.
 * Returns structured Task objects with extracted metadata.
 */
export function parseTasks(markdown: string, date: string): Task[] {
  const lines = markdown.split("\n");
  const tasks: Task[] = [];

  let inTasksSection = false;
  let taskIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    // Detect ## Tasks heading
    if (/^## Tasks/.test(trimmed)) {
      inTasksSection = true;
      continue;
    }

    // Stop at the next heading
    if (inTasksSection && /^## /.test(trimmed)) {
      break;
    }

    if (!inTasksSection) continue;

    const match = trimmed.match(TASK_RE);
    if (!match) continue;

    const completed = match[1] === "x";
    const rawText = match[2];

    // Collect indented description lines below the task
    const descLines: string[] = [];
    for (let j = i + 1; j < lines.length; j++) {
      const raw = lines[j];
      // Description lines are indented (2+ spaces or tab) and not a new task or heading
      if (/^(?:  |\t)/.test(raw) && !TASK_RE.test(raw.trim())) {
        descLines.push(raw.replace(/^(?:  |\t)/, "").trimEnd());
      } else {
        break;
      }
    }

    const betMatch = rawText.match(BET_LINK_RE);
    const jiraMatch = rawText.match(JIRA_KEY_RE);
    const clientMatch = rawText.match(CLIENT_LINK_RE);
    const partnerMatch = rawText.match(PARTNER_LINK_RE);
    const urgencyMatch = rawText.match(URGENCY_RE);

    tasks.push({
      id: `${date}:${taskIndex}`,
      text: rawText,
      description: descLines.join("\n"),
      completed,
      betSlug: betMatch?.[1] ?? null,
      jiraKey: jiraMatch?.[1] ?? null,
      clientSlug: clientMatch?.[1] ?? null,
      partnerSlug: partnerMatch?.[1] ?? null,
      urgency: (urgencyMatch?.[1] as TaskUrgency) ?? null,
      date,
      lineIndex: taskIndex,
    });

    taskIndex++;
  }

  return tasks;
}

/**
 * Toggle a task's completion status by its index within the ## Tasks section.
 * Returns the updated full markdown string.
 */
export function toggleTask(markdown: string, lineIndex: number): string {
  const lines = markdown.split("\n");
  let inTasksSection = false;
  let taskIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    if (/^## Tasks/.test(trimmed)) {
      inTasksSection = true;
      continue;
    }

    if (inTasksSection && /^## /.test(trimmed)) {
      break;
    }

    if (!inTasksSection) continue;

    if (TASK_RE.test(trimmed)) {
      if (taskIndex === lineIndex) {
        if (lines[i].includes("- [ ] ")) {
          lines[i] = lines[i].replace("- [ ] ", "- [x] ");
        } else {
          lines[i] = lines[i].replace("- [x] ", "- [ ] ");
        }
        return lines.join("\n");
      }
      taskIndex++;
    }
  }

  return markdown;
}

/**
 * Delete a task by its index within the ## Tasks section.
 * Returns the updated full markdown string.
 */
export function deleteTask(markdown: string, lineIndex: number): string {
  const lines = markdown.split("\n");
  let inTasksSection = false;
  let taskIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    if (/^## Tasks/.test(trimmed)) {
      inTasksSection = true;
      continue;
    }

    if (inTasksSection && /^## /.test(trimmed)) {
      break;
    }

    if (!inTasksSection) continue;

    if (TASK_RE.test(trimmed)) {
      if (taskIndex === lineIndex) {
        lines.splice(i, 1);
        return lines.join("\n");
      }
      taskIndex++;
    }
  }

  return markdown;
}

/**
 * Update a task's description by its index within the ## Tasks section.
 * Replaces any existing indented lines below the task, or inserts new ones.
 */
export function updateTaskDescription(markdown: string, lineIndex: number, description: string): string {
  const lines = markdown.split("\n");
  let inTasksSection = false;
  let taskIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    if (/^## Tasks/.test(trimmed)) {
      inTasksSection = true;
      continue;
    }

    if (inTasksSection && /^## /.test(trimmed)) {
      break;
    }

    if (!inTasksSection) continue;

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

        // Insert new description lines (indented with 2 spaces)
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
 * Append new task lines under the ## Tasks heading.
 * If no ## Tasks section exists, creates one before the next heading or at the end.
 */
export function appendTasks(markdown: string, newTasks: string[]): string {
  if (newTasks.length === 0) return markdown;

  const lines = markdown.split("\n");
  let tasksHeadingIndex = -1;
  let insertIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    if (/^## Tasks/.test(trimmed)) {
      tasksHeadingIndex = i;
      continue;
    }

    if (tasksHeadingIndex >= 0 && /^## /.test(trimmed)) {
      // Insert before the next section heading
      insertIndex = i;
      break;
    }
  }

  const taskLines = newTasks.map((t) => (t.startsWith("- [") ? t : `- [ ] ${t}`));

  if (tasksHeadingIndex >= 0) {
    if (insertIndex >= 0) {
      // Insert before next heading
      lines.splice(insertIndex, 0, ...taskLines, "");
    } else {
      // Append at end of file
      lines.push(...taskLines);
    }
  } else {
    // No ## Tasks section — add one
    lines.push("", "## Tasks", ...taskLines);
  }

  return lines.join("\n");
}
