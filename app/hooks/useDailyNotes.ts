import { useState, useEffect, useCallback, useRef } from "react";

const API_BASE = "http://localhost:3001";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function useDailyNotes() {
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [templateContent, setTemplateContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [exists, setExists] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDirty = content !== savedContent;

  const fetchList = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/daily-notes`);
      const data = await res.json();
      setAvailableDates(data.notes ?? []);
    } catch (err) {
      console.error("Failed to fetch daily notes list:", err);
    }
  }, []);

  const fetchNote = useCallback(async (date: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/daily-notes/${date}`);
      const data = await res.json();
      setContent(data.content ?? "");
      setSavedContent(data.content ?? "");
      setExists(data.exists ?? false);
      setTemplateContent(data.templateContent ?? "");
    } catch (err) {
      console.error("Failed to fetch note:", err);
      setContent("");
      setSavedContent("");
      setExists(false);
      setTemplateContent("");
    } finally {
      setLoading(false);
    }
  }, []);

  // Create a new note from the template
  const createFromTemplate = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/daily-notes/${selectedDate}`,
        { method: "POST" }
      );
      const data = await res.json();
      setContent(data.content ?? "");
      setSavedContent(data.content ?? "");
      setExists(true);
      setTemplateContent("");
      fetchList();
    } catch (err) {
      console.error("Failed to create note from template:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, fetchList]);

  // Auto-save with debounce (only if note already exists)
  const updateContent = useCallback(
    (newContent: string) => {
      setContent(newContent);
      if (!exists) return; // Don't auto-save if note hasn't been created yet
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        setSaving(true);
        fetch(`${API_BASE}/api/daily-notes/${selectedDate}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: newContent }),
        })
          .then(() => {
            setSavedContent(newContent);
            setExists(true);
            fetchList();
          })
          .catch((err) => console.error("Auto-save failed:", err))
          .finally(() => setSaving(false));
      }, 1000);
    },
    [selectedDate, fetchList, exists]
  );

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    fetchNote(selectedDate);
  }, [selectedDate, fetchNote]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  const goToToday = useCallback(() => setSelectedDate(todayStr()), []);
  const goToPrev = useCallback(
    () => setSelectedDate((d) => shiftDate(d, -1)),
    []
  );
  const goToNext = useCallback(
    () => setSelectedDate((d) => shiftDate(d, 1)),
    []
  );

  return {
    selectedDate,
    setSelectedDate,
    content,
    templateContent,
    updateContent,
    createFromTemplate,
    loading,
    saving,
    isDirty,
    exists,
    availableDates,
    goToToday,
    goToPrev,
    goToNext,
  };
}
