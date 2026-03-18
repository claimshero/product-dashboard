import { ActionIcon, Button, Drawer, Text, TextInput, Tooltip } from "@mantine/core";
import { useState } from "react";
import { useTrackedInterests } from "~/hooks/useTrackedInterests";

export function SettingsDrawer({
  opened,
  onClose,
}: {
  opened: boolean;
  onClose: () => void;
}) {
  const { interests, addInterest, removeInterest } = useTrackedInterests();
  const [adding, setAdding] = useState(false);
  const [newTopic, setNewTopic] = useState("");
  const [newContext, setNewContext] = useState("");
  const [newSourceUrl, setNewSourceUrl] = useState("");

  const handleAdd = async () => {
    const topic = newTopic.trim();
    if (!topic) return;
    await addInterest(topic, newContext.trim() || undefined, newSourceUrl.trim() || undefined);
    setNewTopic("");
    setNewContext("");
    setNewSourceUrl("");
    setAdding(false);
  };

  const inputStyles = {
    input: {
      backgroundColor: "var(--mantine-color-dark-6)",
      border: "1px solid var(--mantine-color-dark-4)",
    },
    label: { color: "var(--mantine-color-dark-2)", fontSize: 11 },
  };

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title="Settings"
      position="right"
      size="md"
      styles={{
        header: {
          backgroundColor: "var(--mantine-color-dark-7)",
          borderBottom: "1px solid var(--mantine-color-dark-4)",
        },
        body: { backgroundColor: "var(--mantine-color-dark-7)", padding: 0 },
        content: { backgroundColor: "var(--mantine-color-dark-7)" },
        title: { fontWeight: 600 },
      }}
    >
      {/* Tracked Interests section */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <Text size="sm" fw={600} c="gray.2">
            Tracked Topics
          </Text>
          <Button
            size="xs"
            variant="light"
            color="blue"
            onClick={() => setAdding((v) => !v)}
          >
            {adding ? "Cancel" : "Add topic"}
          </Button>
        </div>

        <Text size="xs" c="dimmed" className="mb-3">
          Topics you're tracking will be included in your daily briefing. The agent will search for new developments on each topic.
        </Text>

        {/* Add form */}
        {adding && (
          <div className="mb-4 flex flex-col gap-2 rounded bg-[var(--mantine-color-dark-6)] p-3">
            <TextInput
              label="Topic"
              placeholder="e.g. Meditech Claim Denial Agent"
              value={newTopic}
              onChange={(e) => setNewTopic(e.currentTarget.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              size="xs"
              styles={inputStyles}
            />
            <TextInput
              label="Context"
              placeholder="Optional — what to watch for"
              value={newContext}
              onChange={(e) => setNewContext(e.currentTarget.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              size="xs"
              styles={inputStyles}
            />
            <TextInput
              label="Source URL"
              placeholder="Optional"
              value={newSourceUrl}
              onChange={(e) => setNewSourceUrl(e.currentTarget.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              size="xs"
              styles={inputStyles}
            />
            <div className="flex justify-end">
              <Button size="xs" variant="light" color="blue" onClick={handleAdd}>
                Track
              </Button>
            </div>
          </div>
        )}

        {/* Interest list */}
        {interests.length === 0 ? (
          <div className="rounded bg-[var(--mantine-color-dark-6)] px-3 py-4 text-center">
            <Text size="sm" c="dimmed">
              No topics tracked yet
            </Text>
            <Text size="xs" c="dimmed" className="mt-1">
              Add topics here or click "+" on any bullet point in your daily briefing
            </Text>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {interests.map((interest) => (
              <div
                key={interest.id}
                className="group flex items-start gap-3 rounded px-3 py-2 hover:bg-[var(--mantine-color-dark-6)] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <Text size="sm" c="gray.2" fw={500}>
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
                  </Text>
                  {interest.context && (
                    <Text size="xs" c="dimmed" className="mt-0.5">
                      {interest.context}
                    </Text>
                  )}
                  <Text size="xs" c="dark.3" className="mt-0.5">
                    Added {new Date(interest.addedAt).toLocaleDateString()}
                  </Text>
                </div>
                <Tooltip label="Stop tracking">
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    size="sm"
                    className="mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeInterest(interest.id)}
                  >
                    <span style={{ fontSize: 14 }}>&#x2715;</span>
                  </ActionIcon>
                </Tooltip>
              </div>
            ))}
          </div>
        )}
      </div>
    </Drawer>
  );
}
