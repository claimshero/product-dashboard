import { Router } from "express";
import fs from "fs";
import path from "path";
import { DAILY_NOTES_DIR, TEMPLATE_PATH } from "./config.js";

function loadTemplate(): string {
  return fs.readFileSync(TEMPLATE_PATH, "utf-8");
}

/** Replace Obsidian template variables like {{date}}, {{time}}, {{title}} */
function applyTemplateVars(template: string, date: string): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  let result = template;
  result = result.replaceAll("{{date}}", date);
  result = result.replaceAll("{{time}}", time);
  result = result.replaceAll("{{title}}", date);
  return result;
}

function formatDate(date: string): string {
  return date.replace(/[^0-9-]/g, "").slice(0, 10);
}

function notePathForDate(date: string): string {
  return path.join(DAILY_NOTES_DIR, `${formatDate(date)}.md`);
}

export const dailyNotesRouter = Router();

// List available daily notes (most recent first)
dailyNotesRouter.get("/api/daily-notes", (_req, res) => {
  try {
    let files: string[] = [];
    try {
      files = fs.readdirSync(DAILY_NOTES_DIR);
    } catch {
      res.json({ notes: [] });
      return;
    }

    const notes = files
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
      .map((f) => f.replace(".md", ""))
      .sort()
      .reverse();

    res.json({ notes });
  } catch (err) {
    console.error("Error listing daily notes:", err);
    res.status(500).json({ error: "Failed to list daily notes" });
  }
});

// Read a specific daily note
dailyNotesRouter.get("/api/daily-notes/:date", (req, res) => {
  try {
    const date = formatDate(req.params.date);
    const filePath = notePathForDate(date);

    if (!fs.existsSync(filePath)) {
      // Return the template content as a preview so the UI can show it
      const template = loadTemplate();
      const templateContent = template
        ? applyTemplateVars(template, date)
        : "";
      res.json({ date, content: "", templateContent, exists: false });
      return;
    }

    const content = fs.readFileSync(filePath, "utf-8");
    res.json({ date, content, exists: true });
  } catch (err) {
    console.error("Error reading daily note:", err);
    res.status(500).json({ error: "Failed to read daily note" });
  }
});

// Create a new daily note from the template
dailyNotesRouter.post("/api/daily-notes/:date", (req, res) => {
  try {
    const date = formatDate(req.params.date);
    const filePath = notePathForDate(date);

    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      res.json({ date, content, exists: true, created: false });
      return;
    }

    const template = loadTemplate();
    const content = template ? applyTemplateVars(template, date) : "";

    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, content, "utf-8");
    res.status(201).json({ date, content, exists: true, created: true });
  } catch (err) {
    console.error("Error creating daily note:", err);
    res.status(500).json({ error: "Failed to create daily note" });
  }
});

// Save/update a daily note
dailyNotesRouter.put("/api/daily-notes/:date", (req, res) => {
  try {
    const date = formatDate(req.params.date);
    const { content } = req.body as { content: string };

    if (typeof content !== "string") {
      res.status(400).json({ error: "content is required" });
      return;
    }

    const filePath = notePathForDate(date);
    const dir = path.dirname(filePath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, content, "utf-8");
    res.json({ date, saved: true });
  } catch (err) {
    console.error("Error saving daily note:", err);
    res.status(500).json({ error: "Failed to save daily note" });
  }
});
