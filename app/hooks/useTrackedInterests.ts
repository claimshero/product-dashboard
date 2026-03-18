import { useState, useEffect, useCallback } from "react";

function getApiUrl(path: string): string {
  if (typeof window === "undefined") return path;
  return `${window.location.protocol}//${window.location.hostname}:4001${path}`;
}

export interface TrackedInterest {
  id: string;
  topic: string;
  context?: string;
  sourceUrl?: string;
  addedAt: string;
}

export function useTrackedInterests() {
  const [interests, setInterests] = useState<TrackedInterest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInterests = useCallback(async () => {
    try {
      const res = await fetch(getApiUrl("/api/tracked-interests"));
      if (!res.ok) throw new Error("Failed to fetch tracked interests");
      const data = await res.json();
      setInterests(data.interests ?? []);
    } catch (err) {
      console.error("Failed to fetch tracked interests:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const addInterest = useCallback(
    async (topic: string, context?: string, sourceUrl?: string) => {
      try {
        await fetch(getApiUrl("/api/tracked-interests"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic, context, sourceUrl }),
        });
        await fetchInterests();
      } catch (err) {
        console.error("Failed to add tracked interest:", err);
      }
    },
    [fetchInterests]
  );

  const removeInterest = useCallback(
    async (id: string) => {
      try {
        await fetch(getApiUrl(`/api/tracked-interests/${id}`), {
          method: "DELETE",
        });
        await fetchInterests();
      } catch (err) {
        console.error("Failed to remove tracked interest:", err);
      }
    },
    [fetchInterests]
  );

  useEffect(() => {
    fetchInterests();
  }, [fetchInterests]);

  return { interests, loading, addInterest, removeInterest, refresh: fetchInterests };
}
