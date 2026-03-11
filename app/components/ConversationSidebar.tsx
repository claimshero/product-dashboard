import { ActionIcon, Button, NavLink, ScrollArea, Text } from "@mantine/core";
import type { ConversationSummary } from "~/types/chat";

interface ConversationSidebarProps {
  conversations: ConversationSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMs / 3_600_000);
  const diffDay = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function ConversationSidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
}: ConversationSidebarProps) {
  return (
    <div className="flex h-full flex-col bg-[var(--mantine-color-dark-7)]">
      <div className="p-3">
        <Button
          fullWidth
          variant="light"
          color="blue"
          onClick={onNew}
          leftSection={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          }
        >
          New Chat
        </Button>
      </div>

      <ScrollArea className="flex-1" type="auto">
        <div className="flex flex-col gap-0.5 px-2 pb-2">
          {conversations.map((conv) => (
            <NavLink
              key={conv.id}
              active={conv.id === activeId}
              onClick={() => onSelect(conv.id)}
              label={
                <Text size="sm" lineClamp={1}>
                  {conv.title}
                </Text>
              }
              description={
                <Text size="xs" c="dimmed">
                  {formatRelativeTime(conv.updatedAt)}
                </Text>
              }
              rightSection={
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  color="red"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(conv.id);
                  }}
                  aria-label="Delete conversation"
                  className="opacity-0 group-hover/navlink:opacity-100"
                  style={{ opacity: conv.id === activeId ? 0.7 : undefined }}
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
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                  </svg>
                </ActionIcon>
              }
              styles={{
                root: {
                  borderRadius: "var(--mantine-radius-sm)",
                },
              }}
            />
          ))}

          {conversations.length === 0 && (
            <Text size="sm" c="dimmed" ta="center" py="lg">
              No conversations yet
            </Text>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
