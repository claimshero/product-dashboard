import type { ActivityEntry, DailyActivity } from "../app/types/tasks.js";

const ACTIVITY_LINK_RE = /^\- \[\[Tasks\/([^\]]+)\]\]\s*[-–—]\s*(.+)$/;

/**
 * Parse the ## Tasks activity log section from a daily note.
 * Expects the format:
 *   ## Tasks
 *   ### Created
 *   - [[Tasks/category]] - Task text
 *   ### Completed
 *   - [[Tasks/category]] - Task text
 */
export function parseActivityLog(markdown: string): DailyActivity {
  const lines = markdown.split("\n");
  const created: ActivityEntry[] = [];
  const completed: ActivityEntry[] = [];

  let inTasksSection = false;
  let currentSub: "created" | "completed" | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    if (/^## Tasks/.test(trimmed)) {
      inTasksSection = true;
      currentSub = null;
      continue;
    }

    // Stop at next ## heading that isn't a sub-section
    if (inTasksSection && /^## [^#]/.test(trimmed) && !/^### /.test(trimmed)) {
      if (!/^## Tasks/.test(trimmed)) break;
    }

    if (inTasksSection && /^### Created/.test(trimmed)) {
      currentSub = "created";
      continue;
    }

    if (inTasksSection && /^### Completed/.test(trimmed)) {
      currentSub = "completed";
      continue;
    }

    if (!inTasksSection || !currentSub) continue;

    const match = trimmed.match(ACTIVITY_LINK_RE);
    if (match) {
      const entry: ActivityEntry = { category: match[1], text: match[2] };
      if (currentSub === "created") {
        created.push(entry);
      } else {
        completed.push(entry);
      }
    }
  }

  return { created, completed };
}

/**
 * Append a "created" entry to the daily note's activity log.
 * Adds under ### Created within ## Tasks.
 */
export function appendCreatedEntry(markdown: string, category: string, taskText: string): string {
  return appendActivityEntry(markdown, "created", category, taskText);
}

/**
 * Append a "completed" entry to the daily note's activity log.
 * Adds under ### Completed within ## Tasks.
 */
export function appendCompletedEntry(markdown: string, category: string, taskText: string): string {
  return appendActivityEntry(markdown, "completed", category, taskText);
}

function appendActivityEntry(
  markdown: string,
  section: "created" | "completed",
  category: string,
  taskText: string,
): string {
  const lines = markdown.split("\n");
  const entry = `- [[Tasks/${category}]] - ${taskText}`;
  const subHeading = section === "created" ? "### Created" : "### Completed";

  let inTasksSection = false;
  let targetSubIndex = -1;
  let insertIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    if (/^## Tasks/.test(trimmed)) {
      inTasksSection = true;
      continue;
    }

    if (inTasksSection && /^## [^#]/.test(trimmed) && !/^### /.test(trimmed)) {
      // Reached next top-level section — insert before it if we found the sub-heading
      if (targetSubIndex >= 0 && insertIndex < 0) {
        insertIndex = i;
      }
      break;
    }

    if (inTasksSection && trimmed === subHeading) {
      targetSubIndex = i;
      continue;
    }

    // If we're past the target sub-heading, track where entries end
    if (targetSubIndex >= 0 && insertIndex < 0) {
      if (/^### /.test(trimmed) || /^## /.test(trimmed)) {
        insertIndex = i;
      }
    }
  }

  if (targetSubIndex >= 0) {
    // Found the sub-heading, insert after last entry in that sub-section
    if (insertIndex < 0) insertIndex = lines.length;
    lines.splice(insertIndex, 0, entry);
  } else if (inTasksSection) {
    // ## Tasks exists but sub-heading is missing — add it
    // Find where to insert (before next ## heading or end of file)
    let tasksEnd = lines.length;
    let foundTasks = false;
    for (let i = 0; i < lines.length; i++) {
      if (/^## Tasks/.test(lines[i].trim())) {
        foundTasks = true;
        continue;
      }
      if (foundTasks && /^## [^#]/.test(lines[i].trim()) && !/^### /.test(lines[i].trim())) {
        tasksEnd = i;
        break;
      }
    }
    lines.splice(tasksEnd, 0, subHeading, entry, "");
  } else {
    // No ## Tasks section — add one
    lines.push("", "## Tasks", subHeading, entry);
  }

  return lines.join("\n");
}
