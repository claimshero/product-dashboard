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

export interface LinkedIdea {
  key: string;
  summary: string;
  status: string;
  statusCategory: string;
  url: string;
  updated?: string;
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

export interface SelectedItem {
  key: string;
  summary: string;
  status: string;
  statusCategory: string;
  issueType: string;
  url: string;
}

export function useDelivery() {
  const [epics, setEpics] = useState<DeliveryEpic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDelivery = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/jira/delivery`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to fetch delivery epics");
      }
      const data = await res.json();
      setEpics(data.epics ?? []);
    } catch (err) {
      console.error("Failed to fetch delivery epics:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDelivery();
    const interval = setInterval(fetchDelivery, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchDelivery]);

  return { epics, loading, error, refresh: fetchDelivery };
}
