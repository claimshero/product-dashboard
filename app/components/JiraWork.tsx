import { useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Progress,
  ScrollArea,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useJiraWork, type JiraIssue, type TrackedEpic } from "~/hooks/useJiraWork";

function statusColor(statusCategory: string): string {
  switch (statusCategory) {
    case "done":
      return "green";
    case "indeterminate":
      return "yellow";
    case "new":
      return "blue";
    default:
      return "gray";
  }
}

function IssueRow({ issue, depth = 0 }: { issue: JiraIssue; depth?: number }) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = issue.children && issue.children.length > 0;

  return (
    <>
      <div
        className="flex items-center gap-3 border-b border-[var(--mantine-color-dark-5)] px-4 py-2 transition-colors hover:bg-[var(--mantine-color-dark-5)]"
        style={{ paddingLeft: 16 + depth * 20 }}
      >
        {hasChildren ? (
          <ActionIcon
            variant="subtle"
            color="gray"
            size="xs"
            onClick={() => setExpanded((v) => !v)}
            style={{ flexShrink: 0 }}
          >
            <span style={{ fontSize: 10, display: "inline-block", transform: expanded ? "rotate(90deg)" : "none", transition: "transform 150ms" }}>
              &#9654;
            </span>
          </ActionIcon>
        ) : (
          <div style={{ width: 22, flexShrink: 0 }} />
        )}
        <a
          href={issue.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          <Text size="xs" c="dimmed" style={{ minWidth: 72, fontFamily: "monospace" }}>
            {issue.key}
          </Text>
          <div className="min-w-0 flex-1">
            <Text size="sm" c="gray.2" lineClamp={1}>
              {issue.summary}
            </Text>
          </div>
          {issue.assignee && (
            <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>
              {issue.assignee.split(" ")[0]}
            </Text>
          )}
          <Badge size="xs" variant="light" color={statusColor(issue.statusCategory)}>
            {issue.status}
          </Badge>
        </a>
      </div>
      {hasChildren && expanded &&
        issue.children!.map((child) => (
          <IssueRow key={child.key} issue={child} depth={depth + 1} />
        ))}
    </>
  );
}

function EpicCard({
  epic,
  onUntrack,
}: {
  epic: TrackedEpic;
  onUntrack: () => void;
}) {
  const pct =
    epic.progress.total > 0
      ? Math.round((epic.progress.done / epic.progress.total) * 100)
      : 0;

  // Split children: in-progress/todo first, done last
  const active = epic.children.filter((c) => c.statusCategory !== "done");
  const done = epic.children.filter((c) => c.statusCategory === "done");

  return (
    <div className="mb-4 overflow-hidden rounded-lg border border-[var(--mantine-color-dark-4)] bg-[var(--mantine-color-dark-7)]">
      {/* Epic header */}
      <div className="flex items-center gap-3 border-b border-[var(--mantine-color-dark-4)] px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <a
              href={epic.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              <Text size="sm" fw={600} c="gray.2" lineClamp={1}>
                {epic.summary}
              </Text>
            </a>
            <Badge size="xs" variant="light" color="blue" style={{ flexShrink: 0 }}>
              {epic.status}
            </Badge>
          </div>
          <Text size="xs" c="dimmed" style={{ fontFamily: "monospace" }}>
            {epic.key}
          </Text>
        </div>
        <Tooltip label="Stop tracking">
          <ActionIcon
            variant="subtle"
            color="red"
            size="sm"
            onClick={onUntrack}
          >
            <span style={{ fontSize: 14 }}>&times;</span>
          </ActionIcon>
        </Tooltip>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-3 px-4 py-2">
        <Progress
          value={pct}
          size="sm"
          color="green"
          className="flex-1"
          styles={{ root: { backgroundColor: "var(--mantine-color-dark-5)" } }}
        />
        <Text size="xs" c="dimmed">
          {epic.progress.done}/{epic.progress.total}
        </Text>
      </div>

      {/* Active issues */}
      {active.length > 0 && (
        <div>
          {active.map((issue) => (
            <IssueRow key={issue.key} issue={issue} />
          ))}
        </div>
      )}

      {/* Completed issues (collapsed) */}
      {done.length > 0 && (
        <details className="border-t border-[var(--mantine-color-dark-5)]">
          <summary className="cursor-pointer px-4 py-2 text-xs text-[var(--mantine-color-dimmed)] hover:bg-[var(--mantine-color-dark-5)]">
            {done.length} completed
          </summary>
          {done.map((issue) => (
            <IssueRow key={issue.key} issue={issue} />
          ))}
        </details>
      )}
    </div>
  );
}

export function JiraWork() {
  const { epics, loading, error, refresh, trackEpic, untrackEpic } =
    useJiraWork();
  const [addingEpic, setAddingEpic] = useState(false);
  const [newEpicKey, setNewEpicKey] = useState("");

  const handleAdd = async () => {
    if (!newEpicKey.trim()) return;
    await trackEpic(newEpicKey.trim());
    setNewEpicKey("");
    setAddingEpic(false);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--mantine-color-dark-4)] px-4 py-3">
        <Text size="lg" fw={600} c="gray.2">
          Current Work
        </Text>
        <div className="flex items-center gap-2">
          <Tooltip label="Track an epic">
            <ActionIcon
              variant="subtle"
              color="blue"
              size="sm"
              onClick={() => setAddingEpic((v) => !v)}
            >
              <span style={{ fontSize: 16 }}>+</span>
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Refresh">
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              onClick={refresh}
              loading={loading}
            >
              <span style={{ fontSize: 14 }}>&#x21bb;</span>
            </ActionIcon>
          </Tooltip>
        </div>
      </div>

      {/* Add epic input */}
      {addingEpic && (
        <div className="flex items-center gap-2 border-b border-[var(--mantine-color-dark-4)] px-4 py-2">
          <TextInput
            placeholder="Epic key (e.g. MVP-3069)"
            value={newEpicKey}
            onChange={(e) => setNewEpicKey(e.currentTarget.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            size="xs"
            className="flex-1"
            styles={{
              input: {
                backgroundColor: "var(--mantine-color-dark-6)",
                border: "1px solid var(--mantine-color-dark-4)",
              },
            }}
          />
          <Button size="xs" variant="light" color="blue" onClick={handleAdd}>
            Track
          </Button>
        </div>
      )}

      {/* Epic list */}
      <ScrollArea className="flex-1 p-4">
        {loading && epics.length === 0 ? (
          <div className="flex h-32 items-center justify-center">
            <Text c="dimmed" size="sm">
              Loading...
            </Text>
          </div>
        ) : error ? (
          <div className="flex h-32 flex-col items-center justify-center gap-2">
            <Text c="red" size="sm">
              {error}
            </Text>
            <Text c="dimmed" size="xs">
              Make sure JIRA_EMAIL and JIRA_API_TOKEN are set
            </Text>
          </div>
        ) : epics.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center gap-3">
            <Text c="dimmed" size="sm">
              No epics tracked yet
            </Text>
            <Button
              size="xs"
              variant="light"
              color="blue"
              onClick={() => setAddingEpic(true)}
            >
              Track an epic
            </Button>
          </div>
        ) : (
          epics.map((epic) => (
            <EpicCard
              key={epic.key}
              epic={epic}
              onUntrack={() => untrackEpic(epic.key)}
            />
          ))
        )}
      </ScrollArea>
    </div>
  );
}
