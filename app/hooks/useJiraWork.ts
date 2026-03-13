import { useState, useEffect, useCallback } from "react";

const API_BASE = "http://localhost:4001";

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

export interface TrackedEpic {
  key: string;
  summary: string;
  status: string;
  assignee: string | null;
  url: string;
  children: JiraIssue[];
  progress: { done: number; total: number };
}

export function useJiraWork() {
  const [epics, setEpics] = useState<TrackedEpic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEpics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/jira/epics`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to fetch epics");
      }
      const data = await res.json();
      setEpics(data.epics ?? []);
    } catch (err) {
      console.error("Failed to fetch Jira epics:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  const trackEpic = useCallback(
    async (key: string) => {
      try {
        await fetch(`${API_BASE}/api/jira/epics`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key }),
        });
        await fetchEpics();
      } catch (err) {
        console.error("Failed to track epic:", err);
      }
    },
    [fetchEpics]
  );

  const untrackEpic = useCallback(
    async (key: string) => {
      try {
        await fetch(`${API_BASE}/api/jira/epics/${key}`, {
          method: "DELETE",
        });
        await fetchEpics();
      } catch (err) {
        console.error("Failed to untrack epic:", err);
      }
    },
    [fetchEpics]
  );

  useEffect(() => {
    fetchEpics();
    const interval = setInterval(fetchEpics, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchEpics]);

  return { epics, loading, error, refresh: fetchEpics, trackEpic, untrackEpic };
}
