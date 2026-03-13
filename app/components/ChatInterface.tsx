import { ActionIcon, Menu, Text, Tooltip } from "@mantine/core";
import type { ConversationSummary, Message } from "~/types/chat";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";

interface ChatInterfaceProps {
  messages: Message[];
  isStreaming: boolean;
  onSendMessage: (prompt: string) => void;
  onStop?: () => void;
  onClose?: () => void;
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
}

export function ChatInterface({
  messages,
  isStreaming,
  onSendMessage,
  onStop,
  onClose,
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
}: ChatInterfaceProps) {
  const activeConv = conversations.find((c) => c.id === activeConversationId);

  return (
    <div className="flex h-full flex-col bg-[var(--mantine-color-dark-7)]">
      {/* Header: conversation picker + actions */}
      <div className="flex items-center gap-2 border-b border-[var(--mantine-color-dark-4)] px-3 py-2">
        <Menu shadow="md" width={280} position="bottom-start">
          <Menu.Target>
            <button className="flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-1 text-left hover:bg-[var(--mantine-color-dark-5)] transition-colors">
              <Text size="sm" fw={500} c="gray.2" lineClamp={1} className="flex-1">
                {activeConv?.title ?? "New Chat"}
              </Text>
              <span style={{ fontSize: 10, color: "var(--mantine-color-dimmed)" }}>&#9660;</span>
            </button>
          </Menu.Target>
          <Menu.Dropdown bg="dark.7">
            <Menu.Item
              onClick={onNewConversation}
              leftSection={<span style={{ fontSize: 14 }}>+</span>}
            >
              New Chat
            </Menu.Item>
            {conversations.length > 0 && <Menu.Divider />}
            {conversations.map((conv) => (
              <Menu.Item
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                bg={conv.id === activeConversationId ? "dark.5" : undefined}
                rightSection={
                  <ActionIcon
                    size="xs"
                    variant="subtle"
                    color="red"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteConversation(conv.id);
                    }}
                  >
                    <span style={{ fontSize: 12 }}>&times;</span>
                  </ActionIcon>
                }
              >
                <Text size="sm" lineClamp={1}>
                  {conv.title}
                </Text>
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>

        <Tooltip label="New chat">
          <ActionIcon variant="subtle" color="gray" size="sm" onClick={onNewConversation}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </ActionIcon>
        </Tooltip>

        {onClose && (
          <Tooltip label="Close chat">
            <ActionIcon variant="subtle" color="gray" size="sm" onClick={onClose}>
              <span style={{ fontSize: 16 }}>&times;</span>
            </ActionIcon>
          </Tooltip>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-hidden">
        <MessageList messages={messages} isStreaming={isStreaming} />
      </div>

      {/* Input */}
      <div className="p-3">
        <ChatInput onSubmit={onSendMessage} onStop={onStop} isStreaming={isStreaming} />
      </div>
    </div>
  );
}
