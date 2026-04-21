import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Attachment,
  ConversationSummary,
  Message,
  MessageBlock,
  ResultStats,
} from "~/types/chat";
import type { PendingAttachment } from "~/components/ChatInput";

function getChatUrl(path: string): string {
  if (typeof window === "undefined") return path;
  return `${window.location.protocol}//${window.location.hostname}:4001${path}`;
}

/** Derive a client-side Attachment preview from a PendingAttachment so the user
 *  message renders immediately before the server responds. */
function toPreviewAttachment(p: PendingAttachment): Attachment {
  const kind: Attachment["kind"] = p.file.type.startsWith("image/")
    ? "image"
    : p.file.type === "application/pdf"
      ? "document"
      : p.file.type.startsWith("text/")
        ? "text"
        : "document";
  return {
    id: p.id,
    filename: p.file.name,
    mimeType: p.file.type || "application/octet-stream",
    size: p.file.size,
    kind,
    // Object URL works for the user's current session; on reload the server URL takes over.
    url: p.previewUrl ?? "",
  };
}

export interface ChatContext {
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

/** Mutable state accumulated during streaming — avoids React re-renders for every SSE event */
interface StreamAccumulator {
  textContent: string;
  blocks: MessageBlock[];
  activeTools: Map<string, { name: string; elapsed: number }>;
  isThinking: boolean;
  thinkingText: string;
  result: ResultStats | null;
}

function createAccumulator(): StreamAccumulator {
  return {
    textContent: "",
    blocks: [],
    activeTools: new Map(),
    isThinking: false,
    thinkingText: "",
    result: null,
  };
}

export function useConversations(contextRef?: React.RefObject<ChatContext | null>) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamMessage, setStreamMessage] = useState<Message | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const initialLoadDone = useRef(false);
  const accRef = useRef<StreamAccumulator>(createAccumulator());
  const rafRef = useRef<number | null>(null);

  // Schedule a React state update at most once per animation frame
  const scheduleUpdate = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const acc = accRef.current;
      setStreamMessage({
        role: "assistant",
        content: acc.textContent,
        blocks: [...acc.blocks],
        result: acc.result ?? undefined,
      });
    });
  }, []);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch(getChatUrl("/api/conversations"));
      if (res.ok) {
        const data = (await res.json()) as ConversationSummary[];
        setConversations(data);
        return data;
      }
    } catch (err) {
      console.error("Failed to fetch conversations:", err);
    }
    return [];
  }, []);

  const selectConversation = useCallback(async (id: string) => {
    try {
      const res = await fetch(getChatUrl(`/api/conversations/${id}`));
      if (res.ok) {
        const data = await res.json();
        setActiveConversationId(id);
        setMessages(data.messages ?? []);
      }
    } catch (err) {
      console.error("Failed to load conversation:", err);
    }
  }, []);

  const createNewConversation = useCallback(async () => {
    try {
      const res = await fetch(getChatUrl("/api/conversations"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Chat" }),
      });
      if (res.ok) {
        const conv = (await res.json()) as ConversationSummary & { messages?: Message[] };
        setActiveConversationId(conv.id);
        setMessages([]);
        setStreamMessage(null);
        await fetchConversations();
      }
    } catch (err) {
      console.error("Failed to create conversation:", err);
    }
  }, [fetchConversations]);

  const deleteConversation = useCallback(
    async (id: string) => {
      try {
        await fetch(getChatUrl(`/api/conversations/${id}`), {
          method: "DELETE",
        });
        const updated = await fetchConversations();
        if (activeConversationId === id) {
          if (updated.length > 0) {
            await selectConversation(updated[0].id);
          } else {
            createNewConversation();
          }
        }
      } catch (err) {
        console.error("Failed to delete conversation:", err);
      }
    },
    [activeConversationId, fetchConversations, selectConversation, createNewConversation]
  );

  const sendMessage = useCallback(
    async (prompt: string, attachments: PendingAttachment[] = []) => {
      if (isStreaming) return;

      // Optimistically add the user message to the display, with preview attachments
      const previewAttachments = attachments.map(toPreviewAttachment);
      setMessages((prev) => [
        ...prev,
        {
          role: "user",
          content: prompt,
          ...(previewAttachments.length ? { attachments: previewAttachments } : {}),
        },
      ]);
      setIsStreaming(true);
      setStreamMessage(null);
      accRef.current = createAccumulator();

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const formData = new FormData();
        formData.append("prompt", prompt);
        if (activeConversationId) {
          formData.append("conversationId", activeConversationId);
        }
        if (contextRef?.current) {
          formData.append("context", JSON.stringify(contextRef.current));
        }
        for (const a of attachments) {
          formData.append("attachments", a.file, a.file.name);
        }

        const response = await fetch(getChatUrl("/api/chat"), {
          method: "POST",
          body: formData,
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`Server returned ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        const acc = accRef.current;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE lines from buffer
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          let eventType = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7);
            } else if (line.startsWith("data: ")) {
              const data = line.slice(6);
              try {
                const parsed = JSON.parse(data);
                switch (eventType) {
                  case "meta": {
                    setActiveConversationId(parsed.conversationId);
                    break;
                  }
                  case "thinking_start": {
                    acc.isThinking = true;
                    acc.thinkingText = "";
                    acc.blocks.push({ type: "thinking", content: "", done: false });
                    scheduleUpdate();
                    break;
                  }
                  case "thinking": {
                    acc.thinkingText += parsed.text;
                    // Update the last thinking block
                    for (let j = acc.blocks.length - 1; j >= 0; j--) {
                      if (acc.blocks[j].type === "thinking") {
                        (acc.blocks[j] as Extract<MessageBlock, { type: "thinking" }>).content = acc.thinkingText;
                        break;
                      }
                    }
                    scheduleUpdate();
                    break;
                  }
                  case "thinking_done": {
                    acc.isThinking = false;
                    for (let j = acc.blocks.length - 1; j >= 0; j--) {
                      if (acc.blocks[j].type === "thinking") {
                        (acc.blocks[j] as Extract<MessageBlock, { type: "thinking" }>).done = true;
                        break;
                      }
                    }
                    scheduleUpdate();
                    break;
                  }
                  case "tool_start": {
                    acc.activeTools.set(parsed.id, { name: parsed.name, elapsed: 0 });
                    acc.blocks.push({
                      type: "tool_use",
                      id: parsed.id,
                      name: parsed.name,
                      status: "running",
                    });
                    scheduleUpdate();
                    break;
                  }
                  case "tool_progress": {
                    const tool = acc.activeTools.get(parsed.id);
                    if (tool) {
                      tool.elapsed = parsed.elapsed;
                    }
                    const progressBlock = acc.blocks.find(
                      (b) => b.type === "tool_use" && b.id === parsed.id
                    );
                    if (progressBlock && progressBlock.type === "tool_use") {
                      progressBlock.elapsed = parsed.elapsed;
                    }
                    scheduleUpdate();
                    break;
                  }
                  case "tool_done": {
                    acc.activeTools.delete(parsed.id);
                    const doneToolBlock = acc.blocks.find(
                      (b) => b.type === "tool_use" && b.id === parsed.id
                    );
                    if (doneToolBlock && doneToolBlock.type === "tool_use") {
                      doneToolBlock.status = "done";
                    }
                    scheduleUpdate();
                    break;
                  }
                  case "delta": {
                    acc.textContent += parsed.text;
                    // Find or create the last text block
                    const lastBlock = acc.blocks[acc.blocks.length - 1];
                    if (lastBlock && lastBlock.type === "text") {
                      lastBlock.content = acc.textContent;
                    } else {
                      acc.blocks.push({ type: "text", content: acc.textContent });
                    }
                    scheduleUpdate();
                    break;
                  }
                  case "result": {
                    acc.result = {
                      costUsd: parsed.costUsd,
                      inputTokens: parsed.inputTokens,
                      outputTokens: parsed.outputTokens,
                      durationMs: parsed.durationMs,
                    };
                    scheduleUpdate();
                    break;
                  }
                  case "error": {
                    acc.textContent += `\n[Error: ${parsed.error}]`;
                    const errBlock = acc.blocks[acc.blocks.length - 1];
                    if (errBlock && errBlock.type === "text") {
                      errBlock.content = acc.textContent;
                    } else {
                      acc.blocks.push({ type: "text", content: acc.textContent });
                    }
                    scheduleUpdate();
                    break;
                  }
                }
              } catch {
                // Skip malformed JSON
              }
              eventType = "";
            }
          }
        }

        // Move accumulated text into persisted messages
        if (acc.textContent) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: acc.textContent },
          ]);
        }

        // Refresh the conversation list
        await fetchConversations();
        setTimeout(() => fetchConversations(), 3000);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          const errorMsg =
            err instanceof Error ? err.message : "Unknown error";
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: `[Error: ${errorMsg}]` },
          ]);
        }
      } finally {
        setStreamMessage(null);
        setIsStreaming(false);
        abortRef.current = null;
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      }
    },
    [isStreaming, activeConversationId, fetchConversations, scheduleUpdate]
  );

  // Initial load: fetch conversations and auto-select the most recent
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

    fetchConversations().then((list) => {
      if (list.length > 0) {
        selectConversation(list[0].id);
      }
    });
  }, [fetchConversations, selectConversation]);

  // Build display messages including the in-progress streaming message
  const displayMessages: Message[] = [
    ...messages,
    ...(streamMessage ? [streamMessage] : []),
  ];

  const stopStreaming = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
  }, []);

  return {
    conversations,
    activeConversationId,
    displayMessages,
    isStreaming,
    sendMessage,
    stopStreaming,
    selectConversation,
    createNewConversation,
    deleteConversation,
  };
}
