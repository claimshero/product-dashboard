import { Router } from "express";
import fs from "fs";
import path from "path";
import {
  getAllTasks,
  getCategoryTasks,
  listTaskFiles,
  resolveCategory,
  ensureTaskFile,
  readCategoryFile,
  writeCategoryFile,
  parseTaskFile,
  toggleTaskInFile,
  deleteTaskFromFile,
  updateTaskDescriptionInFile,
  appendTaskToFile,
  cleanTaskText,
} from "./task-files.js";
import { appendCreatedEntry, appendCompletedEntry, parseActivityLog } from "./daily-activity-log.js";

const VAULT_PATH = "/Users/joshroberts/Workspace/Josh Vault";
const DAILY_NOTES_DIR = path.join(VAULT_PATH, "Daily");
const MEETINGS_DIR = path.join(VAULT_PATH, "Daily/meetings");

function formatDate(date: string): string {
  return date.replace(/[^0-9-]/g, "").slice(0, 10);
}

function notePathForDate(date: string): string {
  return path.join(DAILY_NOTES_DIR, `${formatDate(date)}.md`);
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Append an activity log entry to a daily note, creating the note if needed.
 */
function logToDaily(date: string, type: "created" | "completed", category: string, taskText: string): void {
  const filePath = notePathForDate(date);
  if (!fs.existsSync(filePath)) return; // Only log if daily note exists

  const content = fs.readFileSync(filePath, "utf-8");
  const cleaned = cleanTaskText(taskText);
  const updated = type === "created"
    ? appendCreatedEntry(content, category, cleaned)
    : appendCompletedEntry(content, category, cleaned);
  fs.writeFileSync(filePath, updated, "utf-8");
}

export const tasksRouter = Router();

/**
 * GET /api/tasks
 * All tasks across all category files.
 * Query params: status=open|completed|all, category=slug, urgency=high|medium|low
 */
tasksRouter.get("/api/tasks", (req, res) => {
  try {
    let tasks = getAllTasks();

    const { status, category, urgency } = req.query;

    if (status === "open") {
      tasks = tasks.filter((t) => !t.completed);
    } else if (status === "completed") {
      tasks = tasks.filter((t) => t.completed);
    }

    if (category && typeof category === "string") {
      tasks = tasks.filter((t) => t.category === category);
    }

    if (urgency && typeof urgency === "string") {
      tasks = tasks.filter((t) => t.urgency === urgency);
    }

    res.json({ tasks });
  } catch (err) {
    console.error("Error fetching tasks:", err);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

/**
 * GET /api/tasks/categories
 * List all category file names.
 */
tasksRouter.get("/api/tasks/categories", (_req, res) => {
  try {
    const categories = listTaskFiles();
    res.json({ categories });
  } catch (err) {
    console.error("Error listing categories:", err);
    res.status(500).json({ error: "Failed to list categories" });
  }
});

/**
 * GET /api/tasks/category/:category
 * All tasks in a specific category file.
 */
tasksRouter.get("/api/tasks/category/:category", (req, res) => {
  try {
    const tasks = getCategoryTasks(req.params.category);
    res.json({ tasks });
  } catch (err) {
    console.error("Error fetching category tasks:", err);
    res.status(500).json({ error: "Failed to fetch category tasks" });
  }
});

/**
 * POST /api/tasks
 * Create a new task. Server resolves category from metadata.
 * Body: { text, betSlug?, jiraKey?, clientSlug?, partnerSlug?, urgency? }
 */
tasksRouter.post("/api/tasks", (req, res) => {
  try {
    const { text, betSlug, jiraKey, clientSlug, partnerSlug, urgency } = req.body as {
      text: string;
      betSlug?: string;
      jiraKey?: string;
      clientSlug?: string;
      partnerSlug?: string;
      urgency?: string;
    };

    if (!text?.trim()) {
      res.status(400).json({ error: "Task text is required" });
      return;
    }

    const category = resolveCategory({ betSlug, jiraKey, clientSlug, partnerSlug });
    const today = todayStr();

    // Build task line with metadata tags
    let taskLine = text.trim();
    if (betSlug) taskLine += ` [[${betSlug}]]`;
    if (jiraKey) taskLine += ` #${jiraKey}`;
    if (clientSlug) taskLine += ` {{client:${clientSlug}}}`;
    if (partnerSlug) taskLine += ` {{partner:${partnerSlug}}}`;
    if (urgency) taskLine += ` {{urgency:${urgency}}}`;

    ensureTaskFile(category);
    const content = readCategoryFile(category)!;
    const updated = appendTaskToFile(content, taskLine, today);
    writeCategoryFile(category, updated);

    // Log to today's daily note
    logToDaily(today, "created", category, taskLine);

    const tasks = parseTaskFile(updated, category);
    res.json({ tasks, category });
  } catch (err) {
    console.error("Error creating task:", err);
    res.status(500).json({ error: "Failed to create task" });
  }
});

/**
 * PUT /api/tasks/:category/:lineIndex/toggle
 * Toggle a task's completion status.
 */
tasksRouter.put("/api/tasks/:category/:lineIndex/toggle", (req, res) => {
  try {
    const { category } = req.params;
    const lineIndex = parseInt(req.params.lineIndex, 10);

    if (isNaN(lineIndex) || lineIndex < 0) {
      res.status(400).json({ error: "Invalid lineIndex" });
      return;
    }

    const content = readCategoryFile(category);
    if (content === null) {
      res.status(404).json({ error: "Category file not found" });
      return;
    }

    // Get the task before toggling to know its text
    const tasksBefore = parseTaskFile(content, category);
    const taskBefore = tasksBefore.find((t) => t.lineIndex === lineIndex);

    const today = todayStr();
    const updated = toggleTaskInFile(content, lineIndex, today);
    writeCategoryFile(category, updated);

    // Log completion/uncompletion to daily note
    if (taskBefore) {
      const wasCompleted = taskBefore.completed;
      if (!wasCompleted) {
        logToDaily(today, "completed", category, taskBefore.text);
      }
    }

    const tasks = parseTaskFile(updated, category);
    const task = tasks.find((t) => t.lineIndex === lineIndex);
    res.json({ task: task ?? null });
  } catch (err) {
    console.error("Error toggling task:", err);
    res.status(500).json({ error: "Failed to toggle task" });
  }
});

/**
 * PUT /api/tasks/:category/:lineIndex/description
 * Update a task's description.
 */
tasksRouter.put("/api/tasks/:category/:lineIndex/description", (req, res) => {
  try {
    const { category } = req.params;
    const lineIndex = parseInt(req.params.lineIndex, 10);
    const { description } = req.body as { description: string };

    if (isNaN(lineIndex) || lineIndex < 0) {
      res.status(400).json({ error: "Invalid lineIndex" });
      return;
    }

    const content = readCategoryFile(category);
    if (content === null) {
      res.status(404).json({ error: "Category file not found" });
      return;
    }

    const updated = updateTaskDescriptionInFile(content, lineIndex, description ?? "");
    writeCategoryFile(category, updated);

    const tasks = parseTaskFile(updated, category);
    const task = tasks.find((t) => t.lineIndex === lineIndex);
    res.json({ task: task ?? null });
  } catch (err) {
    console.error("Error updating task description:", err);
    res.status(500).json({ error: "Failed to update description" });
  }
});

/**
 * DELETE /api/tasks/:category/:lineIndex
 * Delete a task from a category file.
 */
tasksRouter.delete("/api/tasks/:category/:lineIndex", (req, res) => {
  try {
    const { category } = req.params;
    const lineIndex = parseInt(req.params.lineIndex, 10);

    if (isNaN(lineIndex) || lineIndex < 0) {
      res.status(400).json({ error: "Invalid lineIndex" });
      return;
    }

    const content = readCategoryFile(category);
    if (content === null) {
      res.status(404).json({ error: "Category file not found" });
      return;
    }

    const updated = deleteTaskFromFile(content, lineIndex);
    writeCategoryFile(category, updated);

    const tasks = parseTaskFile(updated, category);
    res.json({ tasks });
  } catch (err) {
    console.error("Error deleting task:", err);
    res.status(500).json({ error: "Failed to delete task" });
  }
});

// --- Daily sections (updated to return activity log instead of tasks) ---

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
 * Parse daily note into structured sections with activity log.
 */
tasksRouter.get("/api/daily-sections/:date", (req, res) => {
  try {
    const date = formatDate(req.params.date);
    const filePath = notePathForDate(date);

    if (!fs.existsSync(filePath)) {
      res.json({ exists: false, focus: [], activity: { created: [], completed: [] }, notes: [] });
      return;
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const sections = parseSections(content);
    const activity = parseActivityLog(content);
    res.json({ exists: true, focus: sections.focus, activity, notes: sections.notes });
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

// --- Meetings (unchanged) ---

/**
 * GET /api/meetings
 * List all meeting notes from Daily/meetings/.
 */
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
