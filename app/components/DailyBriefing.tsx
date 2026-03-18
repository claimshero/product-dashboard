import { useState, useCallback, isValidElement, type ReactNode } from "react";
import { ActionIcon, Button, Loader, Popover, ScrollArea, Text, TextInput, Tooltip } from "@mantine/core";
import Markdown, { type Components } from "react-markdown";
import { useDailyBriefing } from "~/hooks/useDailyBriefing";
import { useTrackedInterests } from "~/hooks/useTrackedInterests";

function formatTime(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMs / 3_600_000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return d.toLocaleDateString();
}

/** Extract plain text from React children (strips markdown formatting). */
function extractText(node: ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (!node) return "";
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (isValidElement(node)) {
    return extractText((node.props as { children?: ReactNode }).children);
  }
  return "";
}

/** Extract the first URL from a link inside React children. */
function extractUrl(node: ReactNode): string | undefined {
  if (!node) return undefined;
  if (Array.isArray(node)) {
    for (const child of node) {
      const url = extractUrl(child);
      if (url) return url;
    }
    return undefined;
  }
  if (isValidElement(node)) {
    const props = node.props as { href?: string; children?: ReactNode };
    if (props.href && typeof props.href === "string") {
      return props.href;
    }
    return extractUrl(props.children);
  }
  return undefined;
}

/**
 * Derive a short topic label from a bullet's full text.
 * Uses the bold text if present (markdown **bold** renders as <strong>),
 * otherwise takes the first sentence or first ~80 chars.
 */
function deriveTopic(node: ReactNode): string {
  // Try to find bold text first — briefing bullets typically lead with a bold label
  const boldText = extractBoldText(node);
  if (boldText) return boldText;

  const full = extractText(node).trim();
  // Take first sentence
  const sentenceEnd = full.search(/[.!?]\s/);
  if (sentenceEnd > 0 && sentenceEnd < 100) return full.slice(0, sentenceEnd + 1);
  if (full.length <= 80) return full;
  return full.slice(0, 77) + "...";
}

function extractBoldText(node: ReactNode): string | undefined {
  if (!node) return undefined;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = extractBoldText(child);
      if (found) return found;
    }
    return undefined;
  }
  if (isValidElement(node)) {
    if (node.type === "strong" || node.type === "b") {
      return extractText((node.props as { children?: ReactNode }).children);
    }
    return extractBoldText((node.props as { children?: ReactNode }).children);
  }
  return undefined;
}

function TrackableListItem({
  children,
  onTrack,
}: {
  children: ReactNode;
  onTrack: (topic: string, context: string, sourceUrl: string) => Promise<void>;
}) {
  const [opened, setOpened] = useState(false);
  const [topic, setTopic] = useState("");
  const [context, setContext] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");

  const handleOpen = () => {
    setTopic(deriveTopic(children));
    setContext("");
    setSourceUrl(extractUrl(children) ?? "");
    setOpened(true);
  };

  const handleTrack = async () => {
    if (!topic.trim()) return;
    await onTrack(topic.trim(), context.trim(), sourceUrl.trim());
    setOpened(false);
  };

  return (
    <li className="group/track relative">
      <div className="flex items-start gap-1">
        <div className="flex-1 min-w-0">{children}</div>
        <Popover
          opened={opened}
          onChange={setOpened}
          position="left-start"
          shadow="lg"
          width={320}
          trapFocus
        >
          <Popover.Target>
            <ActionIcon
              variant="subtle"
              color="blue"
              size="xs"
              className="mt-0.5 shrink-0 opacity-0 group-hover/track:opacity-100 transition-opacity"
              onClick={handleOpen}
            >
              <span style={{ fontSize: 13, lineHeight: 1 }}>+</span>
            </ActionIcon>
          </Popover.Target>
          <Popover.Dropdown
            style={{
              backgroundColor: "var(--mantine-color-dark-7)",
              border: "1px solid var(--mantine-color-dark-4)",
            }}
          >
            <div className="flex flex-col gap-2">
              <Text size="xs" fw={600} c="gray.3">Track this topic</Text>
              <TextInput
                label="Topic"
                value={topic}
                onChange={(e) => setTopic(e.currentTarget.value)}
                onKeyDown={(e) => e.key === "Enter" && handleTrack()}
                size="xs"
                styles={{
                  input: {
                    backgroundColor: "var(--mantine-color-dark-6)",
                    border: "1px solid var(--mantine-color-dark-4)",
                  },
                  label: { color: "var(--mantine-color-dark-2)", fontSize: 11 },
                }}
              />
              <TextInput
                label="Context"
                placeholder="Optional — what to watch for"
                value={context}
                onChange={(e) => setContext(e.currentTarget.value)}
                onKeyDown={(e) => e.key === "Enter" && handleTrack()}
                size="xs"
                styles={{
                  input: {
                    backgroundColor: "var(--mantine-color-dark-6)",
                    border: "1px solid var(--mantine-color-dark-4)",
                  },
                  label: { color: "var(--mantine-color-dark-2)", fontSize: 11 },
                }}
              />
              <TextInput
                label="Source URL"
                placeholder="Optional"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.currentTarget.value)}
                onKeyDown={(e) => e.key === "Enter" && handleTrack()}
                size="xs"
                styles={{
                  input: {
                    backgroundColor: "var(--mantine-color-dark-6)",
                    border: "1px solid var(--mantine-color-dark-4)",
                  },
                  label: { color: "var(--mantine-color-dark-2)", fontSize: 11 },
                }}
              />
              <div className="flex justify-end gap-2">
                <Button size="xs" variant="subtle" color="gray" onClick={() => setOpened(false)}>
                  Cancel
                </Button>
                <Button size="xs" variant="light" color="blue" onClick={handleTrack}>
                  Track
                </Button>
              </div>
            </div>
          </Popover.Dropdown>
        </Popover>
      </div>
    </li>
  );
}

export function DailyBriefing() {
  const { briefing, loading, error, refresh, runNow } = useDailyBriefing();
  const { interests, addInterest, removeInterest } = useTrackedInterests();

  const [addingInterest, setAddingInterest] = useState(false);
  const [newTopic, setNewTopic] = useState("");
  const [newContext, setNewContext] = useState("");
  const [newSourceUrl, setNewSourceUrl] = useState("");

  const isRunning = briefing?.status === "running";

  const handleAddInterest = async () => {
    const topic = newTopic.trim();
    if (!topic) return;
    const context = newContext.trim() || undefined;
    const sourceUrl = newSourceUrl.trim() || undefined;
    await addInterest(topic, context, sourceUrl);
    setNewTopic("");
    setNewContext("");
    setNewSourceUrl("");
    setAddingInterest(false);
  };

  const handleInlineTrack = useCallback(
    async (topic: string, context: string, sourceUrl: string) => {
      await addInterest(topic, context || undefined, sourceUrl || undefined);
    },
    [addInterest]
  );

  const markdownComponents: Components = {
    li: ({ children }) => (
      <TrackableListItem onTrack={handleInlineTrack}>
        {children}
      </TrackableListItem>
    ),
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--mantine-color-dark-4)] px-4 py-3">
        <div className="flex items-center gap-3">
          <Text size="lg" fw={600} c="gray.2">
            Daily Briefing
          </Text>
          {briefing?.completedAt && (
            <Text size="xs" c="dimmed">
              Updated {formatTime(briefing.completedAt)}
            </Text>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Tooltip label="Track a topic">
            <ActionIcon
              variant={addingInterest ? "filled" : "subtle"}
              color="blue"
              size="sm"
              onClick={() => setAddingInterest((v) => !v)}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
            </ActionIcon>
          </Tooltip>
          <Button
            size="xs"
            variant="light"
            color="blue"
            onClick={runNow}
            loading={isRunning}
            disabled={isRunning}
          >
            {isRunning ? "Generating..." : "Run Now"}
          </Button>
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

      {/* Add interest form */}
      {addingInterest && (
        <div className="flex flex-col gap-2 border-b border-[var(--mantine-color-dark-4)] px-4 py-2">
          <div className="flex items-center gap-2">
            <TextInput
              placeholder="Track a topic..."
              value={newTopic}
              onChange={(e) => setNewTopic(e.currentTarget.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddInterest()}
              size="xs"
              className="flex-1"
              styles={{
                input: {
                  backgroundColor: "var(--mantine-color-dark-6)",
                  border: "1px solid var(--mantine-color-dark-4)",
                },
              }}
            />
            <Button size="xs" variant="light" color="blue" onClick={handleAddInterest}>
              Track
            </Button>
          </div>
          <TextInput
            placeholder="Context (optional) — e.g. Announced at HIMSS 2026"
            value={newContext}
            onChange={(e) => setNewContext(e.currentTarget.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddInterest()}
            size="xs"
            styles={{
              input: {
                backgroundColor: "var(--mantine-color-dark-6)",
                border: "1px solid var(--mantine-color-dark-4)",
              },
            }}
          />
          <TextInput
            placeholder="Source URL (optional)"
            value={newSourceUrl}
            onChange={(e) => setNewSourceUrl(e.currentTarget.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddInterest()}
            size="xs"
            styles={{
              input: {
                backgroundColor: "var(--mantine-color-dark-6)",
                border: "1px solid var(--mantine-color-dark-4)",
              },
            }}
          />
        </div>
      )}

      {/* Tracked interests list */}
      {interests.length > 0 && (
        <div className="border-b border-[var(--mantine-color-dark-4)] px-4 py-2">
          <Text size="xs" c="dimmed" fw={500} className="mb-1">
            Tracking {interests.length} topic{interests.length !== 1 ? "s" : ""}
          </Text>
          <div className="flex flex-col gap-1">
            {interests.map((interest) => (
              <div key={interest.id} className="flex items-center gap-2 group">
                <Text size="xs" c="gray.3" className="flex-1" lineClamp={1}>
                  {interest.sourceUrl ? (
                    <a
                      href={interest.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--mantine-color-blue-4)] hover:underline"
                    >
                      {interest.topic}
                    </a>
                  ) : (
                    interest.topic
                  )}
                  {interest.context && (
                    <span className="text-[var(--mantine-color-dark-2)]"> — {interest.context}</span>
                  )}
                </Text>
                <Tooltip label="Stop tracking">
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    size="xs"
                    className="opacity-0 group-hover:opacity-100"
                    onClick={() => removeInterest(interest.id)}
                  >
                    <span style={{ fontSize: 12 }}>&#x2715;</span>
                  </ActionIcon>
                </Tooltip>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {loading && !briefing ? (
            <div className="flex h-32 items-center justify-center">
              <Text c="dimmed" size="sm">Loading...</Text>
            </div>
          ) : error && !briefing ? (
            <div className="flex h-32 flex-col items-center justify-center gap-2">
              <Text c="red" size="sm">{error}</Text>
            </div>
          ) : isRunning && !briefing?.content ? (
            <div className="flex h-32 flex-col items-center justify-center gap-3">
              <Loader size="md" color="blue" />
              <Text c="dimmed" size="sm">
                Generating your daily briefing...
              </Text>
              <Text c="dimmed" size="xs">
                This may take a minute
              </Text>
            </div>
          ) : briefing?.content ? (
            <>
              {isRunning && (
                <div className="mb-4 flex items-center gap-2 rounded bg-[var(--mantine-color-dark-6)] px-3 py-2">
                  <Loader size="xs" color="blue" />
                  <Text size="xs" c="dimmed">
                    Generating a new briefing...
                  </Text>
                </div>
              )}
              {briefing.status === "error" && briefing.error && (
                <div className="mb-4 rounded bg-[var(--mantine-color-red-9)] px-3 py-2">
                  <Text size="xs" c="red.2">
                    Error: {briefing.error}
                  </Text>
                </div>
              )}
              <div className="prose prose-invert prose-sm max-w-none text-[var(--mantine-color-gray-1)]">
                <Markdown components={markdownComponents}>{briefing.content}</Markdown>
              </div>
            </>
          ) : (
            <div className="flex h-32 flex-col items-center justify-center gap-3">
              <Text c="dimmed" size="sm">
                No briefing yet
              </Text>
              <Button
                size="sm"
                variant="light"
                color="blue"
                onClick={runNow}
              >
                Generate First Briefing
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
