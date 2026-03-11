import { useCallback, useRef, useState } from "react";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStreamedText, setCurrentStreamedText] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const handleSubmit = useCallback(
    async (prompt: string) => {
      if (isStreaming) return;

      // Append the user message
      setMessages((prev) => [...prev, { role: "user", content: prompt }]);
      setIsStreaming(true);
      setCurrentStreamedText("");

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        // Connect directly to the chat server (separate process from Vite)
        const chatUrl = typeof window !== "undefined"
          ? `${window.location.protocol}//${window.location.hostname}:3001/api/chat`
          : "/api/chat";
        const response = await fetch(chatUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
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
          // Keep the last potentially incomplete line in the buffer
          buffer = lines.pop() ?? "";

          let eventType = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7);
            } else if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (eventType === "delta") {
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
    [isStreaming]
  );

  // Build the display messages list, including the in-progress streaming message
  const displayMessages: Message[] = [
    ...messages,
    ...(isStreaming && currentStreamedText
      ? [{ role: "assistant" as const, content: currentStreamedText }]
      : []),
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-hidden">
        <MessageList messages={displayMessages} />
      </div>
      <div className="p-4">
        <ChatInput onSubmit={handleSubmit} disabled={isStreaming} />
      </div>
    </div>
  );
}
