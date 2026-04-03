import { useState, useEffect } from "react";
import { Badge, ScrollArea, Text, Tooltip, ActionIcon } from "@mantine/core";
import type { SelectedItem } from "~/hooks/useDelivery";

const API_BASE = "http://localhost:4001";

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

interface IssueDetails {
  key: string;
  summary: string;
  status: string;
  statusCategory: string;
  issueType: string;
  assignee: string | null;
  descriptionHtml: string | null;
  url: string;
}

export function ItemDetails({
  selectedItem,
}: {
  selectedItem: SelectedItem | null;
}) {
  const [details, setDetails] = useState<IssueDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedItem) {
      setDetails(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`${API_BASE}/api/jira/issue/${selectedItem.key}/details`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch details");
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setDetails(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedItem?.key]);

  if (!selectedItem) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center border-b border-[var(--mantine-color-dark-4)] px-4 py-3">
          <Text size="lg" fw={600} c="gray.2">
            Details
          </Text>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <Text c="dimmed" size="sm">
            Select an item to view details
          </Text>
        </div>
      </div>
    );
  }

  const displayType = details?.issueType ?? selectedItem.issueType;
  const displayStatus = details?.status ?? selectedItem.status;
  const displayStatusCategory =
    details?.statusCategory ?? selectedItem.statusCategory;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--mantine-color-dark-4)] px-4 py-3">
        <Text size="lg" fw={600} c="gray.2">
          Details
        </Text>
        <Tooltip label="Open in Jira">
          <ActionIcon
            component="a"
            href={selectedItem.url}
            target="_blank"
            rel="noopener noreferrer"
            variant="subtle"
            color="gray"
            size="sm"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
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
          </ActionIcon>
        </Tooltip>
      </div>

      {/* Item info */}
      <div className="border-b border-[var(--mantine-color-dark-4)] px-4 py-3">
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 16 }}>{issueTypeEmoji(displayType)}</span>
          <a
            href={selectedItem.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontFamily: "monospace", fontSize: "var(--mantine-font-size-xs)", color: "var(--mantine-color-blue-4)", textDecoration: "none" }}
            onMouseOver={(e) => (e.currentTarget.style.textDecoration = "underline")}
            onMouseOut={(e) => (e.currentTarget.style.textDecoration = "none")}
          >
            {selectedItem.key}
          </a>
          <Badge
            size="xs"
            variant="light"
            color={statusColor(displayStatusCategory)}
          >
            {displayStatus}
          </Badge>
        </div>
        <Text size="sm" fw={600} c="gray.2" mt={4}>
          {selectedItem.summary}
        </Text>
        {details?.assignee && (
          <Text size="xs" c="dimmed" mt={2}>
            Assigned to {details.assignee}
          </Text>
        )}
      </div>

      {/* Description */}
      <ScrollArea className="flex-1 p-4">
        {loading ? (
          <Text c="dimmed" size="sm">
            Loading description...
          </Text>
        ) : error ? (
          <Text c="red" size="sm">
            {error}
          </Text>
        ) : details?.descriptionHtml ? (
          <div
            className="jira-description"
            dangerouslySetInnerHTML={{ __html: details.descriptionHtml }}
          />
        ) : (
          <Text c="dimmed" size="sm">
            No description
          </Text>
        )}
      </ScrollArea>
    </div>
  );
}
