import { Loader, Paper, Text } from "@mantine/core";
import { ScrollArea } from "@mantine/core";
import { useEffect, useRef } from "react";
import type { Message } from "~/types/chat";
import { MessageBubble } from "./MessageBubble";

interface MessageListProps {
  messages: Message[];
  isStreaming?: boolean;
}

export function MessageList({ messages, isStreaming }: MessageListProps) {
  const viewportRef = useRef<HTMLDivElement>(null);

  // Check if the last message is already a streaming assistant message
  const lastMsg = messages[messages.length - 1];
  const hasStreamingText = lastMsg?.role === "assistant" && isStreaming;
  const showThinking = isStreaming && !hasStreamingText;

  // Auto-scroll to the bottom when new content arrives
  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
  }, [messages, showThinking]);

  if (messages.length === 0 && !isStreaming) {
    return (
      <div className="flex h-full items-center justify-center text-[var(--mantine-color-dimmed)]">
        Send a message to get started.
      </div>
    );
  }

  return (
    <ScrollArea h="100%" viewportRef={viewportRef}>
      <div className="flex flex-col gap-4 p-4">
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}
        {showThinking && (
          <div className="flex justify-start">
            <Paper shadow="sm" radius="md" p="sm" bg="dark.6">
              <div className="flex items-center gap-2">
                <Loader size="xs" color="blue" type="dots" />
                <Text size="sm" c="dimmed">
                  Thinking...
                </Text>
              </div>
            </Paper>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
