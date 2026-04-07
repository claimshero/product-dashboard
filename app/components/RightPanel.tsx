import { useState, useCallback } from "react";
import { SegmentedControl, Text } from "@mantine/core";
import { DailyNotes } from "./DailyNotes";
import { TasksPanel } from "./TasksPanel";
import type { Task } from "~/types/tasks";
import type { BetSummary, JiraIdea, ClientPartnerSummary } from "~/types/navigation";
import type { DeliveryEpic } from "~/hooks/useDelivery";

interface RightPanelProps {
  bets: BetSummary[];
  ideas: JiraIdea[];
  deliveryEpics: DeliveryEpic[];
  clients: ClientPartnerSummary[];
  partners: ClientPartnerSummary[];
  onTaskClick?: (task: Task) => void;
  onTasksChanged?: () => void;
  selectedTask?: Task | null;
  onDeselectTask?: () => void;
}

export function RightPanel({
  bets,
  ideas,
  deliveryEpics,
  clients,
  partners,
  onTaskClick,
  onTasksChanged,
  selectedTask,
  onDeselectTask,
}: RightPanelProps) {
  const [activeTab, setActiveTab] = useState<"tasks" | "daily">("tasks");

  const handleSwitchToTasks = useCallback((category?: string) => {
    setActiveTab("tasks");
    // Category filtering happens in TasksPanel via its own state
  }, []);

  return (
    <div className="flex h-full flex-col bg-[var(--mantine-color-dark-7)]">
      {/* Tab switcher header */}
      <div
        className="flex items-center justify-between border-b px-4 py-2"
        style={{ borderColor: "var(--mantine-color-dark-4)" }}
      >
        <SegmentedControl
          size="xs"
          value={activeTab}
          onChange={(v) => setActiveTab(v as "tasks" | "daily")}
          data={[
            { value: "tasks", label: "Tasks" },
            { value: "daily", label: "Daily Notes" },
          ]}
          styles={{
            root: { backgroundColor: "var(--mantine-color-dark-6)" },
          }}
        />
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "tasks" ? (
          <TasksPanel
            bets={bets}
            ideas={ideas}
            deliveryEpics={deliveryEpics}
            clients={clients}
            partners={partners}
            onTaskClick={onTaskClick}
            onTasksChanged={onTasksChanged}
            selectedTask={selectedTask}
            onDeselectTask={onDeselectTask}
          />
        ) : (
          <DailyNotes
            onSwitchToTasks={handleSwitchToTasks}
          />
        )}
      </div>
    </div>
  );
}
