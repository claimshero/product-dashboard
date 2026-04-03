import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Router } from "express";

const STORE_DIR = path.join(
  os.homedir(),
  "Library/Application Support/work-dashboard"
);
const PRIORITIES_PATH = path.join(STORE_DIR, "priorities.json");

export interface Priorities {
  bets: string[];           // bet slugs in priority order
  ideasWithoutBets: string[]; // idea keys in priority order
  epicsWithoutIdeas: string[]; // epic keys in priority order
}

function ensureDir(): void {
  if (!fs.existsSync(STORE_DIR)) {
    fs.mkdirSync(STORE_DIR, { recursive: true });
  }
}

export function loadPriorities(): Priorities {
  ensureDir();
  if (!fs.existsSync(PRIORITIES_PATH)) {
    return { bets: [], ideasWithoutBets: [], epicsWithoutIdeas: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(PRIORITIES_PATH, "utf-8"));
  } catch {
    return { bets: [], ideasWithoutBets: [], epicsWithoutIdeas: [] };
  }
}

export function savePriorities(priorities: Priorities): void {
  ensureDir();
  fs.writeFileSync(PRIORITIES_PATH, JSON.stringify(priorities, null, 2));
}

export const prioritiesRouter = Router();

prioritiesRouter.get("/api/priorities", (_req, res) => {
  res.json(loadPriorities());
});

prioritiesRouter.put("/api/priorities/:list", (req, res) => {
  const list = req.params.list as keyof Priorities;
  const { order } = req.body as { order: string[] };

  if (!["bets", "ideasWithoutBets", "epicsWithoutIdeas"].includes(list)) {
    return res.status(400).json({ error: "Invalid list" });
  }
  if (!Array.isArray(order)) {
    return res.status(400).json({ error: "order must be an array" });
  }

  const priorities = loadPriorities();
  priorities[list] = order;
  savePriorities(priorities);
  res.json(priorities);
});
