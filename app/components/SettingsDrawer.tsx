import { ActionIcon, Button, Combobox, Drawer, Input, InputBase, Text, TextInput, Tooltip, useCombobox } from "@mantine/core";
import { useMemo, useState } from "react";
import { useTrackedInterests, type TrackedInterest } from "~/hooks/useTrackedInterests";

function groupByCategory(interests: TrackedInterest[]): Map<string, TrackedInterest[]> {
  const groups = new Map<string, TrackedInterest[]>();
  for (const interest of interests) {
    const cat = interest.category || "Other";
    const list = groups.get(cat);
    if (list) {
      list.push(interest);
    } else {
      groups.set(cat, [interest]);
    }
  }
  return groups;
}

const inputStyles = {
  input: {
    backgroundColor: "var(--mantine-color-dark-6)",
    border: "1px solid var(--mantine-color-dark-4)",
  },
  label: { color: "var(--mantine-color-dark-2)", fontSize: 11 },
};

function CategorySelect({
  value,
  onChange,
  existingCategories,
}: {
  value: string;
  onChange: (val: string) => void;
  existingCategories: string[];
}) {
  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
  });
  const [search, setSearch] = useState(value);

  const filtered = existingCategories.filter((cat) =>
    cat.toLowerCase().includes(search.toLowerCase().trim())
  );

  const exactMatch = existingCategories.some(
    (cat) => cat.toLowerCase() === search.toLowerCase().trim()
  );

  const options = filtered.map((cat) => (
    <Combobox.Option value={cat} key={cat}>
      {cat}
    </Combobox.Option>
  ));

  return (
    <Combobox
      store={combobox}
      onOptionSubmit={(val) => {
        if (val === "$create") {
          onChange(search.trim());
        } else {
          onChange(val);
          setSearch(val);
        }
        combobox.closeDropdown();
      }}
    >
      <Combobox.Target>
        <InputBase
          label="Category"
          size="xs"
          rightSection={<Combobox.Chevron />}
          rightSectionPointerEvents="none"
          placeholder="Select or type a new category"
          value={search}
          onChange={(e) => {
            const val = e.currentTarget.value;
            setSearch(val);
            onChange(val);
            combobox.openDropdown();
            combobox.updateSelectedOptionIndex();
          }}
          onClick={() => combobox.openDropdown()}
          onFocus={() => combobox.openDropdown()}
          onBlur={() => combobox.closeDropdown()}
          styles={inputStyles}
        />
      </Combobox.Target>

      <Combobox.Dropdown
        style={{
          backgroundColor: "var(--mantine-color-dark-7)",
          border: "1px solid var(--mantine-color-dark-4)",
        }}
      >
        <Combobox.Options>
          {options}
          {!exactMatch && search.trim().length > 0 && (
            <Combobox.Option value="$create">
              + Create "{search.trim()}"
            </Combobox.Option>
          )}
          {filtered.length === 0 && search.trim().length === 0 && (
            <Combobox.Empty>No categories yet</Combobox.Empty>
          )}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}

function InterestRow({
  interest,
  existingCategories,
  onUpdate,
  onRemove,
}: {
  interest: TrackedInterest;
  existingCategories: string[];
  onUpdate: (id: string, updates: Partial<Pick<TrackedInterest, "topic" | "category" | "context" | "sourceUrl">>) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [topic, setTopic] = useState(interest.topic);
  const [category, setCategory] = useState(interest.category ?? "");
  const [context, setContext] = useState(interest.context ?? "");
  const [sourceUrl, setSourceUrl] = useState(interest.sourceUrl ?? "");

  const handleSave = async () => {
    await onUpdate(interest.id, {
      topic: topic.trim(),
      category: category.trim(),
      context: context.trim(),
      sourceUrl: sourceUrl.trim(),
    });
    setEditing(false);
  };

  const handleCancel = () => {
    setTopic(interest.topic);
    setCategory(interest.category ?? "");
    setContext(interest.context ?? "");
    setSourceUrl(interest.sourceUrl ?? "");
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex flex-col gap-2 rounded bg-[var(--mantine-color-dark-6)] p-3">
        <TextInput
          label="Topic"
          value={topic}
          onChange={(e) => setTopic(e.currentTarget.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          size="xs"
          styles={inputStyles}
        />
        <CategorySelect
          value={category}
          onChange={setCategory}
          existingCategories={existingCategories}
        />
        <TextInput
          label="Context"
          placeholder="Optional — what to watch for"
          value={context}
          onChange={(e) => setContext(e.currentTarget.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          size="xs"
          styles={inputStyles}
        />
        <TextInput
          label="Source URL"
          placeholder="Optional"
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.currentTarget.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          size="xs"
          styles={inputStyles}
        />
        <div className="flex justify-end gap-2">
          <Button size="xs" variant="subtle" color="gray" onClick={handleCancel}>
            Cancel
          </Button>
          <Button size="xs" variant="light" color="blue" onClick={handleSave}>
            Save
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-start gap-3 rounded px-3 py-1.5 hover:bg-[var(--mantine-color-dark-6)] transition-colors">
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
          <Text size="xs" c="dimmed" lineClamp={2}>
            {interest.context}
          </Text>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Tooltip label="Edit">
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            className="mt-0.5"
            onClick={() => setEditing(true)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              <path d="m15 5 4 4" />
            </svg>
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Stop tracking">
          <ActionIcon
            variant="subtle"
            color="red"
            size="sm"
            className="mt-0.5"
            onClick={() => onRemove(interest.id)}
          >
            <span style={{ fontSize: 14 }}>&#x2715;</span>
          </ActionIcon>
        </Tooltip>
      </div>
    </div>
  );
}

export function SettingsDrawer({
  opened,
  onClose,
}: {
  opened: boolean;
  onClose: () => void;
}) {
  const { interests, addInterest, updateInterest, removeInterest } = useTrackedInterests();
  const [adding, setAdding] = useState(false);
  const [newTopic, setNewTopic] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newContext, setNewContext] = useState("");
  const [newSourceUrl, setNewSourceUrl] = useState("");

  const grouped = useMemo(() => groupByCategory(interests), [interests]);

  const existingCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const i of interests) {
      if (i.category) cats.add(i.category);
    }
    return [...cats].sort();
  }, [interests]);

  const handleAdd = async () => {
    const topic = newTopic.trim();
    if (!topic) return;
    await addInterest(
      topic,
      newContext.trim() || undefined,
      newSourceUrl.trim() || undefined,
      newCategory.trim() || undefined
    );
    setNewTopic("");
    setNewCategory("");
    setNewContext("");
    setNewSourceUrl("");
    setAdding(false);
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
            <CategorySelect
              value={newCategory}
              onChange={setNewCategory}
              existingCategories={existingCategories}
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

        {/* Interest list grouped by category */}
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
          <div className="flex flex-col gap-4">
            {[...grouped.entries()].map(([category, items]) => (
              <div key={category}>
                <Text size="xs" fw={600} c="dimmed" className="mb-1 uppercase tracking-wider">
                  {category}
                </Text>
                <div className="flex flex-col gap-0.5">
                  {items.map((interest) => (
                    <InterestRow
                      key={interest.id}
                      interest={interest}
                      existingCategories={existingCategories}
                      onUpdate={updateInterest}
                      onRemove={removeInterest}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Drawer>
  );
}
