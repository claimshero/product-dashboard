import { ScrollArea, Loader, Text } from "@mantine/core";
import Markdown from "react-markdown";
import type { NavNode } from "~/types/navigation";
import { useBetContent } from "~/hooks/useBets";
import { DailyBriefing } from "./DailyBriefing";

interface DiscoveryViewProps {
  selectedNode: NavNode | null;
}

function BetFileView({ slug, filePath }: { slug: string; filePath: string }) {
  const { content, loading } = useBetContent(slug, filePath);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader size="sm" />
      </div>
    );
  }

  if (!content) {
    return (
      <div className="p-8 text-center">
        <Text size="sm" c="dimmed">Could not load file</Text>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full" type="auto" scrollbarSize={6}>
      <div className="prose prose-invert max-w-none p-4">
        <Markdown>{content}</Markdown>
      </div>
    </ScrollArea>
  );
}

function JiraItemView({ node }: { node: NavNode & { key: string; summary: string } }) {
  return (
    <ScrollArea className="h-full" type="auto" scrollbarSize={6}>
      <div className="p-4">
        <Text size="lg" fw={600} mb="xs">{node.summary}</Text>
        <Text size="sm" c="dimmed">
          {node.key} — Select this item to view details in the right panel
        </Text>
      </div>
    </ScrollArea>
  );
}

export function DiscoveryView({ selectedNode }: DiscoveryViewProps) {
  if (!selectedNode) {
    return <DailyBriefing />;
  }

  switch (selectedNode.type) {
    case "bet":
      return <BetFileView slug={selectedNode.slug} filePath="bet.md" />;
    case "bet-file":
      return <BetFileView slug={selectedNode.slug} filePath={selectedNode.filePath} />;
    case "jira-idea":
    case "jira-epic":
    case "jira-story":
      return <JiraItemView node={selectedNode} />;
    default:
      return null;
  }
}
