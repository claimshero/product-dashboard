import { Router } from "express";
import {
  loadTaskDefinitions,
  getTaskDefinition,
  createTaskDefinition,
  updateTaskDefinition,
  deleteTaskDefinition,
  getResultsForTask,
  getLatestResult,
} from "./scheduled-tasks.js";
import { runTaskNow, refreshSchedule, isTaskRunning } from "./scheduler.js";

export const scheduledTasksRouter = Router();

// List all task definitions
scheduledTasksRouter.get("/api/scheduled-tasks", (_req, res) => {
  const tasks = loadTaskDefinitions();
  res.json({ tasks });
});

// Get a single task definition
scheduledTasksRouter.get("/api/scheduled-tasks/:id", (req, res) => {
  const task = getTaskDefinition(req.params.id);
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  res.json(task);
});

// Create a task definition
scheduledTasksRouter.post("/api/scheduled-tasks", (req, res) => {
  const { name, description, schedule, enabled, prompt, systemPrompt } = req.body;
  if (!name || !schedule || !prompt) {
    res.status(400).json({ error: "name, schedule, and prompt are required" });
    return;
  }
  const task = createTaskDefinition({
    name,
    description: description ?? "",
    schedule,
    enabled: enabled ?? true,
    prompt,
    systemPrompt,
  });
  refreshSchedule(task.id);
  res.status(201).json(task);
});

// Update a task definition
scheduledTasksRouter.patch("/api/scheduled-tasks/:id", (req, res) => {
  const task = updateTaskDefinition(req.params.id, req.body);
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  refreshSchedule(task.id);
  res.json(task);
});

// Delete a task definition
scheduledTasksRouter.delete("/api/scheduled-tasks/:id", (req, res) => {
  const deleted = deleteTaskDefinition(req.params.id);
  if (!deleted) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  refreshSchedule(req.params.id);
  res.json({ ok: true });
});

// Run a task immediately
scheduledTasksRouter.post("/api/scheduled-tasks/:id/run", async (req, res) => {
  try {
    if (isTaskRunning(req.params.id)) {
      res.status(409).json({ error: "Task is already running" });
      return;
    }
    // Start execution in background and return immediately
    const taskId = req.params.id;
    res.json({ status: "started", taskId });

    // Fire and forget — result is saved by the scheduler
    runTaskNow(taskId).catch((err) => {
      console.error(`Manual task run failed for ${taskId}:`, err);
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to run task",
    });
  }
});

// Get execution history for a task
scheduledTasksRouter.get("/api/scheduled-tasks/:id/results", (req, res) => {
  const results = getResultsForTask(req.params.id);
  res.json({ results });
});

// Get the latest result for a task
scheduledTasksRouter.get("/api/scheduled-tasks/:id/results/latest", (req, res) => {
  const result = getLatestResult(req.params.id);
  if (!result) {
    res.json({ result: null });
    return;
  }
  res.json({ result });
});

// Check if a task is currently running
scheduledTasksRouter.get("/api/scheduled-tasks/:id/status", (req, res) => {
  res.json({ running: isTaskRunning(req.params.id) });
});
