import { ScrollArea } from "@mantine/core";
import { useEffect, useRef } from "react";
import type { Message } from "./ChatInterface";
import { MessageBubble } from "./MessageBubble";

interface MessageListProps {
  messages: Message[];
}

export function MessageList({ messages }: MessageListProps) {
  const viewportRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom when new content arrives
  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
  }, [messages]);

  if (messages.length === 0) {
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
      </div>
    </ScrollArea>
  );
}
