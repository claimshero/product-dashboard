import * as crypto from "node:crypto";
import cron from "node-cron";
import { query } from "@anthropic-ai/claude-agent-sdk";
import {
  loadTaskDefinitions,
  getTaskDefinition,
  saveTaskResult,
  updateTaskResult,
  type ScheduledTaskDefinition,
  type TaskExecutionResult,
} from "./scheduled-tasks.js";

let globalMcpServers: Record<string, any> = {};
type CronTask = ReturnType<typeof cron.schedule>;
const cronJobs = new Map<string, CronTask>();

// Track running executions so we can prevent overlaps
const runningTasks = new Set<string>();

function interpolatePrompt(text: string): string {
  const now = new Date();
  return text
    .replace(/\{\{date\}\}/g, now.toISOString().split("T")[0])
    .replace(/\{\{time\}\}/g, now.toLocaleTimeString())
    .replace(/\{\{datetime\}\}/g, now.toISOString());
}

async function executeTask(task: ScheduledTaskDefinition): Promise<TaskExecutionResult> {
  const resultId = crypto.randomUUID();
  const startedAt = new Date().toISOString();

  // Save a "running" placeholder so the frontend can show status
  const placeholder: TaskExecutionResult = {
    id: resultId,
    taskId: task.id,
    startedAt,
    completedAt: "",
    status: "running",
    content: "",
  };
  saveTaskResult(placeholder);

  let accumulated = "";
  let hasContentInCurrentTurn = false;

  try {
    const systemPrompt = interpolatePrompt(
      task.systemPrompt ??
        `You are a personal briefing assistant. Gather real-time information using web search and any available tools, then produce a concise summary. Use markdown formatting. Today's date is {{date}}.`
    );

    for await (const message of query({
      prompt: interpolatePrompt(task.prompt),
      options: {
        permissionMode: "bypassPermissions",
        includePartialMessages: true,
        mcpServers: globalMcpServers,
        systemPrompt,
      },
    })) {
      // Collect text from result messages
      if (message.type === "result") {
        const content = (message as any).content;
        if (typeof content === "string") {
          accumulated += content;
        } else if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === "text" && block.text) {
              accumulated += block.text;
            }
          }
        }
      }

      // Collect text from assistant messages
      if (message.type === "assistant") {
        const content = (message as any).content;
        if (typeof content === "string") {
          accumulated += content;
        } else if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === "text" && block.text) {
              accumulated += block.text;
            }
          }
        }
      }

      if (message.type === "stream_event") {
        const event = (message as any).event;

        if (event.type === "message_start" && accumulated.length > 0) {
          accumulated += "\n\n";
          hasContentInCurrentTurn = false;
        }

        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          accumulated += event.delta.text;
          hasContentInCurrentTurn = true;
        }
      }
    }

    const result: TaskExecutionResult = {
      id: resultId,
      taskId: task.id,
      startedAt,
      completedAt: new Date().toISOString(),
      status: "success",
      content: accumulated,
    };

    updateTaskResult(resultId, result);
    return result;
  } catch (err) {
    const result: TaskExecutionResult = {
      id: resultId,
      taskId: task.id,
      startedAt,
      completedAt: new Date().toISOString(),
      status: "error",
      content: accumulated,
      error: err instanceof Error ? err.message : "Unknown error",
    };

    updateTaskResult(resultId, result);
    return result;
  }
}

function scheduleTask(task: ScheduledTaskDefinition): void {
  // Remove existing job if any
  const existing = cronJobs.get(task.id);
  if (existing) {
    existing.stop();
    cronJobs.delete(task.id);
  }

  if (!task.enabled || !cron.validate(task.schedule)) return;

  const job = cron.schedule(task.schedule, async () => {
    if (runningTasks.has(task.id)) {
      console.log(`Task "${task.name}" is already running, skipping`);
      return;
    }

    console.log(`Running scheduled task: ${task.name}`);
    runningTasks.add(task.id);
    try {
      await executeTask(task);
      console.log(`Task "${task.name}" completed`);
    } catch (err) {
      console.error(`Task "${task.name}" failed:`, err);
    } finally {
      runningTasks.delete(task.id);
    }
  });

  cronJobs.set(task.id, job);
}

export function startScheduler(mcpServers: Record<string, any>): void {
  globalMcpServers = mcpServers;

  const tasks = loadTaskDefinitions();
  for (const task of tasks) {
    scheduleTask(task);
  }

  console.log(
    `Scheduler started with ${tasks.filter((t) => t.enabled).length} active task(s)`
  );
}

export function refreshSchedule(taskId: string): void {
  const task = getTaskDefinition(taskId);
  if (task) {
    scheduleTask(task);
  } else {
    const existing = cronJobs.get(taskId);
    if (existing) {
      existing.stop();
      cronJobs.delete(taskId);
    }
  }
}

export async function runTaskNow(taskId: string): Promise<TaskExecutionResult> {
  const task = getTaskDefinition(taskId);
  if (!task) throw new Error(`Task ${taskId} not found`);

  if (runningTasks.has(taskId)) {
    throw new Error(`Task "${task.name}" is already running`);
  }

  runningTasks.add(taskId);
  try {
    return await executeTask(task);
  } finally {
    runningTasks.delete(taskId);
  }
}

export function isTaskRunning(taskId: string): boolean {
  return runningTasks.has(taskId);
}

export function stopScheduler(): void {
  for (const [, job] of cronJobs) {
    job.stop();
  }
  cronJobs.clear();
}
