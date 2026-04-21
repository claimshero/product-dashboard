import { useState, useCallback, useEffect, useRef } from "react";
import { ChatInterface } from "~/components/ChatInterface";
import { RightPanel } from "~/components/RightPanel";
import { ItemDetails } from "~/components/ItemDetails";
import { NavTree } from "~/components/NavTree";
import { IntelNavTree } from "~/components/IntelNavTree";
import { SettingsDrawer } from "~/components/SettingsDrawer";
import { ContentView } from "~/components/ContentView";
import { IntelligenceView } from "~/components/IntelligenceView";
import { useBets } from "~/hooks/useBets";
import { useDelivery, type SelectedItem } from "~/hooks/useDelivery";
import { useIdeas } from "~/hooks/useIdeas";
import { useConversations, type ChatContext } from "~/hooks/useConversations";
import { useAllTasks } from "~/hooks/useTasks";
import { useMeetings } from "~/hooks/useMeetings";
import { useClientsPartners } from "~/hooks/useClientsPartners";
import { usePriorities } from "~/hooks/usePriorities";
import { useCompetitors, useBriefings, useWeeklyBriefings, useIntelPartnerships, useMarketSignals } from "~/hooks/useIntel";
import type { NavNode } from "~/types/navigation";
import { navNodeToSelectedItem } from "~/types/navigation";
import type { Task } from "~/types/tasks";

export type ViewMode = "intelligence" | "discovery" | "delivery";

// --- Layout constants ---

const MIN_LEFT_WIDTH = 240;
const MAX_LEFT_WIDTH = 500;
const DEFAULT_LEFT_WIDTH = 300;

const MIN_RIGHT_WIDTH = 360;
const MAX_RIGHT_WIDTH = 900;
const DEFAULT_RIGHT_WIDTH = 480;

const MIN_CHAT_HEIGHT = 48;
const MAX_CHAT_HEIGHT = 600;
const DEFAULT_CHAT_HEIGHT = 280;

const STORAGE_KEY_LEFT_WIDTH = "dashboard:leftWidth";
const STORAGE_KEY_RIGHT_WIDTH = "dashboard:rightWidth";
const STORAGE_KEY_CHAT_HEIGHT = "dashboard:chatHeight";
const STORAGE_KEY_CHAT_EXPANDED = "dashboard:chatExpanded";
const STORAGE_KEY_VIEW_MODE = "dashboard:viewMode";

// --- Drag resize hooks ---

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

function useDragResizeVertical(
  min: number,
  max: number,
  value: number,
  setValue: (v: number) => void
) {
  const dragging = useRef(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const onDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;

      const onMouseMove = (ev: MouseEvent) => {
        if (!dragging.current || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const newHeight = rect.bottom - ev.clientY;
        setValue(Math.max(min, Math.min(max, newHeight)));
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
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
    },
    [min, max, setValue]
  );

  return { onDragStart, containerRef };
}

// --- Drag handles ---

function DragHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <div
      onMouseDown={onMouseDown}
      className="flex w-1.5 flex-shrink-0 cursor-col-resize items-center justify-center hover:bg-[var(--mantine-color-blue-9)] transition-colors"
      style={{ backgroundColor: "var(--mantine-color-dark-4)" }}
    />
  );
}

function HorizontalDragHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <div
      onMouseDown={onMouseDown}
      className="flex h-1.5 flex-shrink-0 cursor-row-resize items-center justify-center hover:bg-[var(--mantine-color-blue-9)] transition-colors"
      style={{ backgroundColor: "var(--mantine-color-dark-4)" }}
    />
  );
}

// --- Main component ---

export default function Index() {
  const chatContextRef = useRef<ChatContext | null>(null);
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
  } = useConversations(chatContextRef);

  // Data hooks
  const { bets, loading: betsLoading, refresh: refreshBets } = useBets();
  const { epics: deliveryEpics, loading: deliveryLoading } = useDelivery();
  const { ideas, loading: ideasLoading, refresh: refreshIdeas } = useIdeas();

  // Task hooks
  const { tasks: openTasks, refresh: refreshOpenTasks } = useAllTasks({ status: "open" });

  // Meeting hooks
  const { meetings, refresh: refreshMeetings } = useMeetings();

  // Client/Partner hooks
  const { clients, partners, refresh: refreshClientsPartners } = useClientsPartners();
  const { priorities, updateList: updatePriorityList } = usePriorities();

  // Intelligence hooks
  const { competitors, refresh: refreshCompetitors } = useCompetitors();
  const { briefings, refresh: refreshBriefings } = useBriefings();
  const { briefings: weeklyBriefings, refresh: refreshWeeklyBriefings } = useWeeklyBriefings();
  const { partnerships: intelPartnerships, refresh: refreshIntelPartnerships } = useIntelPartnerships();
  const { signals: marketSignals, refresh: refreshMarketSignals } = useMarketSignals();

  // Auto-refresh all data when chat streaming finishes (agent may have written files)
  const wasStreamingRef = useRef(false);
  useEffect(() => {
    if (wasStreamingRef.current && !isStreaming) {
      // Streaming just ended — refresh everything after a short delay
      const timer = setTimeout(() => {
        refreshBets();
        refreshIdeas();
        refreshOpenTasks();
        refreshMeetings();
        refreshClientsPartners();
        refreshCompetitors();
        refreshBriefings();
        refreshIntelPartnerships();
        refreshMarketSignals();
      }, 500);
      return () => clearTimeout(timer);
    }
    wasStreamingRef.current = isStreaming;
  }, [isStreaming, refreshBets, refreshIdeas, refreshOpenTasks, refreshMeetings, refreshClientsPartners, refreshCompetitors, refreshBriefings, refreshIntelPartnerships, refreshMarketSignals]);

  // Layout state
  const [leftWidth, setLeftWidth] = useState(DEFAULT_LEFT_WIDTH);
  const [rightWidth, setRightWidth] = useState(DEFAULT_RIGHT_WIDTH);
  const [chatHeight, setChatHeight] = useState(DEFAULT_CHAT_HEIGHT);
  const [chatExpanded, setChatExpanded] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("discovery");

  // Selection state
  const [selectedNode, setSelectedNode] = useState<NavNode | null>(null);
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Sync selectedItem from selectedNode (for the right panel)
  useEffect(() => {
    if (selectedNode) {
      const item = navNodeToSelectedItem(selectedNode);
      if (item) setSelectedItem(item);
    }
  }, [selectedNode]);

  // Keep chat context ref in sync with current nav selection and selected task
  useEffect(() => {
    chatContextRef.current = {
      selectedNode: selectedNode ?? null,
      selectedTask: selectedTask ? {
        id: selectedTask.id,
        text: selectedTask.text,
        completed: selectedTask.completed,
        betSlug: selectedTask.betSlug,
        jiraKey: selectedTask.jiraKey,
        clientSlug: selectedTask.clientSlug,
        partnerSlug: selectedTask.partnerSlug,
        urgency: selectedTask.urgency,
        category: selectedTask.category,
      } : null,
    };
  }, [selectedNode, selectedTask]);

  // Restore persisted state
  useEffect(() => {
    try {
      const savedLeft = localStorage.getItem(STORAGE_KEY_LEFT_WIDTH);
      const savedRight = localStorage.getItem(STORAGE_KEY_RIGHT_WIDTH);
      const savedChat = localStorage.getItem(STORAGE_KEY_CHAT_HEIGHT);
      const savedChatExpanded = localStorage.getItem(STORAGE_KEY_CHAT_EXPANDED);
      if (savedLeft !== null) setLeftWidth(Number(savedLeft));
      if (savedRight !== null) setRightWidth(Number(savedRight));
      if (savedChat !== null) setChatHeight(Number(savedChat));
      if (savedChatExpanded !== null) setChatExpanded(savedChatExpanded === "true");
      const savedViewMode = localStorage.getItem(STORAGE_KEY_VIEW_MODE);
      if (savedViewMode === "intelligence" || savedViewMode === "discovery" || savedViewMode === "delivery") {
        setViewMode(savedViewMode);
      }
    } catch {}
  }, []);

  // Persist state
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_LEFT_WIDTH, String(leftWidth)); } catch {}
  }, [leftWidth]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_RIGHT_WIDTH, String(rightWidth)); } catch {}
  }, [rightWidth]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_CHAT_HEIGHT, String(chatHeight)); } catch {}
  }, [chatHeight]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_CHAT_EXPANDED, String(chatExpanded)); } catch {}
  }, [chatExpanded]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_VIEW_MODE, viewMode); } catch {}
  }, [viewMode]);

  // Drag handlers
  const onLeftDrag = useDragResize("left", MIN_LEFT_WIDTH, MAX_LEFT_WIDTH, leftWidth, setLeftWidth);
  const onRightDrag = useDragResize("right", MIN_RIGHT_WIDTH, MAX_RIGHT_WIDTH, rightWidth, setRightWidth);
  const { onDragStart: onChatDrag, containerRef: centerRef } = useDragResizeVertical(
    MIN_CHAT_HEIGHT,
    MAX_CHAT_HEIGHT,
    chatHeight,
    setChatHeight
  );

  const handleRefresh = () => {
    refreshBets();
    refreshIdeas();
    refreshOpenTasks();
    refreshMeetings();
    refreshClientsPartners();
    refreshCompetitors();
    refreshBriefings();
    refreshIntelPartnerships();
    refreshMarketSignals();
  };

  const handleIntelRefresh = () => {
    refreshCompetitors();
    refreshBriefings();
    refreshWeeklyBriefings();
    refreshIntelPartnerships();
    refreshMarketSignals();
  };

  // Clear selection when switching view modes
  const handleViewModeChange = (mode: string) => {
    setViewMode(mode as ViewMode);
    setSelectedNode(null);
    setSelectedItem(null);
    setSelectedTask(null);
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    // Try client/partner first
    if (task.clientSlug) {
      const client = clients.find((c) => c.slug === task.clientSlug);
      if (client) {
        setSelectedNode({ type: "client", slug: client.slug, name: client.name, relationship: client.relationship });
        return;
      }
    }
    if (task.partnerSlug) {
      const partner = partners.find((p) => p.slug === task.partnerSlug);
      if (partner) {
        setSelectedNode({ type: "partner", slug: partner.slug, name: partner.name, relationship: partner.relationship });
        return;
      }
    }
    // Try bet slug
    if (task.betSlug) {
      const bet = bets.find((b) => b.slug === task.betSlug);
      if (bet) {
        setSelectedNode({ type: "bet", slug: bet.slug, name: bet.name, status: bet.status });
        return;
      }
    }
    if (task.jiraKey) {
      // Search ideas
      const idea = ideas.find((i) => i.key === task.jiraKey);
      if (idea) {
        setSelectedNode({
          type: "jira-idea",
          key: idea.key,
          summary: idea.summary,
          status: idea.status,
          statusCategory: idea.statusCategory,
          url: idea.url,
        });
        return;
      }
      // Search delivery epics
      const epic = deliveryEpics.find((e) => e.key === task.jiraKey);
      if (epic) {
        setSelectedNode({
          type: "jira-epic",
          key: epic.key,
          summary: epic.summary,
          status: epic.status,
          statusCategory: epic.statusCategory,
          url: `https://claimable.atlassian.net/browse/${epic.key}`,
          issueType: "Epic",
        });
        return;
      }
      // Search stories within delivery epics
      for (const ep of deliveryEpics) {
        for (const child of ep.children) {
          if (child.key === task.jiraKey) {
            setSelectedNode({
              type: "jira-story",
              key: child.key,
              summary: child.summary,
              status: child.status,
              statusCategory: child.statusCategory,
              url: `https://claimable.atlassian.net/browse/${child.key}`,
              issueType: child.issueType,
            });
            return;
          }
          // Check sub-stories
          for (const sub of child.children ?? []) {
            if (sub.key === task.jiraKey) {
              setSelectedNode({
                type: "jira-story",
                key: sub.key,
                summary: sub.summary,
                status: sub.status,
                statusCategory: sub.statusCategory,
                url: `https://claimable.atlassian.net/browse/${sub.key}`,
                issueType: sub.issueType,
              });
              return;
            }
          }
        }
      }
    }
  };

  return (
    <div className="flex h-screen bg-[var(--mantine-color-dark-8)]">
      {/* Left: Mode selector + NavTree */}
      <div className="flex flex-shrink-0 flex-col" style={{ width: leftWidth }}>
        <ViewModeSwitcher
          viewMode={viewMode}
          onChange={handleViewModeChange}
          onOpenSettings={() => setSettingsOpen(true)}
        />
        {viewMode === "intelligence" ? (
          <IntelNavTree
            competitors={competitors}
            briefings={briefings}
            weeklyBriefings={weeklyBriefings}
            partnerships={intelPartnerships}
            marketSignals={marketSignals}
            selectedNode={selectedNode}
            onSelectNode={setSelectedNode}
            loading={false}
            onRefresh={handleIntelRefresh}
          />
        ) : (
          <NavTree
            bets={bets}
            ideas={ideas}
            deliveryEpics={deliveryEpics}
            meetings={meetings}
            clients={clients}
            partners={partners}
            selectedNode={selectedNode}
            onSelectNode={setSelectedNode}
            loading={betsLoading || ideasLoading}
            onRefresh={handleRefresh}
            priorities={priorities}
            onPriorityChange={updatePriorityList}
          />
        )}
      </div>
      <DragHandle onMouseDown={onLeftDrag} />

      {/* Center: Content + Chat */}
      <div ref={centerRef} className="flex flex-1 flex-col overflow-hidden">
        {/* Content area (flex-1) */}
        <div className="flex-1 overflow-hidden">
          {viewMode === "intelligence" ? (
            <IntelligenceView
              selectedNode={selectedNode}
              latestBriefingDate={briefings.length > 0 ? briefings[0].date : null}
            />
          ) : (
            <ContentView
              selectedNode={selectedNode}
              selectedItem={selectedItem}
              onOpenSettings={() => setSettingsOpen(true)}
            />
          )}
        </div>

        {/* Chat area */}
        <HorizontalDragHandle onMouseDown={onChatDrag} />
        <div
          className="flex flex-shrink-0 flex-col overflow-hidden"
          style={{ height: chatExpanded ? chatHeight : MIN_CHAT_HEIGHT }}
        >
          {chatExpanded ? (
            <ChatInterface
              messages={displayMessages}
              isStreaming={isStreaming}
              onSendMessage={sendMessage}
              onStop={stopStreaming}
              onClose={() => setChatExpanded(false)}
              conversations={conversations}
              activeConversationId={activeConversationId}
              onSelectConversation={selectConversation}
              onNewConversation={createNewConversation}
              onDeleteConversation={deleteConversation}
            />
          ) : (
            <CollapsedChat
              onExpand={() => setChatExpanded(true)}
              onSendMessage={sendMessage}
              isStreaming={isStreaming}
            />
          )}
        </div>
      </div>

      {/* Right: Tasks / Daily Notes */}
      <DragHandle onMouseDown={onRightDrag} />
      <div className="flex flex-shrink-0 flex-col" style={{ width: rightWidth }}>
        <RightPanel
          bets={bets}
          ideas={ideas}
          deliveryEpics={deliveryEpics}
          clients={clients}
          partners={partners}
          onTaskClick={handleTaskClick}
          onTasksChanged={refreshOpenTasks}
          selectedTask={selectedTask}
          onDeselectTask={() => setSelectedTask(null)}
        />
      </div>

      <SettingsDrawer opened={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

/** View mode switcher — prominent selector at top of left panel */
function ViewModeSwitcher({
  viewMode,
  onChange,
  onOpenSettings,
}: {
  viewMode: ViewMode;
  onChange: (mode: string) => void;
  onOpenSettings: () => void;
}) {
  const modes: { value: ViewMode; label: string; color: string }[] = [
    { value: "intelligence", label: "Intelligence", color: "var(--mantine-color-violet-6)" },
    { value: "discovery", label: "Discovery", color: "var(--mantine-color-blue-6)" },
    { value: "delivery", label: "Delivery", color: "var(--mantine-color-green-6)" },
  ];

  return (
    <div
      className="flex flex-col gap-1 border-b px-2 py-2"
      style={{
        borderColor: "var(--mantine-color-dark-4)",
        backgroundColor: "var(--mantine-color-dark-8)",
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--mantine-color-dark-3)" }}>
          Mode
        </span>
        <button
          onClick={onOpenSettings}
          className="flex items-center justify-center border-none bg-transparent cursor-pointer p-0.5"
          style={{ color: "var(--mantine-color-dark-3)" }}
          title="Settings"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </div>
      <div className="flex gap-1">
        {modes.map((mode) => {
          const active = viewMode === mode.value;
          return (
            <button
              key={mode.value}
              onClick={() => onChange(mode.value)}
              className="flex-1 rounded px-1 py-1.5 text-xs font-medium border-none cursor-pointer transition-all"
              style={{
                backgroundColor: active ? mode.color : "var(--mantine-color-dark-6)",
                color: active ? "white" : "var(--mantine-color-dark-1)",
                opacity: active ? 1 : 0.7,
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.opacity = "1";
                  e.currentTarget.style.backgroundColor = "var(--mantine-color-dark-5)";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.opacity = "0.7";
                  e.currentTarget.style.backgroundColor = "var(--mantine-color-dark-6)";
                }
              }}
            >
              {mode.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Collapsed chat bar — shows just an input and expand button */
function CollapsedChat({
  onExpand,
  onSendMessage,
  isStreaming,
}: {
  onExpand: () => void;
  onSendMessage: (prompt: string) => void;
  isStreaming: boolean;
}) {
  const [value, setValue] = useState("");

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || isStreaming) return;
    onSendMessage(trimmed);
    setValue("");
    onExpand();
  };

  return (
    <div
      className="flex h-full items-center gap-2 px-3"
      style={{ backgroundColor: "var(--mantine-color-dark-7)", borderTop: "1px solid var(--mantine-color-dark-4)" }}
    >
      <button
        onClick={onExpand}
        className="flex items-center justify-center border-none bg-transparent cursor-pointer p-1"
        style={{ color: "var(--mantine-color-dark-1)" }}
        title="Expand chat"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="17 11 12 6 7 11" />
          <polyline points="17 18 12 13 7 18" />
        </svg>
      </button>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
          }
        }}
        placeholder="Ask Claude a question..."
        className="flex-1 rounded border-none bg-transparent px-2 py-1 text-sm outline-none"
        style={{ color: "var(--mantine-color-dark-0)", caretColor: "var(--mantine-color-blue-5)" }}
      />
    </div>
  );
}
