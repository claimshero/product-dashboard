import { ActionIcon, Button, Loader, ScrollArea, Text, Tooltip } from "@mantine/core";
import Markdown from "react-markdown";
import { useDailyBriefing } from "~/hooks/useDailyBriefing";

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

export function DailyBriefing() {
  const { briefing, loading, error, refresh, runNow } = useDailyBriefing();

  const isRunning = briefing?.status === "running";

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
                <Markdown>{briefing.content}</Markdown>
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
