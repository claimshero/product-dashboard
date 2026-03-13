import { Paper } from "@mantine/core";
import Markdown from "react-markdown";
import type { Message } from "~/types/chat";

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <Paper
        shadow="sm"
        radius="md"
        p="sm"
        className="max-w-[80%]"
        bg={isUser ? "blue.8" : "dark.6"}
      >
        {isUser ? (
          <div
            className="text-sm text-white"
            style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
          >
            {message.content}
          </div>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none text-[var(--mantine-color-gray-1)]">
            <Markdown>{message.content}</Markdown>
          </div>
        )}
      </Paper>
    </div>
  );
}
