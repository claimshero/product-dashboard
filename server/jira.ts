import { Router } from "express";
import fs from "fs";
import path from "path";
import os from "os";

const JIRA_BASE_URL = "https://claimable.atlassian.net";
const CONFIG_DIR = path.join(
  os.homedir(),
  "Library/Application Support/work-dashboard"
);
const TRACKED_EPICS_PATH = path.join(CONFIG_DIR, "tracked-epics.json");

function getAuthHeader(): string {
  // Support both Bearer tokens (OAuth) and API tokens (Basic Auth)
  const bearer = process.env.JIRA_BEARER_TOKEN;
  if (bearer) {
    return `Bearer ${bearer}`;
  }
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;
  if (email && token) {
    return `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`;
  }
  throw new Error(
    "Set JIRA_BEARER_TOKEN or both JIRA_EMAIL and JIRA_API_TOKEN"
  );
}

async function jiraFetch(path: string): Promise<any> {
  const res = await fetch(`${JIRA_BASE_URL}${path}`, {
    headers: {
      Authorization: getAuthHeader(),
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`Jira API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export interface JiraIssue {
  key: string;
  summary: string;
  status: string;
  statusCategory: string;
  assignee: string | null;
  priority: string;
  issueType: string;
  url: string;
  updated: string;
}

export interface TrackedEpic {
  key: string;
  summary: string;
  status: string;
  assignee: string | null;
  url: string;
  children: JiraIssue[];
  progress: { done: number; total: number };
}

function mapIssue(issue: any): JiraIssue {
  return {
    key: issue.key,
    summary: issue.fields.summary,
    status: issue.fields.status?.name ?? "Unknown",
    statusCategory: issue.fields.status?.statusCategory?.key ?? "undefined",
    assignee: issue.fields.assignee?.displayName ?? null,
    priority: issue.fields.priority?.name ?? "None",
    issueType: issue.fields.issuetype?.name ?? "Unknown",
    url: `${JIRA_BASE_URL}/browse/${issue.key}`,
    updated: issue.fields.updated,
  };
}

/** Use the search/jql endpoint for all issue fetching (direct GET returns 404 on some Jira Cloud setups) */
async function searchIssues(
  jql: string,
  fields: string,
  maxResults = 100
): Promise<any[]> {
  const params = new URLSearchParams({
    jql,
    fields,
    maxResults: String(maxResults),
  });
  const data = await jiraFetch(`/rest/api/3/search/jql?${params}`);
  return data.issues ?? [];
}

async function fetchEpicWithChildren(epicKey: string): Promise<TrackedEpic> {
  // Fetch the epic itself via search
  const [epic] = await searchIssues(
    `key = ${epicKey}`,
    "summary,status,assignee"
  );
  if (!epic) {
    throw new Error(`Issue ${epicKey} not found`);
  }

  // Fetch child issues
  const children: JiraIssue[] = (
    await searchIssues(
      `("Epic Link" = ${epicKey} OR parent = ${epicKey}) ORDER BY status ASC, updated DESC`,
      "summary,status,assignee,priority,issuetype,updated"
    )
  ).map(mapIssue);

  const done = children.filter((c) => c.statusCategory === "done").length;

  return {
    key: epic.key,
    summary: epic.fields.summary,
    status: epic.fields.status?.name ?? "Unknown",
    assignee: epic.fields.assignee?.displayName ?? null,
    url: `${JIRA_BASE_URL}/browse/${epic.key}`,
    children,
    progress: { done, total: children.length },
  };
}

// --- Tracked epics persistence ---

function loadTrackedEpicKeys(): string[] {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    if (fs.existsSync(TRACKED_EPICS_PATH)) {
      return JSON.parse(fs.readFileSync(TRACKED_EPICS_PATH, "utf-8"));
    }
  } catch {
    // ignore
  }
  return [];
}

function saveTrackedEpicKeys(keys: string[]): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(TRACKED_EPICS_PATH, JSON.stringify(keys, null, 2), "utf-8");
}

/** Extract a Jira issue key from a key string or full URL */
function extractIssueKey(input: string): string | null {
  const trimmed = input.trim();
  // Match "MVP-1234" style keys
  const keyMatch = trimmed.match(/^([A-Z]+-\d+)$/i);
  if (keyMatch) return keyMatch[1].toUpperCase();
  // Match URLs like https://claimable.atlassian.net/browse/MVP-1234
  const urlMatch = trimmed.match(/\/browse\/([A-Z]+-\d+)/i);
  if (urlMatch) return urlMatch[1].toUpperCase();
  return null;
}

export const jiraRouter = Router();

// Get all tracked epics with their children
jiraRouter.get("/api/jira/epics", async (_req, res) => {
  try {
    const keys = loadTrackedEpicKeys();
    const epics = await Promise.all(keys.map(fetchEpicWithChildren));
    res.json({ epics });
  } catch (err) {
    console.error("Error fetching Jira epics:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to fetch epics",
    });
  }
});

// Add a tracked epic
jiraRouter.post("/api/jira/epics", (req, res) => {
  const { key } = req.body as { key?: string };
  if (!key || typeof key !== "string") {
    res.status(400).json({ error: "key is required" });
    return;
  }
  const keys = loadTrackedEpicKeys();
  const normalized = extractIssueKey(key);
  if (!normalized) {
    res.status(400).json({ error: "Invalid issue key or URL" });
    return;
  }
  if (!keys.includes(normalized)) {
    keys.push(normalized);
    saveTrackedEpicKeys(keys);
  }
  res.json({ tracked: keys });
});

// Remove a tracked epic
jiraRouter.delete("/api/jira/epics/:key", (req, res) => {
  const keys = loadTrackedEpicKeys();
  const normalized = req.params.key.toUpperCase().trim();
  const filtered = keys.filter((k) => k !== normalized);
  saveTrackedEpicKeys(filtered);
  res.json({ tracked: filtered });
});
