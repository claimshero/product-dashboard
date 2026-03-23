import { useState, useEffect, useCallback, useRef } from "react";
import { ActionIcon, Button, Text, Badge, Tooltip, Select, SegmentedControl } from "@mantine/core";
import { TaskList } from "./TaskList";
import type { Task } from "~/types/tasks";
import type { BetSummary, JiraIdea, ClientPartnerSummary } from "~/types/navigation";
import type { DeliveryEpic } from "~/hooks/useDelivery";

function getChatUrl(p: string): string {
  if (typeof window === "undefined") return p;
  return `${window.location.protocol}//${window.location.hostname}:4001${p}`;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

interface DailySections {
  exists: boolean;
  focus: string[];
  tasks: Task[];
  notes: string[];
}

interface ComboboxGroup {
  group: string;
  items: { value: string; label: string }[];
}

interface DailyNotesProps {
  bets: BetSummary[];
  ideas: JiraIdea[];
  deliveryEpics: DeliveryEpic[];
  clients: ClientPartnerSummary[];
  partners: ClientPartnerSummary[];
  onTaskClick?: (task: Task) => void;
  onDateChange?: (date: string) => void;
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

/** Build filter options from the unique related items across all tasks */
function buildRelatedFilterOptions(tasks: Task[]): { value: string; label: string }[] {
  const seen = new Set<string>();
  const options: { value: string; label: string }[] = [];

  for (const task of tasks) {
    if (task.betSlug && !seen.has(`bet:${task.betSlug}`)) {
      seen.add(`bet:${task.betSlug}`);
      options.push({ value: `bet:${task.betSlug}`, label: `Bet: ${task.betSlug}` });
    }
    if (task.jiraKey && !seen.has(`jira:${task.jiraKey}`)) {
      seen.add(`jira:${task.jiraKey}`);
      options.push({ value: `jira:${task.jiraKey}`, label: task.jiraKey });
    }
    if (task.clientSlug && !seen.has(`client:${task.clientSlug}`)) {
      seen.add(`client:${task.clientSlug}`);
      options.push({ value: `client:${task.clientSlug}`, label: `Client: ${task.clientSlug}` });
    }
    if (task.partnerSlug && !seen.has(`partner:${task.partnerSlug}`)) {
      seen.add(`partner:${task.partnerSlug}`);
      options.push({ value: `partner:${task.partnerSlug}`, label: `Partner: ${task.partnerSlug}` });
    }
  }

  return options;
}

/** Strip metadata tags from task text for clean display */
function cleanTaskTextForDetail(text: string): string {
  return text
    .replace(/\[\[[a-z0-9-]+\]\]/g, "")
    .replace(/#[A-Z]+-\d+/g, "")
    .replace(/\{\{client:[a-z0-9-]+\}\}/g, "")
    .replace(/\{\{partner:[a-z0-9-]+\}\}/g, "")
    .replace(/\{\{urgency:(high|medium|low)\}\}/g, "")
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

  // Sync local state when task changes
  useEffect(() => {
    setDescText(task.description);
  }, [task.id, task.description]);

  // Cleanup on unmount
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
          <Badge size="xs" variant="dot" color="blue">
            {task.jiraKey}
            {idea && ` — ${idea.summary}`}
            {epic && ` — ${epic.summary}`}
            {story && ` — ${story.summary}`}
          </Badge>
        )}
        {client && <Badge size="xs" variant="dot" color="teal">{client.name}</Badge>}
        {partner && <Badge size="xs" variant="dot" color="grape">{partner.name}</Badge>}
        <Text size="xs" c="dimmed">{task.date}</Text>
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

export function DailyNotes({ bets, ideas, deliveryEpics, clients, partners, onTaskClick, onDateChange, onTasksChanged, selectedTask, onDeselectTask }: DailyNotesProps) {
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [sections, setSections] = useState<DailySections>({ exists: false, focus: [], tasks: [], notes: [] });
  const [loading, setLoading] = useState(false);
  const [newTaskText, setNewTaskText] = useState("");
  const [newTaskLink, setNewTaskLink] = useState<string | null>(null);

  // Task filters
  const [statusFilter, setStatusFilter] = useState<"todo" | "done" | "all">("todo");
  const [relatedFilter, setRelatedFilter] = useState<string | null>(null);
  const [urgencyFilter, setUrgencyFilter] = useState<string | null>(null);

  const isToday = selectedDate === todayStr();

  const fetchSections = useCallback(async (date: string) => {
    setLoading(true);
    try {
      const res = await fetch(getChatUrl(`/api/daily-sections/${date}`));
      if (res.ok) {
        const data = await res.json();
        setSections(data);
      }
    } catch (err) {
      console.error("Failed to fetch sections:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const createFromTemplate = useCallback(async () => {
    try {
      await fetch(getChatUrl(`/api/daily-notes/${selectedDate}`), { method: "POST" });
      await fetchSections(selectedDate);
    } catch (err) {
      console.error("Failed to create note:", err);
    }
  }, [selectedDate, fetchSections]);

  useEffect(() => {
    fetchSections(selectedDate);
    onDateChange?.(selectedDate);
  }, [selectedDate, fetchSections, onDateChange]);

  // Toggle task
  const handleToggleTask = async (task: Task) => {
    await fetch(getChatUrl(`/api/tasks/${task.date}/${task.lineIndex}/toggle`), { method: "PUT" });
    await fetchSections(selectedDate);
    onTasksChanged?.();
  };

  // Delete task
  const handleDeleteTask = async (task: Task) => {
    await fetch(getChatUrl(`/api/tasks/${task.date}/${task.lineIndex}`), { method: "DELETE" });
    await fetchSections(selectedDate);
    onTasksChanged?.();
  };

  // Add task
  const handleAddTask = async () => {
    const text = newTaskText.trim();
    if (!text) return;

    let betSlug: string | undefined;
    let jiraKey: string | undefined;
    let clientSlug: string | undefined;
    let partnerSlug: string | undefined;

    if (newTaskLink) {
      if (newTaskLink.startsWith("bet:")) {
        betSlug = newTaskLink.slice(4);
      } else if (newTaskLink.startsWith("jira:")) {
        jiraKey = newTaskLink.slice(5);
      } else if (newTaskLink.startsWith("client:")) {
        clientSlug = newTaskLink.slice(7);
      } else if (newTaskLink.startsWith("partner:")) {
        partnerSlug = newTaskLink.slice(8);
      }
    }

    await fetch(getChatUrl(`/api/tasks/${selectedDate}`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, betSlug, jiraKey, clientSlug, partnerSlug }),
    });
    setNewTaskText("");
    setNewTaskLink(null);
    await fetchSections(selectedDate);
    onTasksChanged?.();
  };

  // Update task description
  const handleDescriptionChange = async (task: Task, description: string) => {
    await fetch(getChatUrl(`/api/tasks/${task.date}/${task.lineIndex}/description`), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description }),
    });
    await fetchSections(selectedDate);
  };

  const goToToday = () => setSelectedDate(todayStr());
  const goToPrev = () => setSelectedDate((d) => shiftDate(d, -1));
  const goToNext = () => setSelectedDate((d) => shiftDate(d, 1));

  const linkOptions = buildLinkOptions(bets, ideas, deliveryEpics, clients, partners);

  // Apply task filters
  const filteredTasks = sections.tasks.filter((task) => {
    // Status filter
    if (statusFilter === "todo" && task.completed) return false;
    if (statusFilter === "done" && !task.completed) return false;

    // Related item filter
    if (relatedFilter) {
      const matchesBet = task.betSlug && `bet:${task.betSlug}` === relatedFilter;
      const matchesJira = task.jiraKey && `jira:${task.jiraKey}` === relatedFilter;
      const matchesClient = task.clientSlug && `client:${task.clientSlug}` === relatedFilter;
      const matchesPartner = task.partnerSlug && `partner:${task.partnerSlug}` === relatedFilter;
      if (!matchesBet && !matchesJira && !matchesClient && !matchesPartner) return false;
    }

    // Urgency filter
    if (urgencyFilter && task.urgency !== urgencyFilter) return false;

    return true;
  });

  return (
    <div className="flex h-full flex-col bg-[var(--mantine-color-dark-7)]">
      {/* Header */}
      <div
        className="flex items-center justify-between border-b px-4 py-2"
        style={{ borderColor: "var(--mantine-color-dark-4)" }}
      >
        <Text size="sm" fw={600} c="gray.2">Daily Notes</Text>
      </div>

      {/* Date Navigation */}
      <div
        className="flex items-center justify-center gap-3 border-b px-4 py-2"
        style={{ borderColor: "var(--mantine-color-dark-4)" }}
      >
        <Tooltip label="Previous day">
          <ActionIcon variant="subtle" color="gray" onClick={goToPrev} size="sm">
            <span style={{ fontSize: 16 }}>&larr;</span>
          </ActionIcon>
        </Tooltip>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded border border-[var(--mantine-color-dark-4)] bg-[var(--mantine-color-dark-6)] px-2 py-1 text-sm text-[var(--mantine-color-gray-3)]"
          />
          <Text size="xs" c="dimmed">{formatDisplayDate(selectedDate)}</Text>
        </div>

        <Tooltip label="Next day">
          <ActionIcon variant="subtle" color="gray" onClick={goToNext} size="sm">
            <span style={{ fontSize: 16 }}>&rarr;</span>
          </ActionIcon>
        </Tooltip>

        {!isToday && (
          <Tooltip label="Go to today">
            <ActionIcon variant="light" color="blue" onClick={goToToday} size="sm">
              <span style={{ fontSize: 12 }}>Today</span>
            </ActionIcon>
          </Tooltip>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Text c="dimmed">Loading...</Text>
        </div>
      ) : !sections.exists ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <Text c="dimmed" size="sm">No note for {formatDisplayDate(selectedDate)}</Text>
          <Button variant="light" color="blue" onClick={createFromTemplate}>
            Create from template
          </Button>
        </div>
      ) : (
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Pinned top: Filters */}
          <div
            className="flex-shrink-0 border-b px-4 py-3"
            style={{ borderColor: "var(--mantine-color-dark-4)" }}
          >
            <Text size="xs" fw={600} c="dimmed" className="mb-2">Tasks</Text>
            <div className="flex flex-col gap-1.5">
              <SegmentedControl
                size="xs"
                value={statusFilter}
                onChange={(v) => setStatusFilter(v as "todo" | "done" | "all")}
                data={[
                  { value: "todo", label: "To Do" },
                  { value: "done", label: "Done" },
                  { value: "all", label: "All" },
                ]}
                styles={{
                  root: { backgroundColor: "var(--mantine-color-dark-6)" },
                }}
              />
              <div className="flex gap-1.5">
                <Select
                  size="xs"
                  placeholder="Related item"
                  data={buildRelatedFilterOptions(sections.tasks)}
                  value={relatedFilter}
                  onChange={setRelatedFilter}
                  clearable
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

          {/* Middle: Scrollable task list */}
          <div className="flex-1 overflow-y-auto px-4 py-2">
            {filteredTasks.length > 0 && (
              <div className="mb-3">
                <TaskList
                  tasks={filteredTasks}
                  onToggle={handleToggleTask}
                  onDelete={handleDeleteTask}
                  onTaskClick={onTaskClick}
                  selectedTaskId={selectedTask?.id}
                />
              </div>
            )}

            {filteredTasks.length === 0 && sections.tasks.length > 0 && (
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
          </div>

          {/* Pinned bottom: Task detail panel */}
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
      )}
    </div>
  );
}
