import { useState, useEffect, useCallback } from "react";
import type { JiraIdea } from "~/types/navigation";

const API_BASE = "http://localhost:4001";

export function useIdeas() {
  const [ideas, setIdeas] = useState<JiraIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIdeas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/jira/ideas`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to fetch ideas");
      }
      const data = await res.json();
      setIdeas(data.ideas ?? []);
    } catch (err) {
      console.error("Failed to fetch ideas:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIdeas();
    const interval = setInterval(fetchIdeas, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchIdeas]);

  return { ideas, loading, error, refresh: fetchIdeas };
}
