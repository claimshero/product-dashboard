import { Checkbox, Text, Badge, ActionIcon } from "@mantine/core";
import type { Task } from "~/types/tasks";

interface TaskListProps {
  tasks: Task[];
  onToggle: (task: Task) => void;
  onDelete?: (task: Task) => void;
  onTaskClick?: (task: Task) => void;
  selectedTaskId?: string | null;
  compact?: boolean;
}

/** Strip metadata tags and date annotations from display text */
function cleanTaskText(text: string): string {
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

export function TaskList({ tasks, onToggle, onDelete, onTaskClick, selectedTaskId, compact }: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <Text size="xs" c="dimmed" className="px-2 py-1">
        No tasks
      </Text>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      {tasks.map((task) => (
        <div
          key={task.id}
          className="flex items-start gap-2 rounded px-2 py-1 hover:bg-[var(--mantine-color-dark-5)] transition-colors cursor-pointer"
          style={{
            backgroundColor: selectedTaskId === task.id ? "var(--mantine-color-blue-9)" : undefined,
          }}
          onClick={() => onTaskClick?.(task)}
        >
          <Checkbox
            size="xs"
            checked={task.completed}
            onChange={(e) => {
              e.stopPropagation();
              onToggle(task);
            }}
            styles={{
              input: { cursor: "pointer" },
              root: { marginTop: 2 },
            }}
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <Text
              size={compact ? "xs" : "sm"}
              c={task.completed ? "dimmed" : undefined}
              td={task.completed ? "line-through" : undefined}
              lineClamp={compact ? 1 : 2}
            >
              {task.urgency === "high" && <span title="High urgency">❗</span>}
              {cleanTaskText(task.text)}
            </Text>
            {!compact && (task.betSlug || task.jiraKey || task.clientSlug || task.partnerSlug) && (
              <div className="mt-0.5 flex gap-1 flex-wrap">
                {task.betSlug && (
                  <Badge size="xs" variant="dot" color="yellow">
                    {task.betSlug}
                  </Badge>
                )}
                {task.jiraKey && (
                  <Badge
                    size="xs"
                    variant="dot"
                    color="blue"
                    component="a"
                    href={`https://claimable.atlassian.net/browse/${task.jiraKey}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    style={{ cursor: "pointer", textDecoration: "none" }}
                  >
                    {task.jiraKey}
                  </Badge>
                )}
                {task.clientSlug && (
                  <Badge size="xs" variant="dot" color="teal">
                    {task.clientSlug}
                  </Badge>
                )}
                {task.partnerSlug && (
                  <Badge size="xs" variant="dot" color="grape">
                    {task.partnerSlug}
                  </Badge>
                )}
              </div>
            )}
            {!compact && task.category !== "general" && (
              <Text size="xs" c="dimmed">
                {task.category}
              </Text>
            )}
          </div>
          {onDelete && !compact && (
            <ActionIcon
              size="xs"
              variant="subtle"
              color="red"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(task);
              }}
              style={{ flexShrink: 0, marginTop: 2, opacity: 0.5 }}
              className="hover:!opacity-100"
            >
              <span style={{ fontSize: 12 }}>&times;</span>
            </ActionIcon>
          )}
        </div>
      ))}
    </div>
  );
}
