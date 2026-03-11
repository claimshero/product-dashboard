import express from "express";
import cors from "cors";
import { query } from "@anthropic-ai/claude-agent-sdk";

const app = express();
const PORT = process.env.CHAT_PORT ?? 3001;

app.use(cors());
app.use(express.json());

// Track the current session ID for multi-turn conversation
let currentSessionId: string | undefined;

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/chat", async (req, res) => {
  const { prompt } = req.body as { prompt?: string };

  if (!prompt || typeof prompt !== "string") {
    res.status(400).json({ error: "prompt is required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    for await (const message of query({
      prompt,
      options: {
        permissionMode: "bypassPermissions",
        includePartialMessages: true,
        ...(currentSessionId ? { resume: currentSessionId } : {}),
      },
    })) {
      // Capture session ID from the init message
      if (message.type === "system" && message.subtype === "init") {
        currentSessionId = (message as any).session_id;
      }

      if (message.type === "stream_event") {
        const event = (message as any).event;
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          const data = JSON.stringify({ text: event.delta.text });
          res.write(`event: delta\ndata: ${data}\n\n`);
        }
      }
    }

    res.write(`event: done\ndata: {}\n\n`);
    res.end();
  } catch (err) {
    console.error("Chat query error:", err);
    // If resume failed, clear session and let next request start fresh
    currentSessionId = undefined;
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
