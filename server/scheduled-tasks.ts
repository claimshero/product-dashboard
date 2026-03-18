import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as crypto from "node:crypto";

const STORE_DIR = path.join(
  os.homedir(),
  "Library/Application Support/work-dashboard"
);
const TASKS_PATH = path.join(STORE_DIR, "scheduled-tasks.json");
const RESULTS_PATH = path.join(STORE_DIR, "task-results.json");

const MAX_RESULTS_PER_TASK = 7;

export interface ScheduledTaskDefinition {
  id: string;
  name: string;
  description: string;
  schedule: string; // cron expression
  enabled: boolean;
  prompt: string;
  systemPrompt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskExecutionResult {
  id: string;
  taskId: string;
  startedAt: string;
  completedAt: string;
  status: "success" | "error" | "running";
  content: string;
  error?: string;
}

function ensureDir(): void {
  if (!fs.existsSync(STORE_DIR)) {
    fs.mkdirSync(STORE_DIR, { recursive: true });
  }
}

function readJson<T>(filePath: string, fallback: T): T {
  ensureDir();
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

function writeJson(filePath: string, data: unknown): void {
  ensureDir();
  const tmp = filePath + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(tmp, filePath);
}

// --- Task definitions ---

export function loadTaskDefinitions(): ScheduledTaskDefinition[] {
  return readJson<ScheduledTaskDefinition[]>(TASKS_PATH, []);
}

export function saveTaskDefinitions(tasks: ScheduledTaskDefinition[]): void {
  writeJson(TASKS_PATH, tasks);
}

export function getTaskDefinition(id: string): ScheduledTaskDefinition | undefined {
  return loadTaskDefinitions().find((t) => t.id === id);
}

export function createTaskDefinition(
  data: Omit<ScheduledTaskDefinition, "id" | "createdAt" | "updatedAt">
): ScheduledTaskDefinition {
  const tasks = loadTaskDefinitions();
  const now = new Date().toISOString();
  const task: ScheduledTaskDefinition = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  tasks.push(task);
  saveTaskDefinitions(tasks);
  return task;
}

export function createTaskDefinitionWithId(
  task: ScheduledTaskDefinition
): ScheduledTaskDefinition {
  const tasks = loadTaskDefinitions();
  tasks.push(task);
  saveTaskDefinitions(tasks);
  return task;
}

export function updateTaskDefinition(
  id: string,
  updates: Partial<Omit<ScheduledTaskDefinition, "id" | "createdAt">>
): ScheduledTaskDefinition | undefined {
  const tasks = loadTaskDefinitions();
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx === -1) return undefined;
  Object.assign(tasks[idx], updates, { updatedAt: new Date().toISOString() });
  saveTaskDefinitions(tasks);
  return tasks[idx];
}

export function deleteTaskDefinition(id: string): boolean {
  const tasks = loadTaskDefinitions();
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx === -1) return false;
  tasks.splice(idx, 1);
  saveTaskDefinitions(tasks);
  return true;
}

// --- Task results ---

export function loadAllResults(): TaskExecutionResult[] {
  return readJson<TaskExecutionResult[]>(RESULTS_PATH, []);
}

function saveAllResults(results: TaskExecutionResult[]): void {
  writeJson(RESULTS_PATH, results);
}

export function getResultsForTask(taskId: string): TaskExecutionResult[] {
  return loadAllResults()
    .filter((r) => r.taskId === taskId)
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
}

export function getLatestResult(taskId: string): TaskExecutionResult | undefined {
  return getResultsForTask(taskId)[0];
}

export function getRecentSuccessfulResults(
  taskId: string,
  limit: number = 3
): TaskExecutionResult[] {
  return getResultsForTask(taskId)
    .filter((r) => r.status === "success" && r.content)
    .slice(0, limit);
}

export function saveTaskResult(result: TaskExecutionResult): void {
  const all = loadAllResults();
  all.push(result);

  // Prune old results per task
  const byTask = new Map<string, TaskExecutionResult[]>();
  for (const r of all) {
    const list = byTask.get(r.taskId) ?? [];
    list.push(r);
    byTask.set(r.taskId, list);
  }

  const pruned: TaskExecutionResult[] = [];
  for (const [, results] of byTask) {
    results.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    pruned.push(...results.slice(0, MAX_RESULTS_PER_TASK));
  }

  saveAllResults(pruned);
}

export function updateTaskResult(
  resultId: string,
  updates: Partial<TaskExecutionResult>
): void {
  const all = loadAllResults();
  const idx = all.findIndex((r) => r.id === resultId);
  if (idx === -1) return;
  Object.assign(all[idx], updates);
  saveAllResults(all);
}
