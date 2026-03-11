import { ChatInterface } from "~/components/ChatInterface";
import { ConversationSidebar } from "~/components/ConversationSidebar";
import { useConversations } from "~/hooks/useConversations";

export default function Index() {
  const {
    conversations,
    activeConversationId,
    displayMessages,
    isStreaming,
    sendMessage,
    selectConversation,
    createNewConversation,
    deleteConversation,
  } = useConversations();

  return (
    <div className="flex h-screen bg-[var(--mantine-color-dark-8)]">
      <div className="w-72 flex-shrink-0 border-r border-[var(--mantine-color-dark-4)]">
        <ConversationSidebar
          conversations={conversations}
          activeId={activeConversationId}
          onSelect={selectConversation}
          onNew={createNewConversation}
          onDelete={deleteConversation}
        />
      </div>
      <div className="flex flex-1 flex-col">
        <ChatInterface
          messages={displayMessages}
          isStreaming={isStreaming}
          onSendMessage={sendMessage}
        />
      </div>
    </div>
  );
}
