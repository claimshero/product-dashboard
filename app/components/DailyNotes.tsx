import { useState, useEffect, useCallback } from "react";
import { ActionIcon, Button, Text, Badge, Tooltip } from "@mantine/core";
import type { ActivityEntry, DailyActivity } from "~/types/tasks";

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
  activity: DailyActivity;
  notes: string[];
}

interface DailyNotesProps {
  onDateChange?: (date: string) => void;
  onSwitchToTasks?: (category?: string) => void;
}

export function DailyNotes({ onDateChange, onSwitchToTasks }: DailyNotesProps) {
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [sections, setSections] = useState<DailySections>({
    exists: false,
    focus: [],
    activity: { created: [], completed: [] },
    notes: [],
  });
  const [loading, setLoading] = useState(false);

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

  const goToToday = () => setSelectedDate(todayStr());
  const goToPrev = () => setSelectedDate((d) => shiftDate(d, -1));
  const goToNext = () => setSelectedDate((d) => shiftDate(d, 1));

  return (
    <div className="flex h-full flex-col bg-[var(--mantine-color-dark-7)]">
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
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {/* Focus section */}
          {sections.focus.length > 0 && (
            <div className="mb-4">
              <Text size="xs" fw={600} c="dimmed" className="mb-1.5">Focus</Text>
              <div className="flex flex-col gap-1">
                {sections.focus.map((item, idx) => (
                  <Text key={idx} size="sm">{item}</Text>
                ))}
              </div>
            </div>
          )}

          {/* Task Activity Log */}
          <div className="mb-4">
            <Text size="xs" fw={600} c="dimmed" className="mb-1.5">Task Activity</Text>

            {sections.activity.created.length > 0 && (
              <div className="mb-2">
                <Text size="xs" c="dimmed" className="mb-1">Created</Text>
                <div className="flex flex-col gap-0.5">
                  {sections.activity.created.map((entry, idx) => (
                    <div
                      key={`c-${idx}`}
                      className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-[var(--mantine-color-dark-5)] cursor-pointer transition-colors"
                      onClick={() => onSwitchToTasks?.(entry.category)}
                    >
                      <Badge size="xs" variant="light" color="blue">{entry.category}</Badge>
                      <Text size="xs" lineClamp={1}>{entry.text}</Text>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {sections.activity.completed.length > 0 && (
              <div className="mb-2">
                <Text size="xs" c="dimmed" className="mb-1">Completed</Text>
                <div className="flex flex-col gap-0.5">
                  {sections.activity.completed.map((entry, idx) => (
                    <div
                      key={`d-${idx}`}
                      className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-[var(--mantine-color-dark-5)] cursor-pointer transition-colors"
                      onClick={() => onSwitchToTasks?.(entry.category)}
                    >
                      <Badge size="xs" variant="light" color="green">{entry.category}</Badge>
                      <Text size="xs" c="dimmed" td="line-through" lineClamp={1}>{entry.text}</Text>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {sections.activity.created.length === 0 && sections.activity.completed.length === 0 && (
              <Text size="xs" c="dimmed">No task activity for this day</Text>
            )}
          </div>

          {/* Notes section */}
          {sections.notes.length > 0 && (
            <div>
              <Text size="xs" fw={600} c="dimmed" className="mb-1.5">Notes</Text>
              <div className="flex flex-col gap-1">
                {sections.notes.map((line, idx) => (
                  <Text key={idx} size="sm">{line}</Text>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
