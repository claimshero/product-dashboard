import { useState } from "react";
import { ActionIcon, Tooltip } from "@mantine/core";
import { ChatInterface } from "~/components/ChatInterface";
import { ConversationSidebar } from "~/components/ConversationSidebar";
import { DailyNotes } from "~/components/DailyNotes";
import { GitHubPRs } from "~/components/GitHubPRs";
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

  const [showSidebar, setShowSidebar] = useState(true);

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
      {/* Right sidebar: PRs + Daily Notes */}
      {showSidebar && (
        <div className="flex w-[480px] flex-shrink-0 flex-col border-l border-[var(--mantine-color-dark-4)]">
          <div className="h-[40%] border-b border-[var(--mantine-color-dark-4)]">
            <GitHubPRs />
          </div>
          <div className="flex-1 overflow-hidden">
            <DailyNotes />
          </div>
        </div>
      )}
      {/* Toggle button */}
      <Tooltip label={showSidebar ? "Hide sidebar" : "Show sidebar"} position="left">
        <ActionIcon
          variant="filled"
          color="dark.5"
          size="lg"
          onClick={() => setShowSidebar((v) => !v)}
          style={{
            position: "fixed",
            top: 16,
            right: showSidebar ? 488 : 16,
            zIndex: 100,
            border: "1px solid var(--mantine-color-dark-4)",
          }}
        >
          <span style={{ fontSize: 16 }}>{showSidebar ? "\u00BB" : "\u00AB"}</span>
        </ActionIcon>
      </Tooltip>
    </div>
  );
}
