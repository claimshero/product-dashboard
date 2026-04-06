import type { SelectedItem } from "~/hooks/useDelivery";

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

export interface JiraIdea {
  key: string;
  summary: string;
  status: string;
  statusCategory: string;
  url: string;
  updated?: string;
}

export interface MeetingNote {
  filename: string;
  name: string;
  date: string;
  path: string;
}

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

export type NavNode =
  | { type: "bet"; slug: string; name: string; status: string }
  | { type: "bet-file"; slug: string; filePath: string; fileName: string }
  | { type: "meeting-note"; filename: string; name: string; date: string }
  | { type: "jira-idea"; key: string; summary: string; status: string; statusCategory: string; url: string }
  | { type: "jira-epic"; key: string; summary: string; status: string; statusCategory: string; url: string; issueType: string }
  | { type: "jira-story"; key: string; summary: string; status: string; statusCategory: string; url: string; issueType: string }
  | { type: "client"; slug: string; name: string; relationship: string }
  | { type: "partner"; slug: string; name: string; relationship: string }
  | { type: "client-file"; slug: string; filePath: string; fileName: string }
  | { type: "partner-file"; slug: string; filePath: string; fileName: string }
  | { type: "competitor"; slug: string; name: string; threatLevel: string }
  | { type: "competitor-signal"; competitorSlug: string; signalSlug: string; title: string; relevance: string }
  | { type: "briefing"; date: string }
  | { type: "intel-partnership"; slug: string; name: string; status: string }
  | { type: "strategy-doc"; docType: "strategic-context" | "watch-list" | "sources" }
  | { type: "market-signal"; signalSlug: string; title: string; relevance: string };

export function navNodeId(node: NavNode): string {
  switch (node.type) {
    case "bet":
      return `bet:${node.slug}`;
    case "bet-file":
      return `file:${node.slug}/${node.filePath}`;
    case "jira-idea":
      return `idea:${node.key}`;
    case "jira-epic":
      return `epic:${node.key}`;
    case "meeting-note":
      return `meeting:${node.filename}`;
    case "jira-story":
      return `story:${node.key}`;
    case "client":
      return `client:${node.slug}`;
    case "partner":
      return `partner:${node.slug}`;
    case "client-file":
      return `file:client:${node.slug}/${node.filePath}`;
    case "partner-file":
      return `file:partner:${node.slug}/${node.filePath}`;
    case "competitor":
      return `competitor:${node.slug}`;
    case "competitor-signal":
      return `signal:${node.competitorSlug}/${node.signalSlug}`;
    case "briefing":
      return `briefing:${node.date}`;
    case "intel-partnership":
      return `intel-partnership:${node.slug}`;
    case "strategy-doc":
      return `strategy:${node.docType}`;
    case "market-signal":
      return `market-signal:${node.signalSlug}`;
  }
}

export function navNodeToSelectedItem(node: NavNode): SelectedItem | null {
  if (
    node.type === "bet" || node.type === "bet-file" || node.type === "meeting-note" ||
    node.type === "client" || node.type === "partner" ||
    node.type === "client-file" || node.type === "partner-file" ||
    node.type === "competitor" || node.type === "competitor-signal" ||
    node.type === "briefing" || node.type === "intel-partnership" ||
    node.type === "strategy-doc" || node.type === "market-signal"
  ) return null;
  return {
    key: node.key,
    summary: node.summary,
    status: node.status,
    statusCategory: node.statusCategory,
    issueType: node.type === "jira-idea" ? "Idea" : node.type === "jira-epic" ? "Epic" : "Story",
    url: node.url,
  };
}
