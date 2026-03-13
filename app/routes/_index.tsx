import { useState, useCallback, useRef } from "react";
import { ActionIcon, Tooltip, Modal } from "@mantine/core";
import { ChatInterface } from "~/components/ChatInterface";
import { ConversationSidebar } from "~/components/ConversationSidebar";
import { DailyNotes } from "~/components/DailyNotes";
import { GitHubPRs } from "~/components/GitHubPRs";
import { JiraWork } from "~/components/JiraWork";
import { useConversations } from "~/hooks/useConversations";

const MIN_SIDEBAR_WIDTH = 360;
const MAX_SIDEBAR_WIDTH = 900;
const DEFAULT_SIDEBAR_WIDTH = 480;

export default function Index() {
  const {
    conversations,
    activeConversationId,
    displayMessages,
    isStreaming,
    sendMessage,
    stopStreaming,
    selectConversation,
    createNewConversation,
    deleteConversation,
  } = useConversations();

  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [chatOpen, setChatOpen] = useState(false);
  const dragging = useRef(false);

  const onDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;

      const onMouseMove = (ev: MouseEvent) => {
        if (!dragging.current) return;
        const newWidth = window.innerWidth - ev.clientX;
        setSidebarWidth(
          Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, newWidth))
        );
      };

      const onMouseUp = () => {
        dragging.current = false;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    []
  );

  return (
    <div className="flex h-screen bg-[var(--mantine-color-dark-8)]">
      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <JiraWork />
      </div>

      {/* Right sidebar: PRs + Daily Notes */}
      {/* Drag handle */}
      <div
        onMouseDown={onDragStart}
        className="flex w-1.5 flex-shrink-0 cursor-col-resize items-center justify-center hover:bg-[var(--mantine-color-blue-9)] transition-colors"
        style={{ backgroundColor: "var(--mantine-color-dark-4)" }}
      />
      <div
        className="flex flex-shrink-0 flex-col"
        style={{ width: sidebarWidth }}
      >
        <div className="h-[40%] border-b border-[var(--mantine-color-dark-4)]">
          <GitHubPRs />
        </div>
        <div className="flex-1 overflow-hidden">
          <DailyNotes />
        </div>
      </div>

      {/* Chat button */}
      <Tooltip label="Open chat" position="left">
        <ActionIcon
          variant="filled"
          color="blue"
          size="xl"
          radius="xl"
          onClick={() => setChatOpen(true)}
          style={{
            position: "fixed",
            bottom: 24,
            right: sidebarWidth + 24,
            zIndex: 100,
            width: 48,
            height: 48,
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </ActionIcon>
      </Tooltip>

      {/* Chat overlay */}
      <Modal
        opened={chatOpen}
        onClose={() => setChatOpen(false)}
        fullScreen
        withCloseButton={false}
        padding={0}
        styles={{
          content: {
            backgroundColor: "var(--mantine-color-dark-8)",
          },
          body: {
            height: "100%",
            padding: 0,
          },
        }}
      >
        <div className="flex h-screen">
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
            {/* Close button */}
            <div className="flex items-center justify-end border-b border-[var(--mantine-color-dark-4)] px-4 py-2">
              <Tooltip label="Close chat">
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="lg"
                  onClick={() => setChatOpen(false)}
                >
                  <span style={{ fontSize: 20 }}>&times;</span>
                </ActionIcon>
              </Tooltip>
            </div>
            <div className="flex-1 overflow-hidden">
              <ChatInterface
                messages={displayMessages}
                isStreaming={isStreaming}
                onSendMessage={sendMessage}
                onStop={stopStreaming}
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
