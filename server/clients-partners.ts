import { Router } from "express";
import fs from "fs";
import path from "path";
import { CLIENTS_DIR, PARTNERS_DIR } from "./config.js";

export interface ClientPartnerSummary {
  slug: string;
  name: string;
  kind: "client" | "partner";
  contact: string;
  business: string;
  interest: string;
  relationship: string;
  files: {
    notes: string[];
  };
}

function parseMetadata(content: string): {
  name: string;
  contact: string;
  business: string;
  interest: string;
  relationship: string;
} {
  const lines = content.split("\n").slice(0, 20);

  let name = "Untitled";
  const h1 = lines.find((l) => l.startsWith("# "));
  if (h1) name = h1.replace(/^#\s+/, "").trim();

  const meta: Record<string, string> = {};
  const metaRegex = /\*\*(.+?)(?::\*\*|\*\*:)\s*(.+)/;
  for (const line of lines) {
    const match = line.match(metaRegex);
    if (match) {
      meta[match[1].trim()] = match[2].trim();
    }
  }

  return {
    name,
    contact: meta["Contact"] ?? "",
    business: meta["Business"] ?? "",
    interest: meta["Interest"] ?? "",
    relationship: meta["Relationship"] ?? "Unknown",
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

function listEntities(dir: string, kind: "client" | "partner"): ClientPartnerSummary[] {
  try {
    if (!fs.existsSync(dir)) return [];

    const dirs = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();

    return dirs.map((slug) => {
      const entityDir = path.join(dir, slug);
      const mdFile = kind === "client" ? "client.md" : "partner.md";
      const mdPath = path.join(entityDir, mdFile);

      let metadata = { name: slug, contact: "", business: "", interest: "", relationship: "Unknown" };
      try {
        const content = fs.readFileSync(mdPath, "utf-8");
        metadata = parseMetadata(content);
      } catch {}

      return {
        slug,
        ...metadata,
        kind,
        files: {
          notes: listFiles(path.join(entityDir, "notes")),
        },
      };
    });
  } catch {
    return [];
  }
}

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

function serveContent(baseDir: string, slug: string, filePath: string, res: any) {
  const resolved = path.resolve(path.join(baseDir, slug, filePath));
  if (!resolved.startsWith(path.join(baseDir, slug))) {
    res.status(400).json({ error: "Invalid path" });
    return;
  }

  if (!fs.existsSync(resolved)) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  const ext = path.extname(resolved).toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) {
    const mime = MIME_TYPES[ext] ?? "application/octet-stream";
    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Disposition", "inline");
    fs.createReadStream(resolved).pipe(res);
    return;
  }

  const content = fs.readFileSync(resolved, "utf-8");
  res.json({ content, fileName: path.basename(resolved) });
}

export const clientsPartnersRouter = Router();

clientsPartnersRouter.get("/api/clients", (_req, res) => {
  try {
    const clients = listEntities(CLIENTS_DIR, "client");
    res.json({ clients });
  } catch (err) {
    console.error("Error listing clients:", err);
    res.status(500).json({ error: "Failed to list clients" });
  }
});

clientsPartnersRouter.get("/api/partners", (_req, res) => {
  try {
    const partners = listEntities(PARTNERS_DIR, "partner");
    res.json({ partners });
  } catch (err) {
    console.error("Error listing partners:", err);
    res.status(500).json({ error: "Failed to list partners" });
  }
});

clientsPartnersRouter.get("/api/clients/:slug/content", (req, res) => {
  const filePath = (req.query.path as string) ?? "client.md";
  serveContent(CLIENTS_DIR, req.params.slug, filePath, res);
});

clientsPartnersRouter.get("/api/partners/:slug/content", (req, res) => {
  const filePath = (req.query.path as string) ?? "partner.md";
  serveContent(PARTNERS_DIR, req.params.slug, filePath, res);
});
