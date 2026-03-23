import { useState, useEffect, useCallback } from "react";
import type { MeetingNote } from "~/types/navigation";

function getChatUrl(p: string): string {
  if (typeof window === "undefined") return p;
  return `${window.location.protocol}//${window.location.hostname}:4001${p}`;
}

export function useMeetings() {
  const [meetings, setMeetings] = useState<MeetingNote[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMeetings = useCallback(async () => {
    try {
      const res = await fetch(getChatUrl("/api/meetings"));
      if (res.ok) {
        const data = await res.json();
        setMeetings(data.meetings ?? []);
      }
    } catch (err) {
      console.error("Failed to fetch meetings:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  return { meetings, loading, refresh: fetchMeetings };
}

export function useMeetingContent(filename: string | null) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!filename) {
      setContent(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch(getChatUrl(`/api/meetings/${encodeURIComponent(filename)}/content`))
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setContent(data.content ?? null);
      })
      .catch(() => {
        if (!cancelled) setContent(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [filename]);

  return { content, loading };
}
