import { useState, useEffect, useCallback, useRef } from "react";
import { ActionIcon, Text, Badge, Select, SegmentedControl, Tooltip } from "@mantine/core";
import { TaskList } from "./TaskList";
import { useAllTasks, useTaskCategories, createTaskApi, toggleTaskApi, deleteTaskApi, updateTaskDescriptionApi } from "~/hooks/useTasks";
import type { Task } from "~/types/tasks";
import type { BetSummary, JiraIdea, ClientPartnerSummary } from "~/types/navigation";
import type { DeliveryEpic } from "~/hooks/useDelivery";

function getChatUrl(p: string): string {
  if (typeof window === "undefined") return p;
  return `${window.location.protocol}//${window.location.hostname}:4001${p}`;
}

interface ComboboxGroup {
  group: string;
  items: { value: string; label: string }[];
}

interface TasksPanelProps {
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

function buildLinkOptions(
  bets: BetSummary[],
  ideas: JiraIdea[],
  epics: DeliveryEpic[],
  clients: ClientPartnerSummary[],
  partners: ClientPartnerSummary[],
): ComboboxGroup[] {
  const groups: ComboboxGroup[] = [];

  if (bets.length > 0) {
    groups.push({
      group: "Bets",
      items: bets.map((b) => ({ value: `bet:${b.slug}`, label: `🎯 ${b.name}` })),
    });
  }

  if (clients.length > 0) {
    groups.push({
      group: "Clients",
      items: clients.map((c) => ({ value: `client:${c.slug}`, label: `🏢 ${c.name}` })),
    });
  }

  if (partners.length > 0) {
    groups.push({
      group: "Partners",
      items: partners.map((p) => ({ value: `partner:${p.slug}`, label: `🤝 ${p.name}` })),
    });
  }

  if (ideas.length > 0) {
    groups.push({
      group: "Ideas",
      items: ideas.map((i) => ({ value: `jira:${i.key}`, label: `💡 ${i.key} — ${i.summary}` })),
    });
  }

  const epicItems: { value: string; label: string }[] = [];
  const storyItems: { value: string; label: string }[] = [];
  const seenEpicKeys = new Set<string>();
  for (const epic of epics) {
    if (seenEpicKeys.has(epic.key)) continue;
    seenEpicKeys.add(epic.key);
    epicItems.push({ value: `jira:${epic.key}`, label: `⚡ ${epic.key} — ${epic.summary}` });
    for (const child of epic.children) {
      storyItems.push({ value: `jira:${child.key}`, label: `📖 ${child.key} — ${child.summary}` });
    }
  }

  if (epicItems.length > 0) groups.push({ group: "Epics", items: epicItems });
  if (storyItems.length > 0) groups.push({ group: "Stories", items: storyItems });

  return groups;
}

/** Strip metadata tags from task text for clean display */
function cleanTaskTextForDetail(text: string): string {
  return text
    .replace(/\[\[[a-z0-9-]+\]\]/g, "")
    .replace(/(?:#|\[\[)[A-Z]+-\d+(?:\]\])?/g, "")
    .replace(/\{\{client:[a-z0-9-]+\}\}/g, "")
    .replace(/\{\{partner:[a-z0-9-]+\}\}/g, "")
    .replace(/\{\{urgency:(high|medium|low)\}\}/g, "")
    .replace(/\(created: \d{4}-\d{2}-\d{2}\)/g, "")
    .replace(/\(completed: \d{4}-\d{2}-\d{2}\)/g, "")
    .trim();
}

function TaskDetailView({
  task,
  bets,
  ideas,
  deliveryEpics,
  clients,
  partners,
  onDeselect,
  onDescriptionChange,
}: {
  task: Task;
  bets: BetSummary[];
  ideas: JiraIdea[];
  deliveryEpics: DeliveryEpic[];
  clients: ClientPartnerSummary[];
  partners: ClientPartnerSummary[];
  onDeselect?: () => void;
  onDescriptionChange?: (task: Task, description: string) => void;
}) {
  const [descText, setDescText] = useState(task.description);
  const saveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDescText(task.description);
  }, [task.id, task.description]);

  useEffect(() => {
    return () => {
      if (saveRef.current) clearTimeout(saveRef.current);
    };
  }, []);

  const handleDescChange = (value: string) => {
    setDescText(value);
    if (saveRef.current) clearTimeout(saveRef.current);
    saveRef.current = setTimeout(() => {
      onDescriptionChange?.(task, value);
    }, 800);
  };

  const bet = task.betSlug ? bets.find((b) => b.slug === task.betSlug) : null;
  const idea = task.jiraKey ? ideas.find((i) => i.key === task.jiraKey) : null;
  const epic = task.jiraKey ? deliveryEpics.find((e) => e.key === task.jiraKey) : null;
  const story = task.jiraKey
    ? deliveryEpics.flatMap((e) => e.children).find((c) => c.key === task.jiraKey)
    : null;
  const client = task.clientSlug ? clients.find((c) => c.slug === task.clientSlug) : null;
  const partner = task.partnerSlug ? partners.find((p) => p.slug === task.partnerSlug) : null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Text size="xs" fw={600} c="dimmed">Task Details</Text>
        {onDeselect && (
          <ActionIcon variant="subtle" color="gray" size="xs" onClick={onDeselect}>
            <span style={{ fontSize: 14 }}>&times;</span>
          </ActionIcon>
        )}
      </div>

      <Text size="sm" fw={500}>
        {task.urgency === "high" && <span>❗</span>}
        {cleanTaskTextForDetail(task.text)}
      </Text>

      <div className="flex flex-wrap gap-1.5">
        <Badge size="xs" variant="filled" color={task.completed ? "green" : "blue"}>
          {task.completed ? "Done" : "To Do"}
        </Badge>
        {task.urgency && (
          <Badge
            size="xs"
            variant="filled"
            color={task.urgency === "high" ? "red" : task.urgency === "medium" ? "yellow" : "gray"}
          >
            {task.urgency}
          </Badge>
        )}
        {bet && <Badge size="xs" variant="dot" color="yellow">{bet.name}</Badge>}
        {task.jiraKey && (
          <Badge
            size="xs"
            variant="dot"
            color="blue"
            component="a"
            href={`https://claimable.atlassian.net/browse/${task.jiraKey}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ cursor: "pointer", textDecoration: "none" }}
          >
            {task.jiraKey}
            {idea && ` — ${idea.summary}`}
            {epic && ` — ${epic.summary}`}
            {story && ` — ${story.summary}`}
          </Badge>
        )}
        {client && <Badge size="xs" variant="dot" color="teal">{client.name}</Badge>}
        {partner && <Badge size="xs" variant="dot" color="grape">{partner.name}</Badge>}
        <Badge size="xs" variant="light" color="gray">{task.category}</Badge>
        {task.createdDate && <Text size="xs" c="dimmed">Created: {task.createdDate}</Text>}
        {task.completedDate && <Text size="xs" c="dimmed">Completed: {task.completedDate}</Text>}
      </div>

      <div>
        <Text size="xs" fw={600} c="dimmed" className="mb-1">Description</Text>
        <textarea
          value={descText}
          onChange={(e) => handleDescChange(e.target.value)}
          placeholder="Add a description..."
          rows={4}
          className="w-full rounded border border-[var(--mantine-color-dark-4)] bg-[var(--mantine-color-dark-6)] px-2 py-1.5 text-sm outline-none resize-y"
          style={{ color: "var(--mantine-color-dark-0)", fontFamily: "monospace", fontSize: 13 }}
        />
      </div>
    </div>
  );
}

export function TasksPanel({
  bets,
  ideas,
  deliveryEpics,
  clients,
  partners,
  onTaskClick,
  onTasksChanged,
  selectedTask,
  onDeselectTask,
}: TasksPanelProps) {
  const [statusFilter, setStatusFilter] = useState<"open" | "completed" | "all">("open");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [urgencyFilter, setUrgencyFilter] = useState<string | null>(null);
  const [newTaskText, setNewTaskText] = useState("");
  const [newTaskLink, setNewTaskLink] = useState<string | null>(null);

  const filters = {
    status: statusFilter as "open" | "completed" | "all",
    category: categoryFilter ?? undefined,
    urgency: urgencyFilter ?? undefined,
  };

  const { tasks, loading, refresh } = useAllTasks(filters);
  const { categories, refresh: refreshCategories } = useTaskCategories();

  const linkOptions = buildLinkOptions(bets, ideas, deliveryEpics, clients, partners);

  const categoryOptions = categories.map((c) => ({ value: c, label: c }));

  const handleToggleTask = async (task: Task) => {
    await toggleTaskApi(task.category, task.lineIndex);
    await refresh();
    onTasksChanged?.();
  };

  const handleDeleteTask = async (task: Task) => {
    await deleteTaskApi(task.category, task.lineIndex);
    await refresh();
    onTasksChanged?.();
  };

  const handleAddTask = async () => {
    const text = newTaskText.trim();
    if (!text) return;

    let betSlug: string | undefined;
    let jiraKey: string | undefined;
    let clientSlug: string | undefined;
    let partnerSlug: string | undefined;

    if (newTaskLink) {
      if (newTaskLink.startsWith("bet:")) betSlug = newTaskLink.slice(4);
      else if (newTaskLink.startsWith("jira:")) jiraKey = newTaskLink.slice(5);
      else if (newTaskLink.startsWith("client:")) clientSlug = newTaskLink.slice(7);
      else if (newTaskLink.startsWith("partner:")) partnerSlug = newTaskLink.slice(8);
    }

    await createTaskApi(text, { betSlug, jiraKey, clientSlug, partnerSlug });
    setNewTaskText("");
    setNewTaskLink(null);
    await refresh();
    await refreshCategories();
    onTasksChanged?.();
  };

  const handleDescriptionChange = async (task: Task, description: string) => {
    await updateTaskDescriptionApi(task.category, task.lineIndex, description);
    await refresh();
  };

  return (
    <div className="flex h-full flex-col bg-[var(--mantine-color-dark-7)]">
      {/* Filters */}
      <div
        className="flex-shrink-0 border-b px-4 py-3"
        style={{ borderColor: "var(--mantine-color-dark-4)" }}
      >
        <div className="flex flex-col gap-1.5">
          <SegmentedControl
            size="xs"
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as "open" | "completed" | "all")}
            data={[
              { value: "open", label: "To Do" },
              { value: "completed", label: "Done" },
              { value: "all", label: "All" },
            ]}
            styles={{
              root: { backgroundColor: "var(--mantine-color-dark-6)" },
            }}
          />
          <div className="flex gap-1.5">
            <Select
              size="xs"
              placeholder="Category"
              data={categoryOptions}
              value={categoryFilter}
              onChange={setCategoryFilter}
              clearable
              searchable
              className="flex-1"
              styles={{
                input: {
                  backgroundColor: "var(--mantine-color-dark-6)",
                  border: "1px solid var(--mantine-color-dark-4)",
                },
              }}
            />
            <Select
              size="xs"
              placeholder="Urgency"
              data={[
                { value: "high", label: "High" },
                { value: "medium", label: "Medium" },
                { value: "low", label: "Low" },
              ]}
              value={urgencyFilter}
              onChange={setUrgencyFilter}
              clearable
              className="flex-1"
              styles={{
                input: {
                  backgroundColor: "var(--mantine-color-dark-6)",
                  border: "1px solid var(--mantine-color-dark-4)",
                },
              }}
            />
          </div>
        </div>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {loading ? (
          <Text size="xs" c="dimmed" className="px-2 py-1">Loading...</Text>
        ) : (
          <>
            {tasks.length > 0 && (
              <div className="mb-3">
                <TaskList
                  tasks={tasks}
                  onToggle={handleToggleTask}
                  onDelete={handleDeleteTask}
                  onTaskClick={onTaskClick}
                  selectedTaskId={selectedTask?.id}
                />
              </div>
            )}

            {tasks.length === 0 && (
              <Text size="xs" c="dimmed" className="px-2 py-1 mb-3">
                No tasks match filters
              </Text>
            )}

            {/* Add task */}
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTaskText}
                  onChange={(e) => setNewTaskText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleAddTask();
                    }
                  }}
                  placeholder="Add a task..."
                  className="flex-1 rounded border border-[var(--mantine-color-dark-4)] bg-[var(--mantine-color-dark-6)] px-2 py-1.5 text-sm outline-none"
                  style={{ color: "var(--mantine-color-dark-0)" }}
                />
                <ActionIcon
                  variant="light"
                  color="blue"
                  size="md"
                  onClick={handleAddTask}
                  disabled={!newTaskText.trim()}
                >
                  <span style={{ fontSize: 16 }}>+</span>
                </ActionIcon>
              </div>
              <Select
                size="xs"
                placeholder="Link to... (optional)"
                data={linkOptions}
                value={newTaskLink}
                onChange={setNewTaskLink}
                clearable
                searchable
                styles={{
                  input: {
                    backgroundColor: "var(--mantine-color-dark-6)",
                    border: "1px solid var(--mantine-color-dark-4)",
                  },
                }}
              />
            </div>
          </>
        )}
      </div>

      {/* Task detail panel */}
      <div
        className="flex-shrink-0 border-t px-4 py-3 overflow-y-auto"
        style={{ borderColor: "var(--mantine-color-dark-4)", maxHeight: "40%" }}
      >
        {selectedTask ? (
          <TaskDetailView
            task={selectedTask}
            bets={bets}
            ideas={ideas}
            deliveryEpics={deliveryEpics}
            clients={clients}
            partners={partners}
            onDeselect={onDeselectTask}
            onDescriptionChange={handleDescriptionChange}
          />
        ) : (
          <Text size="xs" c="dimmed">Click a task to see details</Text>
        )}
      </div>
    </div>
  );
}
