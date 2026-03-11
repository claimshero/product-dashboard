import { Paper, Text } from "@mantine/core";
import type { Message } from "./ChatInterface";

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
        <Text
          size="sm"
          c={isUser ? "white" : "gray.1"}
          style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
        >
          {message.content}
        </Text>
      </Paper>
    </div>
  );
}
