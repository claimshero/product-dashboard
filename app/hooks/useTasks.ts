import { useState, useEffect, useCallback } from "react";
import type { Task } from "~/types/tasks";

function getChatUrl(path: string): string {
  if (typeof window === "undefined") return path;
  return `${window.location.protocol}//${window.location.hostname}:4001${path}`;
}

interface TaskFilters {
  status?: "open" | "completed" | "all";
  category?: string;
  urgency?: string;
}

/**
 * Fetches tasks across all category files with optional filters.
 */
export function useAllTasks(filters?: TaskFilters) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filters?.status) params.set("status", filters.status);
      if (filters?.category) params.set("category", filters.category);
      if (filters?.urgency) params.set("urgency", filters.urgency);

      const qs = params.toString();
      const url = getChatUrl(`/api/tasks${qs ? `?${qs}` : ""}`);
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks ?? []);
      }
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
    } finally {
      setLoading(false);
    }
  }, [filters?.status, filters?.category, filters?.urgency]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return { tasks, loading, refresh: fetchTasks };
}

/**
 * Fetches list of task category names.
 */
export function useTaskCategories() {
  const [categories, setCategories] = useState<string[]>([]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch(getChatUrl("/api/tasks/categories"));
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories ?? []);
      }
    } catch (err) {
      console.error("Failed to fetch categories:", err);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  return { categories, refresh: fetchCategories };
}

/**
 * Toggle a task's completion status.
 */
export async function toggleTaskApi(category: string, lineIndex: number): Promise<Task | null> {
  try {
    const res = await fetch(getChatUrl(`/api/tasks/${category}/${lineIndex}/toggle`), {
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

/**
 * Create a new task.
 */
export async function createTaskApi(
  text: string,
  opts?: { betSlug?: string; jiraKey?: string; clientSlug?: string; partnerSlug?: string; urgency?: string }
): Promise<void> {
  try {
    await fetch(getChatUrl("/api/tasks"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, ...opts }),
    });
  } catch (err) {
    console.error("Failed to create task:", err);
  }
}

/**
 * Delete a task.
 */
export async function deleteTaskApi(category: string, lineIndex: number): Promise<void> {
  try {
    await fetch(getChatUrl(`/api/tasks/${category}/${lineIndex}`), {
      method: "DELETE",
    });
  } catch (err) {
    console.error("Failed to delete task:", err);
  }
}

/**
 * Update a task's description.
 */
export async function updateTaskDescriptionApi(
  category: string,
  lineIndex: number,
  description: string
): Promise<void> {
  try {
    await fetch(getChatUrl(`/api/tasks/${category}/${lineIndex}/description`), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description }),
    });
  } catch (err) {
    console.error("Failed to update description:", err);
  }
}
