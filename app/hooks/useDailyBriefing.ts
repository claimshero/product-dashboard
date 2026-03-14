import { useState, useEffect, useCallback, useRef } from "react";

const TASK_ID = "daily-briefing";

function getApiUrl(path: string): string {
  if (typeof window === "undefined") return path;
  return `${window.location.protocol}//${window.location.hostname}:4001${path}`;
}

export interface BriefingResult {
  id: string;
  taskId: string;
  startedAt: string;
  completedAt: string;
  status: "success" | "error" | "running";
  content: string;
  error?: string;
}

export function useDailyBriefing() {
  const [briefing, setBriefing] = useState<BriefingResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLatest = useCallback(async () => {
    try {
      const res = await fetch(
        getApiUrl(`/api/scheduled-tasks/${TASK_ID}/results/latest`)
      );
      if (!res.ok) throw new Error("Failed to fetch briefing");
      const data = await res.json();
      setBriefing(data.result ?? null);
      setError(null);
      return data.result as BriefingResult | null;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const runNow = useCallback(async () => {
    try {
      const res = await fetch(
        getApiUrl(`/api/scheduled-tasks/${TASK_ID}/run`),
        { method: "POST" }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to start briefing");
      }

      // Set a temporary "running" state
      setBriefing((prev) =>
        prev
          ? { ...prev, status: "running" }
          : {
              id: "",
              taskId: TASK_ID,
              startedAt: new Date().toISOString(),
              completedAt: "",
              status: "running",
              content: "",
            }
      );

      // Poll for completion
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        const result = await fetchLatest();
        if (result && result.status !== "running") {
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        }
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run briefing");
    }
  }, [fetchLatest]);

  useEffect(() => {
    fetchLatest().then((result) => {
      // If there's a running task, start polling
      if (result?.status === "running") {
        pollRef.current = setInterval(async () => {
          const r = await fetchLatest();
          if (r && r.status !== "running") {
            if (pollRef.current) {
              clearInterval(pollRef.current);
              pollRef.current = null;
            }
          }
        }, 3000);
      }
    });

    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchLatest, 5 * 60 * 1000);
    return () => {
      clearInterval(interval);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchLatest]);

  return { briefing, loading, error, refresh: fetchLatest, runNow };
}
