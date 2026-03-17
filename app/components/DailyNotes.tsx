import { ActionIcon, Button, Text, Textarea, Badge, Tooltip } from "@mantine/core";
import { useDailyNotes } from "~/hooks/useDailyNotes";

function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function DailyNotes() {
  const {
    selectedDate,
    setSelectedDate,
    content,
    templateContent,
    updateContent,
    createFromTemplate,
    loading,
    saving,
    isDirty,
    exists,
    goToToday,
    goToPrev,
    goToNext,
  } = useDailyNotes();

  const isToday =
    selectedDate === new Date().toISOString().slice(0, 10);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--mantine-color-dark-4)] px-4 py-3">
        <div className="flex items-center gap-2">
          <Text size="lg" fw={600} c="gray.2">
            Daily Notes
          </Text>
          {saving && (
            <Badge size="xs" variant="light" color="yellow">
              Saving...
            </Badge>
          )}
          {!saving && isDirty && (
            <Badge size="xs" variant="light" color="orange">
              Unsaved
            </Badge>
          )}
          {!saving && !isDirty && exists && (
            <Badge size="xs" variant="light" color="green">
              Saved
            </Badge>
          )}
        </div>
      </div>

      {/* Date Navigation */}
      <div className="flex items-center justify-center gap-3 border-b border-[var(--mantine-color-dark-4)] px-4 py-2">
        <Tooltip label="Previous day">
          <ActionIcon
            variant="subtle"
            color="gray"
            onClick={goToPrev}
            size="sm"
          >
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
          <Text size="sm" c="dimmed">
            {formatDisplayDate(selectedDate)}
          </Text>
        </div>

        <Tooltip label="Next day">
          <ActionIcon
            variant="subtle"
            color="gray"
            onClick={goToNext}
            size="sm"
          >
            <span style={{ fontSize: 16 }}>&rarr;</span>
          </ActionIcon>
        </Tooltip>

        {!isToday && (
          <Tooltip label="Go to today">
            <ActionIcon
              variant="light"
              color="blue"
              onClick={goToToday}
              size="sm"
            >
              <span style={{ fontSize: 12 }}>Today</span>
            </ActionIcon>
          </Tooltip>
        )}
      </div>

      {/* Editor / Create from template */}
      <div className="flex-1 overflow-hidden p-4">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Text c="dimmed">Loading...</Text>
          </div>
        ) : !exists ? (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <Text c="dimmed" size="sm">
              No note for {formatDisplayDate(selectedDate)}
            </Text>
            <Button
              variant="light"
              color="blue"
              onClick={createFromTemplate}
            >
              Create from template
            </Button>
          </div>
        ) : (
          <Textarea
            value={content}
            onChange={(e) => updateContent(e.currentTarget.value)}
            placeholder={`Start writing your note for ${formatDisplayDate(selectedDate)}...`}
            autosize={false}
            styles={{
              root: { height: "100%" },
              wrapper: { height: "100%" },
              input: {
                height: "100%",
                fontFamily: "monospace",
                fontSize: 14,
                lineHeight: 1.6,
                backgroundColor: "var(--mantine-color-dark-7)",
                border: "1px solid var(--mantine-color-dark-4)",
                resize: "none",
              },
            }}
          />
        )}
      </div>
    </div>
  );
}
