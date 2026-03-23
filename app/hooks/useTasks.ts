import { useState, useEffect, useCallback } from "react";
import type { Task } from "~/types/tasks";

function getChatUrl(path: string): string {
  if (typeof window === "undefined") return path;
  return `${window.location.protocol}//${window.location.hostname}:4001${path}`;
}

/**
 * Fetches all open (incomplete) tasks across recent daily notes.
 * Powers the "Next Steps" section in the left nav.
 */
export function useOpenTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOpenTasks = useCallback(async () => {
    try {
      const res = await fetch(getChatUrl("/api/tasks/open"));
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks ?? []);
      }
    } catch (err) {
      console.error("Failed to fetch open tasks:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOpenTasks();
  }, [fetchOpenTasks]);

  return { tasks, loading, refresh: fetchOpenTasks };
}

/**
 * Fetches all tasks (complete + incomplete) for a specific date.
 * Powers the right pane task list in DailyNotes.
 */
export function useDayTasks(date: string) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    if (!date) return;
    try {
      const res = await fetch(getChatUrl(`/api/tasks/${date}`));
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks ?? []);
      }
    } catch (err) {
      console.error("Failed to fetch day tasks:", err);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return { tasks, loading, refresh: fetchTasks };
}

/**
 * Toggle a task's completion status. Returns the updated task.
 */
export async function toggleTaskApi(date: string, lineIndex: number): Promise<Task | null> {
  try {
    const res = await fetch(getChatUrl(`/api/tasks/${date}/${lineIndex}/toggle`), {
      method: "PUT",
    });
    if (res.ok) {
      const data = await res.json();
      return data.task ?? null;
    }
  } catch (err) {
    console.error("Failed to toggle task:", err);
  }
  return null;
}
