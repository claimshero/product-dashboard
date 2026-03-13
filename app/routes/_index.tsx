import { useState, useCallback, useEffect, useRef } from "react";
import { ActionIcon, Tooltip } from "@mantine/core";
import { ChatInterface } from "~/components/ChatInterface";
import { DailyNotes } from "~/components/DailyNotes";
import { GitHubPRs } from "~/components/GitHubPRs";
import { JiraWork } from "~/components/JiraWork";
import { useConversations } from "~/hooks/useConversations";

const MIN_RIGHT_WIDTH = 360;
const MAX_RIGHT_WIDTH = 900;
const DEFAULT_RIGHT_WIDTH = 480;

const MIN_CHAT_WIDTH = 320;
const MAX_CHAT_WIDTH = 800;
const DEFAULT_CHAT_WIDTH = 420;

const STORAGE_KEY_CHAT_OPEN = "dashboard:chatOpen";
const STORAGE_KEY_CHAT_WIDTH = "dashboard:chatWidth";

function useDragResize(
  direction: "left" | "right",
  min: number,
  max: number,
  value: number,
  setValue: (v: number) => void
) {
  const dragging = useRef(false);

  const onDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;

      const onMouseMove = (ev: MouseEvent) => {
        if (!dragging.current) return;
        const newWidth =
          direction === "right"
            ? window.innerWidth - ev.clientX
            : ev.clientX;
        setValue(Math.max(min, Math.min(max, newWidth)));
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
    [direction, min, max, setValue]
  );

  return onDragStart;
}

function DragHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <div
      onMouseDown={onMouseDown}
      className="flex w-1.5 flex-shrink-0 cursor-col-resize items-center justify-center hover:bg-[var(--mantine-color-blue-9)] transition-colors"
      style={{ backgroundColor: "var(--mantine-color-dark-4)" }}
    />
  );
}

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

  const [rightWidth, setRightWidth] = useState(DEFAULT_RIGHT_WIDTH);
  const [chatWidth, setChatWidth] = useState(DEFAULT_CHAT_WIDTH);
  const [chatOpen, setChatOpen] = useState(false);

  // Persist chat state to localStorage
  useEffect(() => {
    try {
      const savedOpen = localStorage.getItem(STORAGE_KEY_CHAT_OPEN);
      const savedWidth = localStorage.getItem(STORAGE_KEY_CHAT_WIDTH);
      if (savedOpen !== null) setChatOpen(savedOpen === "true");
      if (savedWidth !== null) setChatWidth(Number(savedWidth));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CHAT_OPEN, String(chatOpen));
    } catch {}
  }, [chatOpen]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CHAT_WIDTH, String(chatWidth));
    } catch {}
  }, [chatWidth]);

  const onRightDrag = useDragResize("right", MIN_RIGHT_WIDTH, MAX_RIGHT_WIDTH, rightWidth, setRightWidth);
  const onChatDrag = useDragResize("left", MIN_CHAT_WIDTH, MAX_CHAT_WIDTH, chatWidth, setChatWidth);

  return (
    <div className="flex h-screen bg-[var(--mantine-color-dark-8)]">
      {/* Chat panel (left) */}
      {chatOpen && (
        <>
          <div className="flex flex-shrink-0 flex-col" style={{ width: chatWidth }}>
            <ChatInterface
              messages={displayMessages}
              isStreaming={isStreaming}
              onSendMessage={sendMessage}
              onStop={stopStreaming}
              onClose={() => setChatOpen(false)}
              conversations={conversations}
              activeConversationId={activeConversationId}
              onSelectConversation={selectConversation}
              onNewConversation={createNewConversation}
              onDeleteConversation={deleteConversation}
            />
          </div>
          <DragHandle onMouseDown={onChatDrag} />
        </>
      )}

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <JiraWork />
      </div>

      {/* Right sidebar: PRs + Daily Notes */}
      <DragHandle onMouseDown={onRightDrag} />
      <div
        className="flex flex-shrink-0 flex-col"
        style={{ width: rightWidth }}
      >
        <div className="h-[40%] border-b border-[var(--mantine-color-dark-4)]">
          <GitHubPRs />
        </div>
        <div className="flex-1 overflow-hidden">
          <DailyNotes />
        </div>
      </div>

      {/* Chat toggle button */}
      {!chatOpen && (
        <Tooltip label="Open chat" position="right">
          <ActionIcon
            variant="filled"
            color="blue"
            size="xl"
            radius="xl"
            onClick={() => setChatOpen(true)}
            style={{
              position: "fixed",
              bottom: 24,
              left: 24,
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
      )}
    </div>
  );
}
