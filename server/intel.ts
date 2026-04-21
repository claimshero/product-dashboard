import { Router } from "express";
import fs from "fs";
import path from "path";
import { marked } from "marked";
import {
  COMPETITORS_DIR,
  BRIEFINGS_DIR,
  WEEKLY_BRIEFINGS_DIR,
  MARKET_SIGNALS_DIR,
  PARTNERS_DIR,
  STRATEGY_DIR,
  BUSINESS_CONTEXT_DIR,
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

export interface WeeklyBriefingSummary {
  week: string;
  dates: string;
  signalsCount: number;
  criticalSignals: number;
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

// --- Weekly Briefings (must be before :date param route) ---

intelRouter.get("/api/intel/briefings/weekly", (_req, res) => {
  try {
    const files = listMdFiles(WEEKLY_BRIEFINGS_DIR);

    const briefings: WeeklyBriefingSummary[] = files.map((filename) => {
      const filePath = path.join(WEEKLY_BRIEFINGS_DIR, filename);
      const content = fs.readFileSync(filePath, "utf-8");
      const { meta } = parseFrontmatter(content);

      return {
        week: meta["week"] || filename.replace(/\.md$/, ""),
        dates: meta["dates"] || "",
        signalsCount: parseInt(meta["signals-count"] || "0", 10),
        criticalSignals: parseInt(meta["critical-signals"] || "0", 10),
      };
    });

    briefings.sort((a, b) => b.week.localeCompare(a.week));
    res.json({ briefings });
  } catch (err) {
    console.error("Error listing weekly briefings:", err);
    res.status(500).json({ error: "Failed to list weekly briefings" });
  }
});

intelRouter.get("/api/intel/briefings/weekly/:week", (req, res) => {
  try {
    const { week } = req.params;
    const filePath = path.resolve(path.join(WEEKLY_BRIEFINGS_DIR, `${week}.md`));
    if (!filePath.startsWith(WEEKLY_BRIEFINGS_DIR)) {
      res.status(400).json({ error: "Invalid path" });
      return;
    }
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: "Weekly briefing not found" });
      return;
    }
    const content = fs.readFileSync(filePath, "utf-8");
    res.json({ content, week });
  } catch (err) {
    console.error("Error reading weekly briefing:", err);
    res.status(500).json({ error: "Failed to read weekly briefing" });
  }
});

// --- Weekly Briefing HTML version ---

intelRouter.get("/api/intel/briefings/weekly/:week/html", (req, res) => {
  try {
    const { week } = req.params;
    const filePath = path.resolve(path.join(WEEKLY_BRIEFINGS_DIR, `${week}.html`));
    if (!filePath.startsWith(WEEKLY_BRIEFINGS_DIR)) {
      res.status(400).json({ error: "Invalid path" });
      return;
    }
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: "HTML briefing not found" });
      return;
    }
    const html = fs.readFileSync(filePath, "utf-8");
    res.type("html").send(html);
  } catch (err) {
    console.error("Error reading weekly briefing HTML:", err);
    res.status(500).json({ error: "Failed to read weekly briefing HTML" });
  }
});

// --- Daily Briefing by date (after /weekly to avoid param collision) ---

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
    const dirs = listDirs(PARTNERS_DIR);

    const partnerships: PartnershipSummary[] = dirs.map((slug) => {
      const filePath = path.join(PARTNERS_DIR, slug, "partner.md");
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
    const resolved = path.resolve(path.join(PARTNERS_DIR, slug, "partner.md"));
    if (!resolved.startsWith(PARTNERS_DIR)) {
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
    const filePath = path.join(BUSINESS_CONTEXT_DIR, "watch-list.md");
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
    const filePath = path.join(BUSINESS_CONTEXT_DIR, "sources.md");
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

// --- PDF Export ---

const EXPORT_HTML_TEMPLATE = (title: string, bodyHtml: string) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} — Export</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
  :root {
    --primary: #1B2A4A;
    --accent: #3B82F6;
    --text: #1B2A4A;
    --text-secondary: #64748B;
    --border: #E2E8F0;
    --bg: #FFFFFF;
    --code-bg: #F1F5F9;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    color: var(--text); line-height: 1.7; background: var(--bg);
    max-width: 900px; margin: 0 auto; padding: 40px 32px;
  }
  .export-header {
    display: flex; align-items: center; justify-content: space-between;
    padding-bottom: 16px; margin-bottom: 24px;
    border-bottom: 3px solid var(--primary);
  }
  .export-header h1 { font-size: 20px; font-weight: 800; color: var(--primary); }
  .export-header .meta { font-size: 12px; color: var(--text-secondary); text-align: right; }
  .export-header .brand {
    display: inline-block; padding: 4px 12px; border-radius: 16px;
    background: var(--primary); color: white; font-size: 11px; font-weight: 700;
    letter-spacing: 0.3px; margin-bottom: 4px;
  }
  .export-actions { display: flex; gap: 8px; margin-bottom: 24px; }
  .export-actions button {
    padding: 8px 20px; border-radius: 6px; font-size: 13px; font-weight: 600;
    cursor: pointer; border: 1px solid var(--border); background: var(--primary);
    color: white; font-family: inherit;
  }
  .export-actions button:hover { opacity: 0.9; }
  .export-actions button.secondary { background: white; color: var(--text); }
  @media print {
    .export-actions { display: none; }
    .export-header .meta .no-print { display: none; }
    body { padding: 20px; }
  }
  /* Markdown content styles */
  h1 { font-size: 24px; font-weight: 800; margin: 32px 0 12px; color: var(--primary); }
  h2 { font-size: 20px; font-weight: 700; margin: 28px 0 10px; color: var(--primary); padding-bottom: 6px; border-bottom: 2px solid var(--border); }
  h3 { font-size: 16px; font-weight: 700; margin: 20px 0 8px; color: var(--primary); }
  h4 { font-size: 14px; font-weight: 600; margin: 16px 0 6px; }
  p { margin: 8px 0; font-size: 14px; }
  ul, ol { margin: 8px 0 8px 24px; font-size: 14px; }
  li { margin-bottom: 4px; }
  strong { font-weight: 700; }
  code {
    font-family: 'SF Mono', 'Fira Code', monospace; font-size: 12px;
    background: var(--code-bg); padding: 2px 6px; border-radius: 4px;
  }
  pre { background: var(--code-bg); padding: 16px; border-radius: 8px; overflow-x: auto; margin: 12px 0; }
  pre code { background: none; padding: 0; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
  th { text-align: left; padding: 10px 12px; background: var(--primary); color: white; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; }
  th:first-child { border-radius: 6px 0 0 0; }
  th:last-child { border-radius: 0 6px 0 0; }
  td { padding: 10px 12px; border-bottom: 1px solid var(--border); }
  tr:nth-child(even) { background: #F8FAFC; }
  blockquote { border-left: 3px solid var(--accent); padding-left: 16px; margin: 12px 0; color: var(--text-secondary); }
  hr { border: none; border-top: 2px solid var(--border); margin: 24px 0; }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
</style>
</head>
<body>
  <div class="export-header">
    <div>
      <h1>${title}</h1>
    </div>
    <div class="meta">
      <span class="brand">CLAIMABLE</span><br>
      <span class="no-print">Exported ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
    </div>
  </div>
  <div class="export-actions">
    <button onclick="window.print()">Download PDF</button>
    <button class="secondary" onclick="window.close()">Close</button>
  </div>
  <div class="content">
    ${bodyHtml}
  </div>
</body>
</html>`;

/** Resolves an export type + identifier to a file path and title */
function resolveExportPath(type: string, id: string): { filePath: string; title: string; isHtml: boolean } | null {
  switch (type) {
    case "briefing":
      return { filePath: path.join(BRIEFINGS_DIR, `${id}.md`), title: `Daily Briefing — ${id}`, isHtml: false };
    case "weekly-briefing":
      return { filePath: path.join(WEEKLY_BRIEFINGS_DIR, `${id}.md`), title: `Weekly Briefing — ${id}`, isHtml: false };
    case "weekly-briefing-html": {
      const htmlPath = path.join(WEEKLY_BRIEFINGS_DIR, `${id}.html`);
      if (fs.existsSync(htmlPath)) {
        return { filePath: htmlPath, title: `Weekly Briefing — ${id}`, isHtml: true };
      }
      return { filePath: path.join(WEEKLY_BRIEFINGS_DIR, `${id}.md`), title: `Weekly Briefing — ${id}`, isHtml: false };
    }
    case "competitor":
      return { filePath: path.join(COMPETITORS_DIR, id, "profile.md"), title: `Competitor Profile — ${id}`, isHtml: false };
    case "competitor-signal": {
      // id format: "compSlug--signalSlug" (double dash separator to avoid path issues)
      const sepIdx = id.indexOf("--");
      if (sepIdx === -1) return null;
      const compSlug = id.slice(0, sepIdx);
      const signalSlug = id.slice(sepIdx + 2);
      return { filePath: path.join(COMPETITORS_DIR, compSlug, "signals", `${signalSlug}.md`), title: `Signal — ${signalSlug}`, isHtml: false };
    }
    case "market-signal":
      return { filePath: path.join(MARKET_SIGNALS_DIR, `${id}.md`), title: `Market Signal — ${id}`, isHtml: false };
    case "partnership":
      return { filePath: path.join(PARTNERS_DIR, id, "partner.md"), title: `Partnership — ${id}`, isHtml: false };
    case "strategy":
      return { filePath: path.join(STRATEGY_DIR, `${id}.md`), title: `Strategy — ${id}`, isHtml: false };
    case "watch-list":
      return { filePath: path.join(BUSINESS_CONTEXT_DIR, "watch-list.md"), title: "Watch List", isHtml: false };
    case "sources":
      return { filePath: path.join(BUSINESS_CONTEXT_DIR, "sources.md"), title: "Sources & Queries", isHtml: false };
    default:
      return null;
  }
}

intelRouter.get("/api/intel/export/:type/:id", (req, res) => {
  try {
    const { type, id } = req.params;
    const resolved = resolveExportPath(type, id);

    if (!resolved) {
      res.status(400).json({ error: `Unknown export type: ${type}` });
      return;
    }

    const filePath = path.resolve(resolved.filePath);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const raw = fs.readFileSync(filePath, "utf-8");

    if (resolved.isHtml) {
      // For HTML files, inject a print button bar at the top and serve directly
      const printBar = `<div style="display:flex;gap:8px;margin-bottom:20px;font-family:Inter,sans-serif;">
        <button onclick="window.print()" style="padding:8px 20px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;border:1px solid #E2E8F0;background:#1B2A4A;color:white;font-family:inherit;">Download PDF</button>
        <button onclick="window.close()" style="padding:8px 20px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;border:1px solid #E2E8F0;background:white;color:#1B2A4A;font-family:inherit;">Close</button>
      </div>`;
      const styled = raw.replace(
        /<div class="page">/,
        `<div class="page"><style>@media print { .export-print-bar { display: none !important; } }</style><div class="export-print-bar">${printBar}</div>`
      );
      res.type("html").send(styled);
      return;
    }

    // Strip YAML frontmatter
    const stripped = raw.replace(/^---[\s\S]*?---\n*/, "");
    const bodyHtml = marked.parse(stripped) as string;
    const html = EXPORT_HTML_TEMPLATE(resolved.title, bodyHtml);
    res.type("html").send(html);
  } catch (err) {
    console.error("Error exporting:", err);
    res.status(500).json({ error: "Export failed" });
  }
});
