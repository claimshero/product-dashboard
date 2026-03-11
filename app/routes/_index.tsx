import { useState } from "react";
import { ActionIcon, Tooltip } from "@mantine/core";
import { ChatInterface } from "~/components/ChatInterface";
import { ConversationSidebar } from "~/components/ConversationSidebar";
import { DailyNotes } from "~/components/DailyNotes";
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

  const [showNotes, setShowNotes] = useState(true);

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
      {/* Daily Notes Panel */}
      {showNotes && (
        <div className="w-[480px] flex-shrink-0 border-l border-[var(--mantine-color-dark-4)]">
          <DailyNotes />
        </div>
      )}
      {/* Toggle button */}
      <Tooltip label={showNotes ? "Hide daily notes" : "Show daily notes"} position="left">
        <ActionIcon
          variant="filled"
          color="dark.5"
          size="lg"
          onClick={() => setShowNotes((v) => !v)}
          style={{
            position: "fixed",
            bottom: 16,
            right: showNotes ? 488 : 16,
            zIndex: 100,
            border: "1px solid var(--mantine-color-dark-4)",
          }}
        >
          <span style={{ fontSize: 16 }}>{showNotes ? "»" : "«"}</span>
        </ActionIcon>
      </Tooltip>
    </div>
  );
}
