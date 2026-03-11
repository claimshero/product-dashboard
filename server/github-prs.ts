import { Router } from "express";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const ORG = "claimshero";

export interface PullRequest {
  number: number;
  title: string;
  url: string;
  repo: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  reviewDecision: string | null;
  additions: number;
  deletions: number;
  labels: string[];
  checks: "success" | "failure" | "pending" | "none";
}

const QUERY = `
query($searchQuery: String!, $cursor: String) {
  search(query: $searchQuery, type: ISSUE, first: 50, after: $cursor) {
    pageInfo { hasNextPage endCursor }
    nodes {
      ... on PullRequest {
        number
        title
        url
        repository { nameWithOwner }
        author { login }
        createdAt
        updatedAt
        reviewDecision
        additions
        deletions
        labels(first: 10) { nodes { name } }
        commits(last: 1) {
          nodes {
            commit {
              statusCheckRollup {
                state
              }
            }
          }
        }
      }
    }
  }
}`;

function mapCheckState(
  state: string | null | undefined
): PullRequest["checks"] {
  if (!state) return "none";
  switch (state) {
    case "SUCCESS":
      return "success";
    case "FAILURE":
    case "ERROR":
      return "failure";
    case "PENDING":
    case "EXPECTED":
      return "pending";
    default:
      return "none";
  }
}

async function fetchPRs(): Promise<PullRequest[]> {
  const searchQuery = `org:${ORG} is:pr is:open draft:false`;
  const { stdout } = await execFileAsync("gh", [
    "api",
    "graphql",
    "-f",
    `query=${QUERY}`,
    "-f",
    `searchQuery=${searchQuery}`,
  ]);

  const data = JSON.parse(stdout);
  const nodes = data.data?.search?.nodes ?? [];

  return nodes.map((pr: any) => ({
    number: pr.number,
    title: pr.title,
    url: pr.url,
    repo: pr.repository.nameWithOwner,
    author: pr.author?.login ?? "unknown",
    createdAt: pr.createdAt,
    updatedAt: pr.updatedAt,
    reviewDecision: pr.reviewDecision,
    additions: pr.additions,
    deletions: pr.deletions,
    labels: pr.labels?.nodes?.map((l: any) => l.name) ?? [],
    checks: mapCheckState(
      pr.commits?.nodes?.[0]?.commit?.statusCheckRollup?.state
    ),
  }));
}

export const githubPRsRouter = Router();

githubPRsRouter.get("/api/github/prs", async (_req, res) => {
  try {
    const prs = await fetchPRs();
    res.json({ prs });
  } catch (err) {
    console.error("Error fetching PRs:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to fetch PRs",
    });
  }
});
