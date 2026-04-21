import { ScrollArea, Loader, Text, Badge, Button } from "@mantine/core";
import Markdown from "react-markdown";
import type { NavNode } from "~/types/navigation";
import {
  useCompetitorProfile,
  useCompetitorSignals,
  useSignalContent,
  useBriefingContent,
  useWeeklyBriefingContent,
  usePartnershipContent,
  useStrategyDoc,
  type IntelSignal,
} from "~/hooks/useIntel";

interface IntelligenceViewProps {
  selectedNode: NavNode | null;
  latestBriefingDate: string | null;
}

function ExportButton({ type, id, label }: { type: string; id: string; label?: string }) {
  const openExport = () => {
    window.open(`http://localhost:4001/api/intel/export/${type}/${id}`, "_blank");
  };

  return (
    <Button size="xs" variant="light" color="gray" onClick={openExport}>
      {label || "Export PDF"}
    </Button>
  );
}

function ViewHeader({ title, exportType, exportId, extra }: { title: string; exportType: string; exportId: string; extra?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 pt-3 pb-1">
      <Text size="xs" c="dimmed" fw={600} tt="uppercase" className="tracking-wider">
        {title}
      </Text>
      <div className="flex items-center gap-2">
        {extra}
        <ExportButton type={exportType} id={exportId} />
      </div>
    </div>
  );
}

function MarkdownView({ content, loading, header }: { content: string | null; loading: boolean; header?: React.ReactNode }) {
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
    <div className="flex h-full flex-col overflow-hidden">
      {header}
      <ScrollArea className="flex-1" type="auto" scrollbarSize={6} style={{ minHeight: 0 }}>
        <div className="prose prose-invert max-w-none p-4">
          <Markdown>{content}</Markdown>
        </div>
      </ScrollArea>
    </div>
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
    <div className="flex h-full flex-col overflow-hidden">
      <ViewHeader title={`Competitor — ${slug}`} exportType="competitor" exportId={slug} />
      <ScrollArea className="flex-1" type="auto" scrollbarSize={6} style={{ minHeight: 0 }}>
        <div className="prose prose-invert max-w-none p-4 pt-2">
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
    </div>
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
  return (
    <MarkdownView
      content={content}
      loading={loading}
      header={<ViewHeader title="Signal" exportType="competitor-signal" exportId={`${competitorSlug}--${signalSlug}`} />}
    />
  );
}

function MarketSignalView({ signalSlug }: { signalSlug: string }) {
  const { content, loading } = useSignalContent("market", signalSlug);
  return (
    <MarkdownView
      content={content}
      loading={loading}
      header={<ViewHeader title="Market Signal" exportType="market-signal" exportId={signalSlug} />}
    />
  );
}

function BriefingView({ date }: { date: string }) {
  const { content, loading } = useBriefingContent(date);
  return (
    <MarkdownView
      content={content}
      loading={loading}
      header={<ViewHeader title={`Daily Briefing — ${date}`} exportType="briefing" exportId={date} />}
    />
  );
}

function WeeklyBriefingView({ week }: { week: string }) {
  const { content, loading } = useWeeklyBriefingContent(week);

  const openHtmlVersion = () => {
    window.open(`http://localhost:4001/api/intel/export/weekly-briefing-html/${week}`, "_blank");
  };

  const execButton = (
    <Button size="xs" variant="light" color="violet" onClick={openHtmlVersion}>
      Executive Version
    </Button>
  );

  return (
    <MarkdownView
      content={content}
      loading={loading}
      header={<ViewHeader title="Weekly Leadership Briefing" exportType="weekly-briefing" exportId={week} extra={execButton} />}
    />
  );
}

function PartnershipView({ slug }: { slug: string }) {
  const { content, loading } = usePartnershipContent(slug);
  return (
    <MarkdownView
      content={content}
      loading={loading}
      header={<ViewHeader title={`Partnership — ${slug}`} exportType="partnership" exportId={slug} />}
    />
  );
}

function StrategyDocView({ docType }: { docType: "strategic-context" | "watch-list" | "sources" }) {
  const { content, loading } = useStrategyDoc(docType);
  const titles: Record<string, string> = {
    "strategic-context": "Strategic Context Snapshot",
    "watch-list": "Watch List",
    "sources": "Sources & Queries",
  };
  const exportType = docType === "strategic-context" ? "strategy" : docType;
  const exportId = docType === "strategic-context" ? "strategic-context-snapshot" : docType;
  return (
    <MarkdownView
      content={content}
      loading={loading}
      header={<ViewHeader title={titles[docType]} exportType={exportType} exportId={exportId} />}
    />
  );
}

function LatestBriefingView({ date }: { date: string }) {
  const { content, loading } = useBriefingContent(date);
  return (
    <MarkdownView
      content={content}
      loading={loading}
      header={<ViewHeader title={`Latest Briefing — ${date}`} exportType="briefing" exportId={date} />}
    />
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
      case "weekly-briefing":
        content = <WeeklyBriefingView week={selectedNode.week} />;
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
