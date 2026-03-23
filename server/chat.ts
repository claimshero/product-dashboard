import "dotenv/config";
import express from "express";
import cors from "cors";
import fs from "fs";
import os from "os";
import path from "path";
import { query } from "@anthropic-ai/claude-agent-sdk";
import {
  listConversations,
  getConversation,
  createConversation,
  deleteConversation,
  updateConversation,
  appendMessages,
} from "./conversations.js";
import { betsRouter } from "./bets.js";
import { dailyNotesRouter } from "./daily-notes.js";
import { tasksRouter } from "./tasks-router.js";
import { githubPRsRouter } from "./github-prs.js";
import { jiraRouter } from "./jira.js";
import { scheduledTasksRouter } from "./scheduled-tasks-router.js";
import { trackedInterestsRouter } from "./tracked-interests-router.js";
import { clientsPartnersRouter } from "./clients-partners.js";
import { startScheduler } from "./scheduler.js";
import { loadTaskDefinitions, createTaskDefinitionWithId, updateTaskDefinition } from "./scheduled-tasks.js";
import {
  OBSIDIAN_VAULT_PATH,
  APP_SUPPORT_DIR,
  CHAT_SYSTEM_PROMPT,
  DAILY_BRIEFING_PROMPT,
  DAILY_BRIEFING_SYSTEM_PROMPT,
} from "./prompts.js";

interface ChatContext {
  selectedNode?: {
    type: string;
    name?: string;
    slug?: string;
    filePath?: string;
    fileName?: string;
    filename?: string;
    date?: string;
    key?: string;
    summary?: string;
    status?: string;
    issueType?: string;
    url?: string;
  } | null;
  selectedTask?: {
    id: string;
    text: string;
    completed: boolean;
    betSlug: string | null;
    jiraKey: string | null;
    clientSlug: string | null;
    partnerSlug: string | null;
    urgency: string | null;
    date: string;
  } | null;
}

function buildSystemPrompt(context?: ChatContext): string {
  let prompt = CHAT_SYSTEM_PROMPT;
  const node = context?.selectedNode;
  if (!node) return prompt;

  prompt += `\n\n## Currently selected item\nThe user is currently viewing this item in the dashboard:\n`;

  switch (node.type) {
    case "bet":
      prompt += `- **Type:** Bet\n- **Name:** ${node.name}\n- **Status:** ${node.status}\n- **Vault folder:** Product/Bets/${node.slug}/\n\nThis is a product bet from Josh's Obsidian vault. The bet.md file and any notes/research files are in the vault at the path above. When the user refers to "this bet" or asks about it, read the bet.md and related files to answer.`;
      break;
    case "bet-file":
      prompt += `- **Type:** Bet file\n- **Bet folder:** Product/Bets/${node.slug}/\n- **File:** ${node.filePath}\n\nThe user is viewing a specific file within a bet folder. Read this file from the vault to answer questions about it.`;
      break;
    case "jira-idea":
    case "jira-epic":
    case "jira-story": {
      const typeLabel = node.type === "jira-idea" ? "Idea" : node.type === "jira-epic" ? "Epic" : node.issueType ?? "Story";
      prompt += `- **Type:** ${typeLabel}\n- **Key:** ${node.key}\n- **Summary:** ${node.summary}\n- **Status:** ${node.status}\n- **URL:** ${node.url}\n\nWhen the user refers to "this", "the selected item", or asks about something without specifying which item, they likely mean this item. You can use the Jira MCP tools to look up more details about it.`;
      break;
    }
    case "meeting-note":
      prompt += `- **Type:** Meeting note\n- **Name:** ${node.name}\n- **Date:** ${node.date ?? ""}\n- **File:** Daily/meetings/${node.filename ?? ""}\n\nThe user is viewing a meeting note. Read the file from the vault to answer questions about it.`;
      break;
    case "client":
      prompt += `- **Type:** Client\n- **Name:** ${node.name}\n- **Relationship:** ${node.status ?? ""}\n- **Vault folder:** Product/Clients/${node.slug}/\n\nThis is a client from Josh's Obsidian vault. Read the client.md and related notes to answer questions about this client.`;
      break;
    case "partner":
      prompt += `- **Type:** Partner\n- **Name:** ${node.name}\n- **Relationship:** ${node.status ?? ""}\n- **Vault folder:** Product/Partners/${node.slug}/\n\nThis is a partner from Josh's Obsidian vault. Read the partner.md and related notes to answer questions about this partner.`;
      break;
    case "client-file":
      prompt += `- **Type:** Client file\n- **Client folder:** Product/Clients/${node.slug}/\n- **File:** ${node.filePath}\n\nThe user is viewing a specific file within a client folder. Read this file from the vault to answer questions about it.`;
      break;
    case "partner-file":
      prompt += `- **Type:** Partner file\n- **Partner folder:** Product/Partners/${node.slug}/\n- **File:** ${node.filePath}\n\nThe user is viewing a specific file within a partner folder. Read this file from the vault to answer questions about it.`;
      break;
  }

  const task = context?.selectedTask;
  if (task) {
    prompt += `\n\n## Currently selected task\nThe user has selected this task in the dashboard. When they refer to "this task" or "the task", they mean:\n`;
    prompt += `- **Text:** ${task.text}\n`;
    prompt += `- **Status:** ${task.completed ? "Completed" : "To Do"}\n`;
    prompt += `- **Date:** ${task.date}\n`;
    if (task.urgency) prompt += `- **Urgency:** ${task.urgency}\n`;
    if (task.betSlug) prompt += `- **Bet:** ${task.betSlug}\n`;
    if (task.jiraKey) prompt += `- **JIRA:** ${task.jiraKey}\n`;
    if (task.clientSlug) prompt += `- **Client:** ${task.clientSlug}\n`;
    if (task.partnerSlug) prompt += `- **Partner:** ${task.partnerSlug}\n`;
    prompt += `\nThe task lives in the daily note at Daily/${task.date}.md under the ## Tasks section.`;
  }

  return prompt;
}

const app = express();
const PORT = process.env.CHAT_PORT ?? 4001;

/** Load MCP server configs from ~/.claude.json */
function loadMcpServers(): Record<string, any> {
  try {
    const configPath = path.join(os.homedir(), ".claude.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    return config.mcpServers ?? {};
  } catch {
    return {};
  }
}

const mcpServers = loadMcpServers();
if (Object.keys(mcpServers).length > 0) {
  console.log(
    `Loaded MCP servers: ${Object.keys(mcpServers).join(", ")}`
  );
}

app.use(cors());
app.use(express.json());
app.use(betsRouter);
app.use(dailyNotesRouter);
app.use(tasksRouter);
app.use(githubPRsRouter);
app.use(jiraRouter);
app.use(scheduledTasksRouter);
app.use(trackedInterestsRouter);
app.use(clientsPartnersRouter);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// --- Conversation REST endpoints ---

app.get("/api/conversations", (_req, res) => {
  const conversations = listConversations();
  res.json(conversations);
});

app.post("/api/conversations", (req, res) => {
  const { title } = req.body as { title?: string };
  if (!title || typeof title !== "string") {
    res.status(400).json({ error: "title is required" });
    return;
  }
  const conversation = createConversation(title);
  res.status(201).json(conversation);
});

app.get("/api/conversations/:id", (req, res) => {
  const conversation = getConversation(req.params.id);
  if (!conversation) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  // Return without sessionId to the client
  const { sessionId: _, ...rest } = conversation;
  res.json(rest);
});

app.delete("/api/conversations/:id", (req, res) => {
  const deleted = deleteConversation(req.params.id);
  if (!deleted) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  res.json({ ok: true });
});

// --- Auto-title generation ---

async function generateConversationTitle(
  convId: string,
  userPrompt: string,
  assistantResponse: string
): Promise<void> {
  const snippet = assistantResponse.slice(0, 500);
  const titlePrompt =
    "Summarize this conversation in 3-6 words for use as a short title. " +
    "Return ONLY the title text, nothing else. No quotes, no punctuation at the end.\n\n" +
    `User: ${userPrompt}\n\nAssistant: ${snippet}`;

  let title = "";
  try {
    for await (const message of query({
      prompt: titlePrompt,
      options: {
        permissionMode: "bypassPermissions",
        systemPrompt:
          "You generate short conversation titles. Respond with ONLY the title, 3-6 words. No quotes or trailing punctuation.",
      },
    })) {
      if (message.type === "stream_event") {
        const event = (message as any).event;
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          title += event.delta.text;
        }
      }
    }

    title = title.trim();
    if (title) {
      updateConversation(convId, { title });
    }
  } catch (err) {
    console.error("Failed to generate conversation title:", err);
  }
}

app.post("/api/chat", async (req, res) => {
  const { prompt, conversationId, context } = req.body as {
    prompt?: string;
    conversationId?: string;
    context?: ChatContext;
  };

  if (!prompt || typeof prompt !== "string") {
    res.status(400).json({ error: "prompt is required" });
    return;
  }

  // Resolve or create the conversation
  let convId = conversationId;
  let sessionId: string | undefined;
  let convTitle: string | undefined;
  const isNewConversation = !conversationId;

  if (convId) {
    const existing = getConversation(convId);
    if (!existing) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    sessionId = existing.sessionId;
    convTitle = existing.title;
  } else {
    // Auto-create a new conversation with a title derived from the prompt
    const title =
      prompt.length > 60 ? prompt.slice(0, 57) + "..." : prompt;
    const newConv = createConversation(title);
    convId = newConv.id;
    convTitle = newConv.title;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Send meta event so the client knows the conversationId and title
  const metaData = JSON.stringify({
    conversationId: convId,
    title: convTitle,
  });
  res.write(`event: meta\ndata: ${metaData}\n\n`);

  let accumulated = "";
  let hasContentInCurrentTurn = false;

  try {
    for await (const message of query({
      prompt,
      options: {
        permissionMode: "bypassPermissions",
        includePartialMessages: true,
        additionalDirectories: [OBSIDIAN_VAULT_PATH, APP_SUPPORT_DIR, path.join(os.homedir(), ".claude/agents")],
        mcpServers,
        systemPrompt: buildSystemPrompt(context),
        ...(sessionId ? { resume: sessionId } : {}),
      },
    })) {
      // Capture session ID from the init message
      if (message.type === "system" && message.subtype === "init") {
        const initSessionId = (message as any).session_id;
        if (initSessionId && convId) {
          updateConversation(convId, { sessionId: initSessionId });
        }
      }

      if (message.type === "stream_event") {
        const event = (message as any).event;

        // Detect new message turn — insert paragraph break between turns
        if (event.type === "message_start" && accumulated.length > 0) {
          const separator = "\n\n";
          accumulated += separator;
          const data = JSON.stringify({ text: separator });
          res.write(`event: delta\ndata: ${data}\n\n`);
          hasContentInCurrentTurn = false;
        }

        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          accumulated += event.delta.text;
          hasContentInCurrentTurn = true;
          const data = JSON.stringify({ text: event.delta.text });
          res.write(`event: delta\ndata: ${data}\n\n`);
        }
      }
    }

    // Persist both user message and assistant response
    if (convId) {
      const messagesToAppend = [
        { role: "user" as const, content: prompt },
        ...(accumulated
          ? [{ role: "assistant" as const, content: accumulated }]
          : []),
      ];
      appendMessages(convId, messagesToAppend);
    }

    // Generate a descriptive title for new conversations
    if (isNewConversation && convId && accumulated) {
      generateConversationTitle(convId, prompt, accumulated).catch(
        console.error
      );
    }

    res.write(`event: done\ndata: {}\n\n`);
    res.end();
  } catch (err) {
    console.error("Chat query error:", err);
    const errorData = JSON.stringify({
      error: err instanceof Error ? err.message : "Unknown error",
    });
    res.write(`event: error\ndata: ${errorData}\n\n`);
    res.end();
  }
});

// --- Seed default tasks and start scheduler ---

const DAILY_BRIEFING_ID = "daily-briefing";

function seedDefaultTasks(): void {
  const tasks = loadTaskDefinitions();
  const existing = tasks.find((t) => t.id === DAILY_BRIEFING_ID);

  if (existing) {
    // Always sync the prompt with the latest code version
    if (existing.prompt !== DAILY_BRIEFING_PROMPT || existing.systemPrompt !== DAILY_BRIEFING_SYSTEM_PROMPT) {
      updateTaskDefinition(DAILY_BRIEFING_ID, {
        prompt: DAILY_BRIEFING_PROMPT,
        systemPrompt: DAILY_BRIEFING_SYSTEM_PROMPT,
      });
      console.log("Updated daily briefing task prompt");
    }
    return;
  }

  const now = new Date().toISOString();
  createTaskDefinitionWithId({
    id: DAILY_BRIEFING_ID,
    name: "Daily Briefing",
    description: "Morning summary of racing, healthcare appeals, market news, and Slack research channel",
    schedule: "0 7 * * 1-5",
    enabled: true,
    prompt: DAILY_BRIEFING_PROMPT,
    systemPrompt: DAILY_BRIEFING_SYSTEM_PROMPT,
    createdAt: now,
    updatedAt: now,
  });

  console.log("Seeded daily briefing task");
}

seedDefaultTasks();
startScheduler(mcpServers);

app.listen(PORT, () => {
  console.log(`Chat server running at http://localhost:${PORT}`);
});
