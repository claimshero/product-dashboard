import { Router } from "express";
import fs from "fs";
import path from "path";
import {
  COMPETITORS_DIR,
  BRIEFINGS_DIR,
  MARKET_SIGNALS_DIR,
  PARTNERSHIPS_DIR,
  STRATEGY_DIR,
  INTEL_DIR,
} from "./config.js";

// --- Types ---

export interface CompetitorSummary {
  slug: string;
  name: string;
  category: string;
  threatLevel: string;
  lastUpdated: string;
  signalCount: number;
}

export interface IntelSignal {
  slug: string;
  date: string;
  source: string;
  competitor: string;
  signalType: string;
  relevance: string;
  relatedBets: string[];
  title: string;
}

export interface BriefingSummary {
  date: string;
  signalsCount: number;
  criticalSignals: number;
  sourcesChecked: number;
}

export interface PartnershipSummary {
  slug: string;
  name: string;
  status: string;
  type: string;
  counterpart: string;
  firstContact: string;
  lastUpdated: string;
}

// --- Frontmatter parsing ---

function parseFrontmatter(content: string): { meta: Record<string, string>; body: string } {
  const meta: Record<string, string> = {};
  if (!content.startsWith("---")) return { meta, body: content };

  const endIdx = content.indexOf("---", 3);
  if (endIdx === -1) return { meta, body: content };

  const yamlBlock = content.slice(3, endIdx).trim();
  for (const line of yamlBlock.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();
    // Strip array brackets for simple arrays like [item1, item2]
    if (value.startsWith("[") && value.endsWith("]")) {
      value = value.slice(1, -1).trim();
    }
    meta[key] = value;
  }

  const body = content.slice(endIdx + 3).trim();
  return { meta, body };
}

function extractTitle(body: string): string {
  const h1 = body.split("\n").find((l) => l.startsWith("# "));
  return h1 ? h1.replace(/^#\s+/, "").trim() : "Untitled";
}

function listMdFiles(dir: string): string[] {
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".md") && !f.startsWith("."))
      .sort();
  } catch {
    return [];
  }
}

function listDirs(dir: string): string[] {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("."))
      .map((d) => d.name)
      .sort();
  } catch {
    return [];
  }
}

// --- Router ---

export const intelRouter = Router();

// --- Competitors ---

intelRouter.get("/api/intel/competitors", (_req, res) => {
  try {
    const dirs = listDirs(COMPETITORS_DIR);

    const competitors: CompetitorSummary[] = dirs.map((slug) => {
      const profilePath = path.join(COMPETITORS_DIR, slug, "profile.md");
      let name = slug;
      let category = "";
      let threatLevel = "unknown";
      let lastUpdated = "";

      try {
        const content = fs.readFileSync(profilePath, "utf-8");
        const { meta, body } = parseFrontmatter(content);
        name = meta["name"] || extractTitle(body) || slug;
        category = meta["category"] || "";
        threatLevel = meta["threat-level"] || "unknown";
        lastUpdated = meta["last-updated"] || "";
      } catch {}

      const signalsDir = path.join(COMPETITORS_DIR, slug, "signals");
      const signalCount = listMdFiles(signalsDir).length;

      return { slug, name, category, threatLevel, lastUpdated, signalCount };
    });

    res.json({ competitors });
  } catch (err) {
    console.error("Error listing competitors:", err);
    res.status(500).json({ error: "Failed to list competitors" });
  }
});

intelRouter.get("/api/intel/competitors/:slug/profile", (req, res) => {
  try {
    const { slug } = req.params;
    const resolved = path.resolve(path.join(COMPETITORS_DIR, slug, "profile.md"));
    if (!resolved.startsWith(COMPETITORS_DIR)) {
      res.status(400).json({ error: "Invalid path" });
      return;
    }
    if (!fs.existsSync(resolved)) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    const content = fs.readFileSync(resolved, "utf-8");
    res.json({ content, slug });
  } catch (err) {
    console.error("Error reading competitor profile:", err);
    res.status(500).json({ error: "Failed to read profile" });
  }
});

intelRouter.get("/api/intel/competitors/:slug/signals", (req, res) => {
  try {
    const { slug } = req.params;
    const signalsDir = path.join(COMPETITORS_DIR, slug, "signals");
    const files = listMdFiles(signalsDir);

    const signals: IntelSignal[] = files.map((filename) => {
      const filePath = path.join(signalsDir, filename);
      const content = fs.readFileSync(filePath, "utf-8");
      const { meta, body } = parseFrontmatter(content);
      const title = extractTitle(body);
      const relatedBets = (meta["related-bets"] || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      return {
        slug: filename.replace(/\.md$/, ""),
        date: meta["date"] || "",
        source: meta["source"] || "",
        competitor: meta["competitor"] || slug,
        signalType: meta["signal-type"] || "",
        relevance: meta["relevance"] || "",
        relatedBets,
        title,
      };
    });

    // Most recent first
    signals.sort((a, b) => b.date.localeCompare(a.date));
    res.json({ signals });
  } catch (err) {
    console.error("Error listing competitor signals:", err);
    res.status(500).json({ error: "Failed to list signals" });
  }
});

intelRouter.get("/api/intel/signals/:type/:slug", (req, res) => {
  try {
    const { type, slug } = req.params;

    let filePath: string;
    if (type === "market") {
      filePath = path.resolve(path.join(MARKET_SIGNALS_DIR, `${slug}.md`));
      if (!filePath.startsWith(MARKET_SIGNALS_DIR)) {
        res.status(400).json({ error: "Invalid path" });
        return;
      }
    } else {
      // type is competitor slug
      filePath = path.resolve(path.join(COMPETITORS_DIR, type, "signals", `${slug}.md`));
      if (!filePath.startsWith(COMPETITORS_DIR)) {
        res.status(400).json({ error: "Invalid path" });
        return;
      }
    }

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: "Signal not found" });
      return;
    }

    const content = fs.readFileSync(filePath, "utf-8");
    res.json({ content });
  } catch (err) {
    console.error("Error reading signal:", err);
    res.status(500).json({ error: "Failed to read signal" });
  }
});

// --- Briefings ---

intelRouter.get("/api/intel/briefings", (_req, res) => {
  try {
    const files = listMdFiles(BRIEFINGS_DIR);

    const briefings: BriefingSummary[] = files.map((filename) => {
      const filePath = path.join(BRIEFINGS_DIR, filename);
      const content = fs.readFileSync(filePath, "utf-8");
      const { meta } = parseFrontmatter(content);

      return {
        date: meta["date"] || filename.replace(/\.md$/, ""),
        signalsCount: parseInt(meta["signals-count"] || "0", 10),
        criticalSignals: parseInt(meta["critical-signals"] || "0", 10),
        sourcesChecked: parseInt(meta["sources-checked"] || "0", 10),
      };
    });

    // Most recent first
    briefings.sort((a, b) => b.date.localeCompare(a.date));
    res.json({ briefings });
  } catch (err) {
    console.error("Error listing briefings:", err);
    res.status(500).json({ error: "Failed to list briefings" });
  }
});

intelRouter.get("/api/intel/briefings/:date", (req, res) => {
  try {
    const { date } = req.params;
    const filePath = path.resolve(path.join(BRIEFINGS_DIR, `${date}.md`));
    if (!filePath.startsWith(BRIEFINGS_DIR)) {
      res.status(400).json({ error: "Invalid path" });
      return;
    }
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: "Briefing not found" });
      return;
    }
    const content = fs.readFileSync(filePath, "utf-8");
    res.json({ content, date });
  } catch (err) {
    console.error("Error reading briefing:", err);
    res.status(500).json({ error: "Failed to read briefing" });
  }
});

// --- Partnerships ---

intelRouter.get("/api/intel/partnerships", (_req, res) => {
  try {
    const dirs = listDirs(PARTNERSHIPS_DIR);

    const partnerships: PartnershipSummary[] = dirs.map((slug) => {
      const filePath = path.join(PARTNERSHIPS_DIR, slug, "partnership.md");
      let name = slug;
      let status = "unknown";
      let type = "";
      let counterpart = "";
      let firstContact = "";
      let lastUpdated = "";

      try {
        const content = fs.readFileSync(filePath, "utf-8");
        const { meta, body } = parseFrontmatter(content);
        name = meta["name"] || extractTitle(body) || slug;
        status = meta["status"] || "unknown";
        type = meta["type"] || "";
        counterpart = meta["counterpart"] || "";
        firstContact = meta["first-contact"] || "";
        lastUpdated = meta["last-updated"] || "";
      } catch {}

      return { slug, name, status, type, counterpart, firstContact, lastUpdated };
    });

    res.json({ partnerships });
  } catch (err) {
    console.error("Error listing partnerships:", err);
    res.status(500).json({ error: "Failed to list partnerships" });
  }
});

intelRouter.get("/api/intel/partnerships/:slug", (req, res) => {
  try {
    const { slug } = req.params;
    const resolved = path.resolve(path.join(PARTNERSHIPS_DIR, slug, "partnership.md"));
    if (!resolved.startsWith(PARTNERSHIPS_DIR)) {
      res.status(400).json({ error: "Invalid path" });
      return;
    }
    if (!fs.existsSync(resolved)) {
      res.status(404).json({ error: "Partnership not found" });
      return;
    }
    const content = fs.readFileSync(resolved, "utf-8");
    res.json({ content, slug });
  } catch (err) {
    console.error("Error reading partnership:", err);
    res.status(500).json({ error: "Failed to read partnership" });
  }
});

// --- Strategy docs ---

intelRouter.get("/api/intel/strategy", (_req, res) => {
  try {
    const filePath = path.join(STRATEGY_DIR, "strategic-context-snapshot.md");
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: "Strategic context not found" });
      return;
    }
    const content = fs.readFileSync(filePath, "utf-8");
    res.json({ content });
  } catch (err) {
    console.error("Error reading strategic context:", err);
    res.status(500).json({ error: "Failed to read strategic context" });
  }
});

intelRouter.get("/api/intel/watch-list", (_req, res) => {
  try {
    const filePath = path.join(INTEL_DIR, "watch-list.md");
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: "Watch list not found" });
      return;
    }
    const content = fs.readFileSync(filePath, "utf-8");
    res.json({ content });
  } catch (err) {
    console.error("Error reading watch list:", err);
    res.status(500).json({ error: "Failed to read watch list" });
  }
});

intelRouter.get("/api/intel/sources", (_req, res) => {
  try {
    const filePath = path.join(INTEL_DIR, "sources.md");
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: "Sources not found" });
      return;
    }
    const content = fs.readFileSync(filePath, "utf-8");
    res.json({ content });
  } catch (err) {
    console.error("Error reading sources:", err);
    res.status(500).json({ error: "Failed to read sources" });
  }
});

// --- Market signals ---

intelRouter.get("/api/intel/market-signals", (_req, res) => {
  try {
    const files = listMdFiles(MARKET_SIGNALS_DIR);

    const signals: IntelSignal[] = files.map((filename) => {
      const filePath = path.join(MARKET_SIGNALS_DIR, filename);
      const content = fs.readFileSync(filePath, "utf-8");
      const { meta, body } = parseFrontmatter(content);
      const title = extractTitle(body);
      const relatedBets = (meta["related-bets"] || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      return {
        slug: filename.replace(/\.md$/, ""),
        date: meta["date"] || "",
        source: meta["source"] || "",
        competitor: meta["competitor"] || "market",
        signalType: meta["signal-type"] || "",
        relevance: meta["relevance"] || "",
        relatedBets,
        title,
      };
    });

    signals.sort((a, b) => b.date.localeCompare(a.date));
    res.json({ signals });
  } catch (err) {
    console.error("Error listing market signals:", err);
    res.status(500).json({ error: "Failed to list market signals" });
  }
});

// --- Assessment updates ---

intelRouter.put("/api/intel/competitors/:slug/assessment", (req, res) => {
  try {
    const { slug } = req.params;
    const { assessment } = req.body as { assessment: string };
    if (!assessment || typeof assessment !== "string") {
      res.status(400).json({ error: "assessment is required" });
      return;
    }

    const profilePath = path.resolve(path.join(COMPETITORS_DIR, slug, "profile.md"));
    if (!profilePath.startsWith(COMPETITORS_DIR)) {
      res.status(400).json({ error: "Invalid path" });
      return;
    }
    if (!fs.existsSync(profilePath)) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    let content = fs.readFileSync(profilePath, "utf-8");

    // Replace the Internal Assessment section content
    const sectionRegex = /(## Internal Assessment\n)([\s\S]*?)(\n## |\n---|\Z)/;
    const match = content.match(sectionRegex);

    if (match) {
      const newSection = `${match[1]}\n${assessment}\n\n${match[3]}`;
      content = content.replace(sectionRegex, newSection);
    } else {
      // Append section if it doesn't exist
      content += `\n\n## Internal Assessment\n\n${assessment}\n`;
    }

    fs.writeFileSync(profilePath, content, "utf-8");
    res.json({ ok: true });
  } catch (err) {
    console.error("Error updating assessment:", err);
    res.status(500).json({ error: "Failed to update assessment" });
  }
});
