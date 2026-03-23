import { Router } from "express";
import fs from "fs";
import path from "path";
import os from "os";

const JIRA_BASE_URL = "https://claimable.atlassian.net";

const JIRA_EMAIL = "josh.roberts@getclaimable.com";
const TOKEN_FILE_PATH = path.join(
  import.meta.dirname,
  "../.tokens/AtlassianToken"
);

function getAuthHeader(): string {
  const bearer = process.env.JIRA_BEARER_TOKEN;
  if (bearer) {
    return `Bearer ${bearer}`;
  }

  let token: string | undefined;
  try {
    token = fs.readFileSync(TOKEN_FILE_PATH, "utf-8").trim();
  } catch {
    // Fall back to env vars
  }

  const email = process.env.JIRA_EMAIL ?? JIRA_EMAIL;
  token = token ?? process.env.JIRA_API_TOKEN;

  if (email && token) {
    return `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`;
  }
  throw new Error(
    "Could not read Jira token from ~/Documents/TOKENS/AtlassianToken or JIRA_API_TOKEN env var"
  );
}

async function jiraFetch(apiPath: string): Promise<any> {
  const res = await fetch(`${JIRA_BASE_URL}${apiPath}`, {
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
  children?: JiraIssue[];
}

export interface LinkedIdea {
  key: string;
  summary: string;
  status: string;
  statusCategory: string;
  url: string;
}

export interface DeliveryEpic {
  key: string;
  summary: string;
  status: string;
  statusCategory: string;
  assignee: string | null;
  url: string;
  idea: LinkedIdea | null;
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

function extractLinkedIdea(issuelinks: any[]): LinkedIdea | null {
  const IDEA_LINK_TYPES = [
    "Polaris work item link",
    "Polaris datapoint work item link",
  ];
  for (const link of issuelinks) {
    if (!IDEA_LINK_TYPES.includes(link.type?.name)) continue;
    const candidate = link.inwardIssue ?? link.outwardIssue;
    if (candidate?.fields?.issuetype?.name === "Idea") {
      return {
        key: candidate.key,
        summary: candidate.fields.summary,
        status: candidate.fields.status?.name ?? "Unknown",
        statusCategory: candidate.fields.status?.statusCategory?.key ?? "undefined",
        url: `${JIRA_BASE_URL}/browse/${candidate.key}`,
      };
    }
  }
  return null;
}

async function fetchChildrenForEpic(
  epicKey: string
): Promise<{ children: JiraIssue[]; progress: { done: number; total: number } }> {
  const children: JiraIssue[] = (
    await searchIssues(
      `("Epic Link" = ${epicKey} OR parent = ${epicKey}) ORDER BY status ASC, updated DESC`,
      "summary,status,assignee,priority,issuetype,updated"
    )
  ).map(mapIssue);

  if (children.length > 0) {
    const childKeys = children.map((c) => c.key).join(", ");
    const subtasks = (
      await searchIssues(
        `parent in (${childKeys}) ORDER BY status ASC, updated DESC`,
        "summary,status,assignee,priority,issuetype,updated,parent"
      )
    ).map((raw) => ({
      ...mapIssue(raw),
      parentKey: raw.fields.parent?.key as string | undefined,
    }));

    const subtasksByParent = new Map<string, JiraIssue[]>();
    for (const st of subtasks) {
      if (st.parentKey) {
        const list = subtasksByParent.get(st.parentKey) ?? [];
        list.push(st);
        subtasksByParent.set(st.parentKey, list);
      }
    }

    for (const child of children) {
      const subs = subtasksByParent.get(child.key);
      if (subs && subs.length > 0) {
        child.children = subs;
      }
    }
  }

  const done = children.filter((c) => c.statusCategory === "done").length;
  return { children, progress: { done, total: children.length } };
}

export const jiraRouter = Router();

jiraRouter.get("/api/jira/delivery", async (_req, res) => {
  try {
    const rawEpics = await searchIssues(
      'project = MVP AND issuetype = Epic AND status in ("In Delivery", "In Progress", "Committed - TODO") ORDER BY updated DESC',
      "summary,status,assignee,issuelinks"
    );

    const results = await Promise.allSettled(
      rawEpics.map(async (raw): Promise<DeliveryEpic> => {
        const idea = extractLinkedIdea(raw.fields.issuelinks ?? []);
        const { children, progress } = await fetchChildrenForEpic(raw.key);
        return {
          key: raw.key,
          summary: raw.fields.summary,
          status: raw.fields.status?.name ?? "Unknown",
          statusCategory: raw.fields.status?.statusCategory?.key ?? "undefined",
          assignee: raw.fields.assignee?.displayName ?? null,
          url: `${JIRA_BASE_URL}/browse/${raw.key}`,
          idea,
          children,
          progress,
        };
      })
    );

    const epics = results
      .filter((r): r is PromiseFulfilledResult<DeliveryEpic> => r.status === "fulfilled")
      .map((r) => r.value);

    res.json({ epics });
  } catch (err) {
    console.error("Error fetching delivery epics:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to fetch delivery epics",
    });
  }
});

jiraRouter.get("/api/jira/ideas", async (_req, res) => {
  try {
    const rawIdeas = await searchIssues(
      "project = DB AND issuetype = Idea ORDER BY updated DESC",
      "summary,status"
    );

    const ideas = rawIdeas.map((raw) => ({
      key: raw.key,
      summary: raw.fields.summary,
      status: raw.fields.status?.name ?? "Unknown",
      statusCategory: raw.fields.status?.statusCategory?.key ?? "undefined",
      url: `${JIRA_BASE_URL}/browse/${raw.key}`,
    }));

    res.json({ ideas });
  } catch (err) {
    console.error("Error fetching ideas:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to fetch ideas",
    });
  }
});

jiraRouter.get("/api/jira/issue/:key/details", async (req, res) => {
  try {
    const key = req.params.key.toUpperCase().trim();
    const issue = await jiraFetch(
      `/rest/api/3/issue/${key}?fields=summary,status,issuetype,description,assignee,priority&expand=renderedFields`
    );
    res.json({
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status?.name ?? "Unknown",
      statusCategory: issue.fields.status?.statusCategory?.key ?? "undefined",
      issueType: issue.fields.issuetype?.name ?? "Unknown",
      assignee: issue.fields.assignee?.displayName ?? null,
      descriptionHtml: issue.renderedFields?.description ?? null,
      url: `${JIRA_BASE_URL}/browse/${issue.key}`,
    });
  } catch (err) {
    console.error("Error fetching issue details:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to fetch issue details",
    });
  }
});
