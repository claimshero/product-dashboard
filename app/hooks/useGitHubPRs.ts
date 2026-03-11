import { useState, useEffect, useCallback } from "react";

const API_BASE = "http://localhost:3001";

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

export function useGitHubPRs() {
  const [prs, setPrs] = useState<PullRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPRs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/github/prs`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to fetch PRs");
      }
      const data = await res.json();
      setPrs(data.prs ?? []);
    } catch (err) {
      console.error("Failed to fetch PRs:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPRs();
    // Refresh every 2 minutes
    const interval = setInterval(fetchPRs, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchPRs]);

  return { prs, loading, error, refresh: fetchPRs };
}
