import { useState, useEffect, useCallback } from "react";
import type { BetSummary } from "~/types/navigation";

const API_BASE = "http://localhost:4001";

export function useBets() {
  const [bets, setBets] = useState<BetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/bets`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to fetch bets");
      }
      const data = await res.json();
      setBets(data.bets ?? []);
    } catch (err) {
      console.error("Failed to fetch bets:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBets();
  }, [fetchBets]);

  return { bets, loading, error, refresh: fetchBets };
}

export function useBetContent(slug: string | null, filePath: string | null) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!slug || !filePath) {
      setContent(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch(`${API_BASE}/api/bets/${slug}/content?path=${encodeURIComponent(filePath)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setContent(data.content ?? null);
      })
      .catch((err) => {
        console.error("Failed to fetch bet content:", err);
        if (!cancelled) setContent(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug, filePath]);

  return { content, loading };
}
