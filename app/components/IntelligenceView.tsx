import { ScrollArea, Loader, Text, Badge } from "@mantine/core";
import Markdown from "react-markdown";
import type { NavNode } from "~/types/navigation";
import {
  useCompetitorProfile,
  useCompetitorSignals,
  useSignalContent,
  useBriefingContent,
  usePartnershipContent,
  useStrategyDoc,
  type IntelSignal,
} from "~/hooks/useIntel";

interface IntelligenceViewProps {
  selectedNode: NavNode | null;
  latestBriefingDate: string | null;
}

function MarkdownView({ content, loading }: { content: string | null; loading: boolean }) {
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
        <Text size="sm" c="dimmed">Could not load content</Text>
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

function CompetitorView({ slug }: { slug: string }) {
  const { content, loading } = useCompetitorProfile(slug);
  const { signals, loading: signalsLoading } = useCompetitorSignals(slug);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader size="sm" />
      </div>
    );
  }

  return (
    <ScrollArea className="h-full" type="auto" scrollbarSize={6}>
      <div className="prose prose-invert max-w-none p-4">
        {content && <Markdown>{content}</Markdown>}
      </div>

      {/* Signal Timeline */}
      {signals.length > 0 && (
        <div className="border-t px-4 pb-4" style={{ borderColor: "var(--mantine-color-dark-4)" }}>
          <h3 className="mb-2 mt-3 text-sm font-semibold" style={{ color: "var(--mantine-color-dark-1)" }}>
            Signal History ({signals.length})
          </h3>
          <SignalTimeline signals={signals} />
        </div>
      )}

      {signalsLoading && (
        <div className="flex items-center gap-2 px-4 py-2">
          <Loader size={12} />
          <Text size="xs" c="dimmed">Loading signals...</Text>
        </div>
      )}
    </ScrollArea>
  );
}

function SignalTimeline({ signals }: { signals: IntelSignal[] }) {
  const relevanceColors: Record<string, string> = {
    critical: "red",
    high: "orange",
    medium: "yellow",
    low: "gray",
  };

  return (
    <div className="flex flex-col gap-1">
      {signals.map((signal) => (
        <div
          key={signal.slug}
          className="flex items-center gap-2 rounded px-2 py-1.5 text-sm"
          style={{ backgroundColor: "var(--mantine-color-dark-6)" }}
        >
          <Badge
            size="xs"
            variant="filled"
            color={relevanceColors[signal.relevance] ?? "gray"}
            styles={{ root: { flexShrink: 0, textTransform: "none", fontWeight: 500 } }}
          >
            {signal.relevance}
          </Badge>
          <span className="truncate" style={{ color: "var(--mantine-color-dark-0)" }}>
            {signal.title}
          </span>
          <span className="ml-auto flex-shrink-0 text-xs" style={{ color: "var(--mantine-color-dark-3)" }}>
            {signal.date}
          </span>
          {signal.signalType && (
            <Badge
              size="xs"
              variant="light"
              color="blue"
              styles={{ root: { flexShrink: 0, textTransform: "none", fontWeight: 400 } }}
            >
              {signal.signalType}
            </Badge>
          )}
        </div>
      ))}
    </div>
  );
}

function CompetitorSignalView({ competitorSlug, signalSlug }: { competitorSlug: string; signalSlug: string }) {
  const { content, loading } = useSignalContent(competitorSlug, signalSlug);
  return <MarkdownView content={content} loading={loading} />;
}

function MarketSignalView({ signalSlug }: { signalSlug: string }) {
  const { content, loading } = useSignalContent("market", signalSlug);
  return <MarkdownView content={content} loading={loading} />;
}

function BriefingView({ date }: { date: string }) {
  const { content, loading } = useBriefingContent(date);
  return <MarkdownView content={content} loading={loading} />;
}

function PartnershipView({ slug }: { slug: string }) {
  const { content, loading } = usePartnershipContent(slug);
  return <MarkdownView content={content} loading={loading} />;
}

function StrategyDocView({ docType }: { docType: "strategic-context" | "watch-list" | "sources" }) {
  const { content, loading } = useStrategyDoc(docType);
  return <MarkdownView content={content} loading={loading} />;
}

function LatestBriefingView({ date }: { date: string }) {
  const { content, loading } = useBriefingContent(date);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader size="sm" />
      </div>
    );
  }

  return (
    <ScrollArea className="h-full" type="auto" scrollbarSize={6}>
      <div className="px-4 pt-3 pb-1">
        <Text size="xs" c="dimmed" fw={600} tt="uppercase" className="tracking-wider">
          Latest Briefing — {date}
        </Text>
      </div>
      <div className="prose prose-invert max-w-none p-4 pt-2">
        {content && <Markdown>{content}</Markdown>}
      </div>
    </ScrollArea>
  );
}

export function IntelligenceView({ selectedNode, latestBriefingDate }: IntelligenceViewProps) {
  let content: React.ReactNode;

  if (!selectedNode) {
    if (latestBriefingDate) {
      content = <LatestBriefingView date={latestBriefingDate} />;
    } else {
      content = (
        <div className="flex h-full items-center justify-center">
          <Text c="dimmed" size="sm">Select an item from the intelligence tree</Text>
        </div>
      );
    }
  } else {
    switch (selectedNode.type) {
      case "competitor":
        content = <CompetitorView slug={selectedNode.slug} />;
        break;
      case "competitor-signal":
        content = <CompetitorSignalView competitorSlug={selectedNode.competitorSlug} signalSlug={selectedNode.signalSlug} />;
        break;
      case "market-signal":
        content = <MarketSignalView signalSlug={selectedNode.signalSlug} />;
        break;
      case "briefing":
        content = <BriefingView date={selectedNode.date} />;
        break;
      case "intel-partnership":
        content = <PartnershipView slug={selectedNode.slug} />;
        break;
      case "strategy-doc":
        content = <StrategyDocView docType={selectedNode.docType} />;
        break;
      default:
        content = (
          <div className="flex h-full items-center justify-center">
            <Text c="dimmed" size="sm">Select an item from the intelligence tree</Text>
          </div>
        );
    }
  }

  return <div className="flex h-full flex-col overflow-hidden">{content}</div>;
}
