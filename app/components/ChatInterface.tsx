import type { Message } from "~/types/chat";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";

interface ChatInterfaceProps {
  messages: Message[];
  isStreaming: boolean;
  onSendMessage: (prompt: string) => void;
}

export function ChatInterface({
  messages,
  isStreaming,
  onSendMessage,
}: ChatInterfaceProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-hidden">
        <MessageList messages={messages} />
      </div>
      <div className="p-4">
        <ChatInput onSubmit={onSendMessage} disabled={isStreaming} />
      </div>
    </div>
  );
}
