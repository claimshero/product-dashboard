import express from "express";
import cors from "cors";
import fs from "fs";
import os from "os";
import path from "path";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { config } from "./config.js";
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
import { prioritiesRouter } from "./priorities.js";
import { intelRouter } from "./intel.js";
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
    category: string;
  } | null;
}

function buildSystemPrompt(context?: ChatContext): string {
  let prompt = CHAT_SYSTEM_PROMPT;
  const node = context?.selectedNode;
  if (!node) return prompt;

  prompt += `\n\n## Currently selected item\nThe user is currently viewing this item in the dashboard:\n`;

  switch (node.type) {
    case "bet":
      prompt += `- **Type:** Bet\n- **Name:** ${node.name}\n- **Status:** ${node.status}\n- **Vault folder:** Product/Bets/${node.slug}/\n\nThis is a product bet from ${config.userName}'s Obsidian vault. The bet.md file and any notes/research files are in the vault at the path above. When the user refers to "this bet" or asks about it, read the bet.md and related files to answer.`;
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
      prompt += `- **Type:** Client\n- **Name:** ${node.name}\n- **Relationship:** ${node.status ?? ""}\n- **Vault folder:** Product/Clients/${node.slug}/\n\nThis is a client from ${config.userName}'s Obsidian vault. Read the client.md and related notes to answer questions about this client.`;
      break;
    case "partner":
      prompt += `- **Type:** Partner\n- **Name:** ${node.name}\n- **Relationship:** ${node.status ?? ""}\n- **Vault folder:** Product/Partners/${node.slug}/\n\nThis is a partner from ${config.userName}'s Obsidian vault. Read the partner.md and related notes to answer questions about this partner.`;
      break;
    case "client-file":
      prompt += `- **Type:** Client file\n- **Client folder:** Product/Clients/${node.slug}/\n- **File:** ${node.filePath}\n\nThe user is viewing a specific file within a client folder. Read this file from the vault to answer questions about it.`;
      break;
    case "partner-file":
      prompt += `- **Type:** Partner file\n- **Partner folder:** Product/Partners/${node.slug}/\n- **File:** ${node.filePath}\n\nThe user is viewing a specific file within a partner folder. Read this file from the vault to answer questions about it.`;
      break;
    case "competitor":
      prompt += `- **Type:** Competitor profile\n- **Name:** ${node.name}\n- **Threat Level:** ${node.status ?? ""}\n- **Vault folder:** Business/Competitive Intelligence/competitors/${node.slug}/\n\nThe user is viewing a competitor profile in the Intelligence view. Read the profile.md and any signal files in the signals/ subfolder to answer questions. Also read Business/Strategy/strategic-context-snapshot.md for strategic context. Ground all analysis in Claimable's actual strategy.`;
      break;
    case "competitor-signal":
      prompt += `- **Type:** Competitor signal\n- **Signal:** ${node.name ?? ""}\n- **File:** Business/Competitive Intelligence/competitors/${node.slug}/signals/\n\nThe user is viewing a specific competitive intelligence signal. Read the signal file and the related competitor profile for context.`;
      break;
    case "briefing":
      prompt += `- **Type:** Daily briefing\n- **Date:** ${(node as any).date ?? ""}\n- **File:** Business/Competitive Intelligence/briefings/daily/${(node as any).date ?? ""}.md\n\nThe user is viewing a daily intelligence briefing. Read the briefing file to answer questions about it.`;
      break;
    case "intel-partnership":
      prompt += `- **Type:** Strategic partnership\n- **Name:** ${node.name}\n- **Status:** ${node.status ?? ""}\n- **Vault folder:** Business/Partnerships/${node.slug}/\n\nThe user is viewing a partnership in the Intelligence view. Read the partnership.md file and related context. Also read Business/Strategy/strategic-context-snapshot.md for strategic context.`;
      break;
    case "strategy-doc":
      prompt += `- **Type:** Strategy document\n- **Document:** ${(node as any).docType ?? ""}\n\nThe user is viewing a strategy document in the Intelligence view. This is a reference document from Business/Strategy/ or Business/Competitive Intelligence/.`;
      break;
    case "market-signal":
      prompt += `- **Type:** Market signal\n- **Signal:** ${node.name ?? ""}\n- **File:** Business/Competitive Intelligence/market/signals/\n\nThe user is viewing a market-level intelligence signal. Read the signal file for context.`;
      break;
  }

  const task = context?.selectedTask;
  if (task) {
    prompt += `\n\n## Currently selected task\nThe user has selected this task in the dashboard. When they refer to "this task" or "the task", they mean:\n`;
    prompt += `- **Text:** ${task.text}\n`;
    prompt += `- **Status:** ${task.completed ? "Completed" : "To Do"}\n`;
    prompt += `- **Category:** ${task.category}\n`;
    if (task.urgency) prompt += `- **Urgency:** ${task.urgency}\n`;
    if (task.betSlug) prompt += `- **Bet:** ${task.betSlug}\n`;
    if (task.jiraKey) prompt += `- **JIRA:** ${task.jiraKey}\n`;
    if (task.clientSlug) prompt += `- **Client:** ${task.clientSlug}\n`;
    if (task.partnerSlug) prompt += `- **Partner:** ${task.partnerSlug}\n`;
    prompt += `\nThe task lives in the file Tasks/${task.category}.md in the Obsidian vault.`;
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
app.use(prioritiesRouter);
app.use(intelRouter);

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

  // Helper to send an SSE event
  const sse = (event: string, payload: Record<string, unknown>) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
  };

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

      // Tool progress updates (elapsed time for running tools)
      if (message.type === "tool_progress") {
        const tp = message as any;
        sse("tool_progress", {
          id: tp.tool_use_id,
          name: tp.tool_name,
          elapsed: tp.elapsed_time_seconds,
        });
      }

      // Complete assistant messages — extract tool use results from content blocks
      if (message.type === "assistant") {
        const assistantMsg = (message as any).message;
        if (assistantMsg?.content) {
          for (const block of assistantMsg.content) {
            if (block.type === "tool_use") {
              // Tool started (from complete message — backup if stream_event missed it)
              sse("tool_start", { id: block.id, name: block.name });
            }
          }
        }
      }

      // Synthetic user messages carry tool results
      if (message.type === "user" && (message as any).tool_use_result !== undefined) {
        const userMsg = message as any;
        // Extract tool_use_id from the message content
        const content = userMsg.message?.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === "tool_result" && block.tool_use_id) {
              sse("tool_done", { id: block.tool_use_id });
            }
          }
        }
      }

      // Result message — final stats
      if (message.type === "result") {
        const result = message as any;
        sse("result", {
          costUsd: result.total_cost_usd ?? 0,
          inputTokens: result.usage?.input_tokens ?? 0,
          outputTokens: result.usage?.output_tokens ?? 0,
          durationMs: result.duration_ms ?? 0,
        });
      }

      if (message.type === "stream_event") {
        const event = (message as any).event;

        // Detect new message turn — insert paragraph break between turns
        if (event.type === "message_start" && accumulated.length > 0) {
          const separator = "\n\n";
          accumulated += separator;
          sse("delta", { text: separator });
        }

        // Content block start — detect thinking and tool_use blocks
        if (event.type === "content_block_start" && event.content_block) {
          if (event.content_block.type === "thinking") {
            sse("thinking_start", {});
          } else if (event.content_block.type === "tool_use") {
            sse("tool_start", { id: event.content_block.id, name: event.content_block.name });
          }
        }

        // Content block stop — mark thinking as done
        if (event.type === "content_block_stop") {
          // We track which block index this is; for simplicity just signal thinking_done
          // The frontend will close the current thinking block
          sse("thinking_done", {});
        }

        // Thinking deltas
        if (
          event.type === "content_block_delta" &&
          event.delta?.type === "thinking_delta"
        ) {
          sse("thinking", { text: event.delta.thinking });
        }

        // Text deltas (the actual response content)
        if (
          event.type === "content_block_delta" &&
          event.delta?.type === "text_delta"
        ) {
          accumulated += event.delta.text;
          sse("delta", { text: event.delta.text });
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
