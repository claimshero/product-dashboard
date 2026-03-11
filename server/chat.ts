import express from "express";
import cors from "cors";
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

const app = express();
const PORT = process.env.CHAT_PORT ?? 3001;

const OBSIDIAN_VAULT_PATH =
  "/Users/trevorr/Library/CloudStorage/GoogleDrive-richardson.trev@gmail.com/My Drive/Trevor/Second Brain/Second Brain";

app.use(cors());
app.use(express.json());
app.use(dailyNotesRouter);

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

// --- Chat streaming endpoint ---

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

  try {
    for await (const message of query({
      prompt,
      options: {
        permissionMode: "bypassPermissions",
        includePartialMessages: true,
        additionalDirectories: [OBSIDIAN_VAULT_PATH],
        systemPrompt: `You are a personal work dashboard assistant. You have access to the user's Obsidian vault at "${OBSIDIAN_VAULT_PATH}". When the user asks questions about their notes, search and read files from this vault using Grep, Glob, and Read tools. The vault contains markdown files organized as a "Second Brain" knowledge base.`,
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
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          accumulated += event.delta.text;
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

app.listen(PORT, () => {
  console.log(`Chat server running at http://localhost:${PORT}`);
});
