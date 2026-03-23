import { Router } from "express";
import fs from "fs";
import path from "path";
import { parseTasks, toggleTask, deleteTask, appendTasks, updateTaskDescription, type Task } from "./tasks.js";

const VAULT_PATH = "/Users/joshroberts/Workspace/Josh Vault";
const DAILY_NOTES_DIR = path.join(VAULT_PATH, "Daily");

function formatDate(date: string): string {
  return date.replace(/[^0-9-]/g, "").slice(0, 10);
}

function notePathForDate(date: string): string {
  return path.join(DAILY_NOTES_DIR, `${formatDate(date)}.md`);
}

export const tasksRouter = Router();

/**
 * GET /api/tasks/open
 * Scan recent daily notes (last 30 days) for all incomplete tasks.
 */
tasksRouter.get("/api/tasks/open", (_req, res) => {
  try {
    let files: string[] = [];
    try {
      files = fs.readdirSync(DAILY_NOTES_DIR);
    } catch {
      res.json({ tasks: [] });
      return;
    }

    const dateFiles = files
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
      .map((f) => f.replace(".md", ""))
      .sort()
      .reverse();

    // Scan last 30 days worth of notes
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const openTasks: Task[] = [];

    for (const date of dateFiles) {
      if (date < cutoffStr) break;

      const filePath = notePathForDate(date);
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        const tasks = parseTasks(content, date);
        openTasks.push(...tasks.filter((t) => !t.completed));
      } catch {
        // Skip unreadable files
      }
    }

    res.json({ tasks: openTasks });
  } catch (err) {
    console.error("Error fetching open tasks:", err);
    res.status(500).json({ error: "Failed to fetch open tasks" });
  }
});

/**
 * GET /api/tasks/:date
 * Parse all tasks (complete + incomplete) from a single daily note.
 */
tasksRouter.get("/api/tasks/:date", (req, res) => {
  try {
    const date = formatDate(req.params.date);
    const filePath = notePathForDate(date);

    if (!fs.existsSync(filePath)) {
      res.json({ tasks: [] });
      return;
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const tasks = parseTasks(content, date);
    res.json({ tasks });
  } catch (err) {
    console.error("Error fetching tasks:", err);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

/**
 * PUT /api/tasks/:date/:lineIndex/toggle
 * Toggle a task's completion status and write the updated file.
 */
tasksRouter.put("/api/tasks/:date/:lineIndex/toggle", (req, res) => {
  try {
    const date = formatDate(req.params.date);
    const lineIndex = parseInt(req.params.lineIndex, 10);

    if (isNaN(lineIndex) || lineIndex < 0) {
      res.status(400).json({ error: "Invalid lineIndex" });
      return;
    }

    const filePath = notePathForDate(date);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: "Daily note not found" });
      return;
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const updated = toggleTask(content, lineIndex);
    fs.writeFileSync(filePath, updated, "utf-8");

    // Return the updated task
    const tasks = parseTasks(updated, date);
    const task = tasks.find((t) => t.lineIndex === lineIndex);
    res.json({ task: task ?? null });
  } catch (err) {
    console.error("Error toggling task:", err);
    res.status(500).json({ error: "Failed to toggle task" });
  }
});

/**
 * PUT /api/tasks/:date/:lineIndex/description
 * Update a task's description.
 */
tasksRouter.put("/api/tasks/:date/:lineIndex/description", (req, res) => {
  try {
    const date = formatDate(req.params.date);
    const lineIndex = parseInt(req.params.lineIndex, 10);
    const { description } = req.body as { description: string };

    if (isNaN(lineIndex) || lineIndex < 0) {
      res.status(400).json({ error: "Invalid lineIndex" });
      return;
    }

    const filePath = notePathForDate(date);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: "Daily note not found" });
      return;
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const updated = updateTaskDescription(content, lineIndex, description ?? "");
    fs.writeFileSync(filePath, updated, "utf-8");

    const tasks = parseTasks(updated, date);
    const task = tasks.find((t) => t.lineIndex === lineIndex);
    res.json({ task: task ?? null });
  } catch (err) {
    console.error("Error updating task description:", err);
    res.status(500).json({ error: "Failed to update description" });
  }
});

/**
 * DELETE /api/tasks/:date/:lineIndex
 * Delete a task from the daily note.
 */
tasksRouter.delete("/api/tasks/:date/:lineIndex", (req, res) => {
  try {
    const date = formatDate(req.params.date);
    const lineIndex = parseInt(req.params.lineIndex, 10);

    if (isNaN(lineIndex) || lineIndex < 0) {
      res.status(400).json({ error: "Invalid lineIndex" });
      return;
    }

    const filePath = notePathForDate(date);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: "Daily note not found" });
      return;
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const updated = deleteTask(content, lineIndex);
    fs.writeFileSync(filePath, updated, "utf-8");

    const tasks = parseTasks(updated, date);
    res.json({ tasks });
  } catch (err) {
    console.error("Error deleting task:", err);
    res.status(500).json({ error: "Failed to delete task" });
  }
});

/**
 * Parse a daily note into structured sections.
 */
function parseSections(markdown: string): { focus: string[]; notes: string[] } {
  const lines = markdown.split("\n");
  let currentSection = "";
  const focus: string[] = [];
  const notes: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^## Focus/.test(trimmed)) { currentSection = "focus"; continue; }
    if (/^## Tasks/.test(trimmed)) { currentSection = "tasks"; continue; }
    if (/^## Notes/.test(trimmed)) { currentSection = "notes"; continue; }
    if (/^## /.test(trimmed)) { currentSection = ""; continue; }

    if (currentSection === "focus" && trimmed.startsWith("- ") && trimmed.length > 2) {
      focus.push(trimmed.slice(2));
    }
    if (currentSection === "notes" && trimmed.length > 0) {
      notes.push(trimmed);
    }
  }

  return { focus, notes };
}

/**
 * Replace a section's content in the markdown.
 */
function updateSection(markdown: string, section: string, newContent: string): string {
  const lines = markdown.split("\n");
  const heading = `## ${section.charAt(0).toUpperCase() + section.slice(1)}`;
  let sectionStart = -1;
  let sectionEnd = lines.length;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === heading) {
      sectionStart = i + 1;
      continue;
    }
    if (sectionStart >= 0 && /^## /.test(lines[i].trim())) {
      sectionEnd = i;
      break;
    }
  }

  if (sectionStart < 0) return markdown;

  const before = lines.slice(0, sectionStart);
  const after = lines.slice(sectionEnd);
  return [...before, "", newContent, "", ...after].join("\n");
}

/**
 * GET /api/daily-sections/:date
 * Parse daily note into structured sections.
 */
tasksRouter.get("/api/daily-sections/:date", (req, res) => {
  try {
    const date = formatDate(req.params.date);
    const filePath = notePathForDate(date);

    if (!fs.existsSync(filePath)) {
      res.json({ exists: false, focus: [], tasks: [], notes: [] });
      return;
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const sections = parseSections(content);
    const tasks = parseTasks(content, date);
    res.json({ exists: true, focus: sections.focus, tasks, notes: sections.notes });
  } catch (err) {
    console.error("Error parsing daily sections:", err);
    res.status(500).json({ error: "Failed to parse sections" });
  }
});

/**
 * PUT /api/daily-sections/:date/focus
 * Update the Focus section content.
 */
tasksRouter.put("/api/daily-sections/:date/focus", (req, res) => {
  try {
    const date = formatDate(req.params.date);
    const filePath = notePathForDate(date);
    const { items } = req.body as { items: string[] };

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: "Daily note not found" });
      return;
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const focusContent = items.map((item) => `- ${item}`).join("\n");
    const updated = updateSection(content, "focus", focusContent);
    fs.writeFileSync(filePath, updated, "utf-8");
    res.json({ saved: true });
  } catch (err) {
    console.error("Error updating focus:", err);
    res.status(500).json({ error: "Failed to update focus" });
  }
});

/**
 * PUT /api/daily-sections/:date/notes
 * Update the Notes section content.
 */
tasksRouter.put("/api/daily-sections/:date/notes", (req, res) => {
  try {
    const date = formatDate(req.params.date);
    const filePath = notePathForDate(date);
    const { content: notesContent } = req.body as { content: string };

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: "Daily note not found" });
      return;
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const updated = updateSection(content, "notes", notesContent);
    fs.writeFileSync(filePath, updated, "utf-8");
    res.json({ saved: true });
  } catch (err) {
    console.error("Error updating notes:", err);
    res.status(500).json({ error: "Failed to update notes" });
  }
});

/**
 * POST /api/tasks/:date
 * Add a new task to the daily note.
 */
tasksRouter.post("/api/tasks/:date", (req, res) => {
  try {
    const date = formatDate(req.params.date);
    const filePath = notePathForDate(date);
    const { text, betSlug, jiraKey, clientSlug, partnerSlug } = req.body as {
      text: string; betSlug?: string; jiraKey?: string; clientSlug?: string; partnerSlug?: string;
    };

    if (!text?.trim()) {
      res.status(400).json({ error: "Task text is required" });
      return;
    }

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: "Daily note not found" });
      return;
    }

    // Build task line with optional links
    let taskLine = text.trim();
    if (betSlug) taskLine += ` [[${betSlug}]]`;
    if (jiraKey) taskLine += ` #${jiraKey}`;
    if (clientSlug) taskLine += ` {{client:${clientSlug}}}`;
    if (partnerSlug) taskLine += ` {{partner:${partnerSlug}}}`;

    const content = fs.readFileSync(filePath, "utf-8");
    const updated = appendTasks(content, [taskLine]);
    fs.writeFileSync(filePath, updated, "utf-8");

    const tasks = parseTasks(updated, date);
    res.json({ tasks });
  } catch (err) {
    console.error("Error adding task:", err);
    res.status(500).json({ error: "Failed to add task" });
  }
});

/**
 * GET /api/meetings
 * List all meeting notes from Daily/meetings/, grouped by date.
 */
const MEETINGS_DIR = path.join(VAULT_PATH, "Daily/meetings");

tasksRouter.get("/api/meetings", (_req, res) => {
  try {
    if (!fs.existsSync(MEETINGS_DIR)) {
      res.json({ meetings: [] });
      return;
    }

    const files = fs.readdirSync(MEETINGS_DIR)
      .filter((f) => f.endsWith(".md"))
      .sort()
      .reverse();

    const meetings = files.map((f) => {
      const name = f.replace(".md", "");
      // Extract date from filename pattern YYYY-MM-DD-slug
      const dateMatch = name.match(/^(\d{4}-\d{2}-\d{2})-(.+)$/);
      return {
        filename: f,
        name: dateMatch ? dateMatch[2].replace(/-/g, " ") : name,
        date: dateMatch ? dateMatch[1] : "",
        path: f,
      };
    });

    res.json({ meetings });
  } catch (err) {
    console.error("Error listing meetings:", err);
    res.status(500).json({ error: "Failed to list meetings" });
  }
});

/**
 * GET /api/meetings/:filename/content
 * Read a meeting note's content.
 */
tasksRouter.get("/api/meetings/:filename/content", (req, res) => {
  try {
    const filename = req.params.filename;
    const resolved = path.resolve(path.join(MEETINGS_DIR, filename));
    if (!resolved.startsWith(MEETINGS_DIR)) {
      res.status(400).json({ error: "Invalid path" });
      return;
    }

    if (!fs.existsSync(resolved)) {
      res.status(404).json({ error: "Meeting note not found" });
      return;
    }

    const content = fs.readFileSync(resolved, "utf-8");
    res.json({ content, fileName: filename });
  } catch (err) {
    console.error("Error reading meeting note:", err);
    res.status(500).json({ error: "Failed to read meeting note" });
  }
});
