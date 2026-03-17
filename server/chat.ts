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
import { dailyNotesRouter } from "./daily-notes.js";
import { githubPRsRouter } from "./github-prs.js";
import { jiraRouter } from "./jira.js";
import { scheduledTasksRouter } from "./scheduled-tasks-router.js";
import { startScheduler } from "./scheduler.js";
import { loadTaskDefinitions, createTaskDefinitionWithId } from "./scheduled-tasks.js";

const app = express();
const PORT = process.env.CHAT_PORT ?? 4001;

const OBSIDIAN_VAULT_PATH =
  "/Users/trevorr/Library/CloudStorage/GoogleDrive-richardson.trev@gmail.com/My Drive/Trevor/Second Brain/Second Brain";

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
app.use(dailyNotesRouter);
app.use(githubPRsRouter);
app.use(jiraRouter);
app.use(scheduledTasksRouter);

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
  const { prompt, conversationId } = req.body as {
    prompt?: string;
    conversationId?: string;
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
        additionalDirectories: [OBSIDIAN_VAULT_PATH],
        mcpServers,
        systemPrompt: `You are a personal work dashboard assistant. You have access to the user's Obsidian vault at "${OBSIDIAN_VAULT_PATH}". When the user asks questions about their notes, search and read files from this vault using Grep, Glob, and Read tools. The vault contains markdown files organized as a "Second Brain" knowledge base. You also have access to MCP servers for Jira (Atlassian), Postgres, and other integrations.`,
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
  if (tasks.some((t) => t.id === DAILY_BRIEFING_ID)) return;

  const now = new Date().toISOString();
  createTaskDefinitionWithId({
    id: DAILY_BRIEFING_ID,
    name: "Daily Briefing",
    description: "Morning summary of racing, healthcare appeals, market news, and Slack research channel",
    schedule: "0 7 * * 1-5",
    enabled: true,
    prompt: `Generate my daily briefing for {{date}}. Include the following sections:

## 🏎️ Racing News
Search for the latest F1 and IndyCar news from the past 24 hours. Focus on:
- Lando Norris and McLaren developments
- Lewis Hamilton and Ferrari developments
- Technical car development, regulation changes, and engineering innovations
- Race results, qualifying, or practice sessions if any occurred
- Team strategy and driver market news
- Any notable IndyCar news

## 🏥 Healthcare Appeals & Regulation
Search for the latest news in the healthcare space, specifically:
- New laws, proposed legislation, or regulatory changes related to healthcare appeals (insurance claim denials, prior authorization, independent review)
- Court rulings or legal developments affecting the appeals process
- CMS, HHS, or state insurance commissioner actions impacting appeals
- Payer policy changes around denials and appeals workflows
- Any major healthcare industry news that could affect the appeals landscape

## 📈 Industry Movement
Search for major business and market activity in healthcare, RCM (revenue cycle management), and appeals:
- M&A, funding rounds, or IPOs involving RCM companies, health tech, or payer/provider organizations
- Earnings or financial news from major players (UnitedHealth, Elevance, R1 RCM, Waystar, etc.)
- New product launches, partnerships, or market entries in the appeals/denials management space
- Industry reports or analyst coverage on RCM trends, denial rates, or appeals volumes

## 💼 Work Updates
Use the Slack MCP tools to read recent messages from the #research channel. Summarize:
- Healthcare appeals discussions and insights
- Competitor analysis and mentions
- New laws or regulatory changes in the health/insurance ecosystem
- Key decisions or action items from the team

Format each section with clear bullet points. Be concise but informative. If you cannot access Slack, note that and focus on the other sections.`,
    systemPrompt: `You are a personal briefing assistant. Gather real-time information using web search and any available Slack/MCP tools, then produce a concise daily summary. Use markdown formatting. Today's date is {{date}}.`,
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
