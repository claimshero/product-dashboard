import { useState } from "react";
import {
  ActionIcon,
  Badge,
  Progress,
  ScrollArea,
  Text,
  Tooltip,
} from "@mantine/core";
import {
  useDelivery,
  type DeliveryEpic,
  type JiraIssue,
  type LinkedIdea,
  type SelectedItem,
} from "~/hooks/useDelivery";

function issueTypeEmoji(issueType: string): string {
  switch (issueType.toLowerCase()) {
    case "idea":
      return "💡";
    case "epic":
      return "⚡";
    case "story":
      return "📖";
    case "task":
      return "✅";
    case "sub-task":
    case "subtask":
      return "🔹";
    case "bug":
      return "🐛";
    default:
      return "📋";
  }
}

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

function ExternalLinkIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function IssueRow({
  issue,
  depth = 0,
  onSelectItem,
  selectedItemKey,
}: {
  issue: JiraIssue;
  depth?: number;
  onSelectItem: (item: SelectedItem) => void;
  selectedItemKey: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = issue.children && issue.children.length > 0;

  const handleSelect = () => {
    onSelectItem({
      key: issue.key,
      summary: issue.summary,
      status: issue.status,
      statusCategory: issue.statusCategory,
      issueType: issue.issueType,
      url: issue.url,
    });
  };

  return (
    <>
      <div
        className={`flex items-center gap-3 border-b border-[var(--mantine-color-dark-5)] px-4 py-2 transition-colors ${
          selectedItemKey === issue.key
            ? "bg-[var(--mantine-color-blue-9)]/20 border-l-2 border-l-[var(--mantine-color-blue-6)]"
            : "hover:bg-[var(--mantine-color-dark-5)]"
        }`}
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
            <span
              style={{
                fontSize: 10,
                display: "inline-block",
                transform: expanded ? "rotate(90deg)" : "none",
                transition: "transform 150ms",
              }}
            >
              &#9654;
            </span>
          </ActionIcon>
        ) : (
          <div style={{ width: 22, flexShrink: 0 }} />
        )}
        <div
          onClick={handleSelect}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-3"
        >
          <span style={{ fontSize: 14, flexShrink: 0 }}>
            {issueTypeEmoji(issue.issueType)}
          </span>
          <Text
            size="xs"
            c="dimmed"
            style={{ minWidth: 72, fontFamily: "monospace" }}
          >
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
          <Badge
            size="xs"
            variant="light"
            color={statusColor(issue.statusCategory)}
          >
            {issue.status}
          </Badge>
        </div>
        <Tooltip label="Open in Jira">
          <ActionIcon
            component="a"
            href={issue.url}
            target="_blank"
            rel="noopener noreferrer"
            variant="subtle"
            color="gray"
            size="xs"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <ExternalLinkIcon />
          </ActionIcon>
        </Tooltip>
      </div>
      {hasChildren &&
        expanded &&
        issue.children!.map((child) => (
          <IssueRow
            key={child.key}
            issue={child}
            depth={depth + 1}
            onSelectItem={onSelectItem}
            selectedItemKey={selectedItemKey}
          />
        ))}
    </>
  );
}

function EpicCard({
  epic,
  onSelectItem,
  selectedItemKey,
}: {
  epic: DeliveryEpic;
  onSelectItem: (item: SelectedItem) => void;
  selectedItemKey: string | null;
}) {
  const pct =
    epic.progress.total > 0
      ? Math.round((epic.progress.done / epic.progress.total) * 100)
      : 0;

  const active = epic.children.filter((c) => c.statusCategory !== "done");
  const done = epic.children.filter((c) => c.statusCategory === "done");

  const handleSelect = () => {
    onSelectItem({
      key: epic.key,
      summary: epic.summary,
      status: epic.status,
      statusCategory: epic.statusCategory,
      issueType: "Epic",
      url: epic.url,
    });
  };

  return (
    <div className={`mb-3 overflow-hidden rounded-lg border bg-[var(--mantine-color-dark-7)] ${
      selectedItemKey === epic.key
        ? "border-[var(--mantine-color-blue-6)] bg-[var(--mantine-color-blue-9)]/10"
        : "border-[var(--mantine-color-dark-4)]"
    }`}>
      {/* Epic header */}
      <div className="flex items-center gap-3 border-b border-[var(--mantine-color-dark-4)] px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 14 }}>⚡</span>
            <span onClick={handleSelect} className="cursor-pointer hover:underline">
              <Text size="sm" fw={600} c="gray.2" lineClamp={1}>
                {epic.summary}
              </Text>
            </span>
            <Badge
              size="xs"
              variant="light"
              color={statusColor(epic.statusCategory)}
              style={{ flexShrink: 0 }}
            >
              {epic.status}
            </Badge>
          </div>
          <Text size="xs" c="dimmed" style={{ fontFamily: "monospace" }}>
            {epic.key}
          </Text>
        </div>
        <Tooltip label="Open in Jira">
          <ActionIcon
            component="a"
            href={epic.url}
            target="_blank"
            rel="noopener noreferrer"
            variant="subtle"
            color="gray"
            size="sm"
          >
            <ExternalLinkIcon />
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
          styles={{
            root: { backgroundColor: "var(--mantine-color-dark-5)" },
          }}
        />
        <Text size="xs" c="dimmed">
          {epic.progress.done}/{epic.progress.total}
        </Text>
      </div>

      {/* Active issues */}
      {active.length > 0 && (
        <div>
          {active.map((issue) => (
            <IssueRow
              key={issue.key}
              issue={issue}
              onSelectItem={onSelectItem}
              selectedItemKey={selectedItemKey}
            />
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
            <IssueRow
              key={issue.key}
              issue={issue}
              onSelectItem={onSelectItem}
              selectedItemKey={selectedItemKey}
            />
          ))}
        </details>
      )}
    </div>
  );
}

interface IdeaGroup {
  idea: LinkedIdea | null;
  epics: DeliveryEpic[];
}

function groupEpicsByIdea(epics: DeliveryEpic[]): IdeaGroup[] {
  const ideaMap = new Map<string, IdeaGroup>();
  const noIdeaGroup: IdeaGroup = { idea: null, epics: [] };

  for (const epic of epics) {
    if (!epic.idea) {
      noIdeaGroup.epics.push(epic);
      continue;
    }
    const existing = ideaMap.get(epic.idea.key);
    if (existing) {
      existing.epics.push(epic);
    } else {
      ideaMap.set(epic.idea.key, { idea: epic.idea, epics: [epic] });
    }
  }

  const groups = [...ideaMap.values()];
  if (noIdeaGroup.epics.length > 0) {
    groups.push(noIdeaGroup);
  }
  return groups;
}

function IdeaGroupCard({
  group,
  onSelectItem,
  selectedItemKey,
}: {
  group: IdeaGroup;
  onSelectItem: (item: SelectedItem) => void;
  selectedItemKey: string | null;
}) {
  const [expanded, setExpanded] = useState(true);

  const handleSelectIdea = () => {
    if (!group.idea) return;
    onSelectItem({
      key: group.idea.key,
      summary: group.idea.summary,
      status: group.idea.status,
      statusCategory: group.idea.statusCategory,
      issueType: "Idea",
      url: group.idea.url,
    });
  };

  return (
    <div className="mb-4">
      {/* Idea header */}
      <div className={`flex w-full items-center gap-2 rounded-md px-3 py-2 transition-colors ${
        group.idea && selectedItemKey === group.idea.key
          ? "bg-[var(--mantine-color-blue-9)]/20"
          : "hover:bg-[var(--mantine-color-dark-6)]"
      }`}>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center bg-transparent border-none p-0 cursor-pointer"
        >
          <span
            style={{
              fontSize: 10,
              display: "inline-block",
              transform: expanded ? "rotate(90deg)" : "none",
              transition: "transform 150ms",
              color: "var(--mantine-color-dimmed)",
            }}
          >
            &#9654;
          </span>
        </button>
        {group.idea ? (
          <div
            onClick={handleSelectIdea}
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-2"
          >
            <span style={{ fontSize: 14, flexShrink: 0 }}>💡</span>
            <Text size="sm" fw={600} c="gray.3" lineClamp={1}>
              {group.idea.summary}
            </Text>
            <Badge
              size="xs"
              variant="light"
              color="violet"
              style={{ flexShrink: 0 }}
            >
              {group.idea.status}
            </Badge>
            <Text
              size="xs"
              c="dimmed"
              style={{ fontFamily: "monospace", flexShrink: 0 }}
            >
              {group.idea.key}
            </Text>
          </div>
        ) : (
          <Text size="sm" fw={600} c="dimmed" className="flex-1">
            No Idea
          </Text>
        )}
        <Badge
          size="xs"
          variant="outline"
          color="gray"
          style={{ flexShrink: 0 }}
        >
          {group.epics.length} epic{group.epics.length !== 1 ? "s" : ""}
        </Badge>
        {group.idea && (
          <Tooltip label="Open in Jira">
            <ActionIcon
              component="a"
              href={group.idea.url}
              target="_blank"
              rel="noopener noreferrer"
              variant="subtle"
              color="gray"
              size="xs"
            >
              <ExternalLinkIcon />
            </ActionIcon>
          </Tooltip>
        )}
      </div>

      {/* Epics */}
      {expanded && (
        <div className="mt-1 pl-5">
          {group.epics.map((epic) => (
            <EpicCard
              key={epic.key}
              epic={epic}
              onSelectItem={onSelectItem}
              selectedItemKey={selectedItemKey}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function Delivery({
  onSelectItem,
  selectedItemKey,
  filterByIdeaKeys,
}: {
  onSelectItem: (item: SelectedItem) => void;
  selectedItemKey: string | null;
  filterByIdeaKeys?: string[];
}) {
  const { epics, loading, error, refresh } = useDelivery();
  const filteredEpics = filterByIdeaKeys
    ? epics.filter(
        (e) =>
          (e.idea && filterByIdeaKeys.includes(e.idea.key)) ||
          filterByIdeaKeys.includes(e.key)
      )
    : epics;
  const groups = groupEpicsByIdea(filteredEpics);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--mantine-color-dark-4)] px-4 py-3">
        <Text size="lg" fw={600} c="gray.2">
          Delivery
        </Text>
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

      {/* Content */}
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
          </div>
        ) : filteredEpics.length === 0 ? (
          <div className="flex h-32 items-center justify-center">
            <Text c="dimmed" size="sm">
              {filterByIdeaKeys !== undefined
                ? "No delivery items for this selection"
                : "No epics currently in delivery"}
            </Text>
          </div>
        ) : (
          groups.map((group) => (
            <IdeaGroupCard
              key={group.idea?.key ?? "no-idea"}
              group={group}
              onSelectItem={onSelectItem}
              selectedItemKey={selectedItemKey}
            />
          ))
        )}
      </ScrollArea>
    </div>
  );
}
