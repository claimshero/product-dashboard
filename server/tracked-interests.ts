import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as crypto from "node:crypto";

const STORE_DIR = path.join(
  os.homedir(),
  "Library/Application Support/work-dashboard"
);
const INTERESTS_PATH = path.join(STORE_DIR, "tracked-interests.json");

export interface TrackedInterest {
  id: string;
  topic: string;
  context?: string;
  sourceUrl?: string;
  addedAt: string;
}

function ensureDir(): void {
  if (!fs.existsSync(STORE_DIR)) {
    fs.mkdirSync(STORE_DIR, { recursive: true });
  }
}

export function loadTrackedInterests(): TrackedInterest[] {
  ensureDir();
  if (!fs.existsSync(INTERESTS_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(INTERESTS_PATH, "utf-8")) as TrackedInterest[];
  } catch {
    return [];
  }
}

function saveTrackedInterests(interests: TrackedInterest[]): void {
  ensureDir();
  const tmp = INTERESTS_PATH + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(interests, null, 2), "utf-8");
  fs.renameSync(tmp, INTERESTS_PATH);
}

export function addTrackedInterest(
  topic: string,
  context?: string,
  sourceUrl?: string
): TrackedInterest {
  const interests = loadTrackedInterests();
  const interest: TrackedInterest = {
    id: crypto.randomUUID(),
    topic,
    ...(context ? { context } : {}),
    ...(sourceUrl ? { sourceUrl } : {}),
    addedAt: new Date().toISOString(),
  };
  interests.push(interest);
  saveTrackedInterests(interests);
  return interest;
}

export function removeTrackedInterest(id: string): boolean {
  const interests = loadTrackedInterests();
  const idx = interests.findIndex((i) => i.id === id);
  if (idx === -1) return false;
  interests.splice(idx, 1);
  saveTrackedInterests(interests);
  return true;
}

export function buildTrackedInterestsPromptSection(): string {
  const interests = loadTrackedInterests();
  if (interests.length === 0) return "";

  const lines = interests.map((i) => {
    let line = `- **${i.topic}**`;
    if (i.context) line += ` — ${i.context}`;
    if (i.sourceUrl) line += ` (source: ${i.sourceUrl})`;
    return line;
  });

  return (
    `## 🔍 Tracked Topics\n` +
    `The user has asked you to watch for updates on these specific topics. Search for recent developments on each:\n` +
    lines.join("\n") +
    `\nIf there are no new developments on a tracked topic, skip it.`
  );
}
