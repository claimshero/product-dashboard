import { useCallback, useEffect, useRef, useState } from "react";
import type { ConversationSummary, Message } from "~/types/chat";

function getChatUrl(path: string): string {
  if (typeof window === "undefined") return path;
  return `${window.location.protocol}//${window.location.hostname}:4001${path}`;
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
    date: string;
  } | null;
}

export function useConversations(contextRef?: React.RefObject<ChatContext | null>) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStreamedText, setCurrentStreamedText] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const initialLoadDone = useRef(false);

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
        setCurrentStreamedText("");
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
          // Select the most recent remaining conversation, or clear
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
    async (prompt: string) => {
      if (isStreaming) return;

      // Optimistically add the user message to the display
      setMessages((prev) => [...prev, { role: "user", content: prompt }]);
      setIsStreaming(true);
      setCurrentStreamedText("");

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch(getChatUrl("/api/chat"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            conversationId: activeConversationId ?? undefined,
            context: contextRef?.current ?? undefined,
          }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`Server returned ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";
        let buffer = "";

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
              if (eventType === "meta") {
                try {
                  const parsed = JSON.parse(data) as {
                    conversationId: string;
                    title: string;
                  };
                  setActiveConversationId(parsed.conversationId);
                } catch {
                  // Skip malformed JSON
                }
              } else if (eventType === "delta") {
                try {
                  const parsed = JSON.parse(data) as { text: string };
                  accumulated += parsed.text;
                  setCurrentStreamedText(accumulated);
                } catch {
                  // Skip malformed JSON
                }
              } else if (eventType === "error") {
                try {
                  const parsed = JSON.parse(data) as { error: string };
                  accumulated += `\n[Error: ${parsed.error}]`;
                  setCurrentStreamedText(accumulated);
                } catch {
                  // Skip malformed JSON
                }
              }
              eventType = "";
            }
          }
        }

        // Move accumulated text into messages
        if (accumulated) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: accumulated },
          ]);
        }

        // Refresh the conversation list (new conversation may have been created,
        // or updatedAt may have changed)
        await fetchConversations();

        // Re-fetch after a delay to pick up auto-generated title
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
        setCurrentStreamedText("");
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [isStreaming, activeConversationId, fetchConversations]
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
    ...(isStreaming && currentStreamedText
      ? [{ role: "assistant" as const, content: currentStreamedText }]
      : []),
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
