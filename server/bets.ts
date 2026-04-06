import { Router } from "express";
import fs from "fs";
import path from "path";
import { BETS_DIR } from "./config.js";

export interface BetSummary {
  slug: string;
  name: string;
  status: string;
  shaper: string;
  jiraGoalUrl: string | null;
  ideaKeys: string[];
  files: {
    notes: string[];
    research: string[];
  };
}

function parseBetMetadata(content: string): {
  name: string;
  status: string;
  shaper: string;
  jiraGoalUrl: string | null;
  ideaKeys: string[];
} {
  const lines = content.split("\n").slice(0, 15);

  let name = "Untitled Bet";
  const h1 = lines.find((l) => l.startsWith("# "));
  if (h1) name = h1.replace(/^#\s+/, "").trim();

  const meta: Record<string, string> = {};
  // Handle both **Label:** value and **Label**: value formats
  const metaRegex = /\*\*(.+?)(?::\*\*|\*\*:)\s*(.+)/;
  for (const line of lines) {
    const match = line.match(metaRegex);
    if (match) {
      // Strip markdown link syntax: [text](url) → url, or [text] → text
      let value = match[2].trim();
      const linkMatch = value.match(/\[.*?\]\((.*?)\)/);
      if (linkMatch) value = linkMatch[1];
      meta[match[1].trim()] = value;
    }
  }

  let jiraGoalUrl: string | null = meta["JIRA Goal"] ?? null;
  if (jiraGoalUrl && (jiraGoalUrl.includes("TODO") || jiraGoalUrl.startsWith("<!--") || jiraGoalUrl === "TBD")) {
    jiraGoalUrl = null;
  }

  // Parse Ideas field: "DB-141, DB-143" → ["DB-141", "DB-143"]
  const ideaKeys: string[] = (meta["Ideas"] ?? "")
    .split(/[,\s]+/)
    .map((k) => k.trim())
    .filter((k) => /^[A-Z]+-\d+$/.test(k));

  return {
    name,
    status: meta["Status"] ?? "Unknown",
    shaper: meta["Shaper"] ?? meta["Shapers"] ?? "Unknown",
    jiraGoalUrl,
    ideaKeys,
  };
}

function listFiles(dir: string): string[] {
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => !f.startsWith("."))
      .sort();
  } catch {
    return [];
  }
}

export const betsRouter = Router();

betsRouter.get("/api/bets", (_req, res) => {
  try {
    const dirs = fs
      .readdirSync(BETS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();

    const bets: BetSummary[] = dirs.map((slug) => {
      const betDir = path.join(BETS_DIR, slug);
      const betMdPath = path.join(betDir, "bet.md");

      let metadata = { name: slug, status: "Unknown", shaper: "Unknown", jiraGoalUrl: null as string | null, ideaKeys: [] as string[] };
      try {
        const content = fs.readFileSync(betMdPath, "utf-8");
        metadata = parseBetMetadata(content);
      } catch {}

      return {
        slug,
        ...metadata,
        files: {
          notes: listFiles(path.join(betDir, "notes")),
          research: listFiles(path.join(betDir, "research")),
        },
      };
    });

    res.json({ bets });
  } catch (err) {
    console.error("Error listing bets:", err);
    res.status(500).json({ error: "Failed to list bets" });
  }
});

const MIME_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

const BINARY_EXTENSIONS = new Set(Object.keys(MIME_TYPES));

betsRouter.get("/api/bets/:slug/content", (req, res) => {
  try {
    const { slug } = req.params;
    const filePath = (req.query.path as string) ?? "bet.md";

    // Prevent directory traversal
    const resolved = path.resolve(path.join(BETS_DIR, slug, filePath));
    if (!resolved.startsWith(path.join(BETS_DIR, slug))) {
      res.status(400).json({ error: "Invalid path" });
      return;
    }

    if (!fs.existsSync(resolved)) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const ext = path.extname(resolved).toLowerCase();

    // Serve binary files (images, PDFs) directly with proper content type
    if (BINARY_EXTENSIONS.has(ext)) {
      const mime = MIME_TYPES[ext] ?? "application/octet-stream";
      res.setHeader("Content-Type", mime);
      res.setHeader("Content-Disposition", "inline");
      fs.createReadStream(resolved).pipe(res);
      return;
    }

    const content = fs.readFileSync(resolved, "utf-8");
    res.json({ content, fileName: path.basename(resolved) });
  } catch (err) {
    console.error("Error reading bet file:", err);
    res.status(500).json({ error: "Failed to read file" });
  }
});
