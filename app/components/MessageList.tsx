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
  const sentinelRef = useRef<HTMLDivElement>(null);
  const isAtBottom = useRef(true);

  // Check if the last message has any content (text or blocks)
  const lastMsg = messages[messages.length - 1];
  const hasStreamingContent =
    lastMsg?.role === "assistant" &&
    isStreaming &&
    (lastMsg.content || (lastMsg.blocks && lastMsg.blocks.length > 0));
  const showWaiting = isStreaming && !hasStreamingContent;

  // Track whether user is scrolled to the bottom via IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const viewport = viewportRef.current;
    if (!sentinel || !viewport) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        isAtBottom.current = entry.isIntersecting;
      },
      { root: viewport, threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  // Auto-scroll only when user is already at the bottom
  useEffect(() => {
    if (viewportRef.current && isAtBottom.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
  }, [messages, showWaiting]);

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
          <MessageBubble
            key={i}
            message={msg}
            isStreaming={isStreaming && i === messages.length - 1}
          />
        ))}
        {showWaiting && (
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
        <div ref={sentinelRef} style={{ height: 1 }} />
      </div>
    </ScrollArea>
  );
}
