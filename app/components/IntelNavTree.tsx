import { useState, useCallback, useRef, useEffect } from "react";
import { ScrollArea, Badge, Loader, TextInput, ActionIcon, Tooltip } from "@mantine/core";
import type { NavNode } from "~/types/navigation";
import { navNodeId } from "~/types/navigation";
import type { CompetitorSummary, BriefingSummary, WeeklyBriefingSummary, PartnershipSummary, IntelSignal } from "~/hooks/useIntel";

interface IntelNavTreeProps {
  competitors: CompetitorSummary[];
  briefings: BriefingSummary[];
  weeklyBriefings: WeeklyBriefingSummary[];
  partnerships: PartnershipSummary[];
  marketSignals: IntelSignal[];
  selectedNode: NavNode | null;
  onSelectNode: (node: NavNode) => void;
  loading?: boolean;
  onRefresh?: () => void;
}

const THREAT_COLORS: Record<string, string> = {
  critical: "red",
  high: "orange",
  medium: "yellow",
  low: "gray",
};

const PARTNERSHIP_STATUS_COLORS: Record<string, string> = {
  active: "green",
  "early-talks": "yellow",
  "not-yet-contacted": "gray",
};

const RELEVANCE_COLORS: Record<string, string> = {
  critical: "red",
  high: "orange",
  medium: "yellow",
  low: "gray",
};

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
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
      style={{
        transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
        transition: "transform 150ms ease",
        flexShrink: 0,
      }}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

interface TreeRowProps {
  depth: number;
  selected?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function TreeRow({ depth, selected, onClick, children }: TreeRowProps) {
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-1.5 cursor-pointer px-2 py-1 text-sm transition-colors"
      style={{
        paddingLeft: 8 + depth * 16,
        backgroundColor: selected ? "var(--mantine-color-blue-9)" : undefined,
        color: selected ? "var(--mantine-color-white)" : "var(--mantine-color-dark-0)",
      }}
      onMouseEnter={(e) => {
        if (!selected) e.currentTarget.style.backgroundColor = "var(--mantine-color-dark-5)";
      }}
      onMouseLeave={(e) => {
        if (!selected) e.currentTarget.style.backgroundColor = "";
      }}
    >
      {children}
    </div>
  );
}

function SectionHeader({
  children,
  expanded,
  onToggle,
}: {
  children: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      onClick={onToggle}
      className="flex items-center gap-1 px-2 py-1.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-[var(--mantine-color-dark-6)] transition-colors"
      style={{ color: "var(--mantine-color-dark-2)" }}
    >
      <ChevronIcon expanded={expanded} />
      {children}
    </div>
  );
}

export function IntelNavTree({
  competitors,
  briefings,
  weeklyBriefings,
  partnerships,
  marketSignals,
  selectedNode,
  onSelectNode,
  loading,
  onRefresh,
}: IntelNavTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(["section:briefings", "section:competitors", "briefings:daily"])
  );
  const [searchQuery, setSearchQuery] = useState("");

  const toggle = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const isSelected = (node: NavNode) =>
    selectedNode ? navNodeId(node) === navNodeId(selectedNode) : false;

  // Search filter
  const q = searchQuery.toLowerCase().trim();
  const matchesSearch = (text: string) => !q || text.toLowerCase().includes(q);

  // Sort competitors by threat level
  const threatOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, unknown: 4 };
  const sortedCompetitors = [...competitors].sort(
    (a, b) => (threatOrder[a.threatLevel] ?? 4) - (threatOrder[b.threatLevel] ?? 4)
  );
  const filteredCompetitors = q
    ? sortedCompetitors.filter((c) => matchesSearch(c.name) || matchesSearch(c.category) || matchesSearch(c.threatLevel))
    : sortedCompetitors;

  const filteredBriefings = q
    ? briefings.filter((b) => matchesSearch(b.date))
    : briefings;

  const filteredPartnerships = q
    ? partnerships.filter((p) => matchesSearch(p.name) || matchesSearch(p.status) || matchesSearch(p.counterpart))
    : partnerships;

  const filteredMarketSignals = q
    ? marketSignals.filter((s) => matchesSearch(s.title) || matchesSearch(s.signalType) || matchesSearch(s.relevance))
    : marketSignals;

  return (
    <div
      className="flex h-full flex-col"
      style={{ backgroundColor: "var(--mantine-color-dark-7)" }}
    >
      {/* Search */}
      <div
        className="flex items-center gap-1 border-b px-2 py-2"
        style={{ borderColor: "var(--mantine-color-dark-4)" }}
      >
        <TextInput
          size="xs"
          placeholder="Search intelligence..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.currentTarget.value)}
          className="flex-1"
          styles={{
            input: {
              backgroundColor: "var(--mantine-color-dark-6)",
              border: "1px solid var(--mantine-color-dark-4)",
            },
          }}
        />
        {loading && <Loader size={14} />}
        {onRefresh && (
          <Tooltip label="Refresh">
            <ActionIcon variant="subtle" color="gray" size="xs" onClick={onRefresh}>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </ActionIcon>
          </Tooltip>
        )}
      </div>

      {/* Tree */}
      <ScrollArea className="flex-1" type="auto" scrollbarSize={6}>
        <div className="py-1">
          {/* === Briefings === */}
          <SectionHeader
            expanded={expanded.has("section:briefings")}
            onToggle={() => toggle("section:briefings")}
          >
            Briefings
          </SectionHeader>

          {expanded.has("section:briefings") && (
            <>
              {/* Weekly sub-section */}
              <TreeRow
                depth={0}
                onClick={() => toggle("briefings:weekly")}
              >
                <ChevronIcon expanded={expanded.has("briefings:weekly")} />
                <span className="text-xs font-semibold" style={{ color: "var(--mantine-color-dark-1)" }}>Weekly Leadership</span>
                <span className="ml-auto text-xs opacity-40">{weeklyBriefings.length}</span>
              </TreeRow>

              {expanded.has("briefings:weekly") &&
                weeklyBriefings.map((wb) => {
                  const node: NavNode = { type: "weekly-briefing", week: wb.week, dates: wb.dates };
                  return (
                    <TreeRow
                      key={wb.week}
                      depth={1}
                      selected={isSelected(node)}
                      onClick={() => onSelectNode(node)}
                    >
                      <span className="truncate">{wb.dates || wb.week}</span>
                      {wb.criticalSignals > 0 && (
                        <Badge size="xs" variant="filled" color="red" styles={{ root: { flexShrink: 0, textTransform: "none", fontWeight: 500 } }}>
                          {wb.criticalSignals} critical
                        </Badge>
                      )}
                      <span className="ml-auto text-xs opacity-40">{wb.signalsCount} signals</span>
                    </TreeRow>
                  );
                })}

              {/* Daily sub-section */}
              <TreeRow
                depth={0}
                onClick={() => toggle("briefings:daily")}
              >
                <ChevronIcon expanded={expanded.has("briefings:daily")} />
                <span className="text-xs font-semibold" style={{ color: "var(--mantine-color-dark-1)" }}>Daily</span>
                <span className="ml-auto text-xs opacity-40">{filteredBriefings.length}</span>
              </TreeRow>

              {expanded.has("briefings:daily") &&
                filteredBriefings.map((briefing) => {
                  const node: NavNode = { type: "briefing", date: briefing.date };
                  return (
                    <TreeRow
                      key={briefing.date}
                      depth={1}
                      selected={isSelected(node)}
                      onClick={() => onSelectNode(node)}
                    >
                      <span className="truncate">{briefing.date}</span>
                      {briefing.criticalSignals > 0 && (
                        <Badge size="xs" variant="filled" color="red" styles={{ root: { flexShrink: 0, textTransform: "none", fontWeight: 500 } }}>
                          {briefing.criticalSignals} critical
                        </Badge>
                      )}
                      <span className="ml-auto text-xs opacity-40">{briefing.signalsCount} signals</span>
                    </TreeRow>
                  );
                })}
            </>
          )}

          {/* === Competitors === */}
          <SectionHeader
            expanded={expanded.has("section:competitors")}
            onToggle={() => toggle("section:competitors")}
          >
            Competitors
          </SectionHeader>

          {expanded.has("section:competitors") &&
            filteredCompetitors.map((competitor) => {
              const compExpanded = expanded.has(`competitor:${competitor.slug}`);
              const node: NavNode = {
                type: "competitor",
                slug: competitor.slug,
                name: competitor.name,
                threatLevel: competitor.threatLevel,
              };

              return (
                <div key={competitor.slug}>
                  <TreeRow
                    depth={0}
                    selected={isSelected(node)}
                    onClick={() => {
                      onSelectNode(node);
                      toggle(`competitor:${competitor.slug}`);
                    }}
                  >
                    {competitor.signalCount > 0 ? (
                      <ChevronIcon expanded={compExpanded} />
                    ) : (
                      <span style={{ width: 14, flexShrink: 0 }} />
                    )}
                    <Badge
                      size="xs"
                      variant="filled"
                      color={THREAT_COLORS[competitor.threatLevel] ?? "gray"}
                      styles={{ root: { flexShrink: 0, textTransform: "none", fontWeight: 500 } }}
                    >
                      {competitor.threatLevel}
                    </Badge>
                    <span className="truncate">{competitor.name}</span>
                    {competitor.signalCount > 0 && (
                      <span className="ml-auto text-xs opacity-40">{competitor.signalCount}</span>
                    )}
                  </TreeRow>

                  {/* Signal children are loaded lazily when expanded */}
                  {compExpanded && (
                    <CompetitorSignals
                      slug={competitor.slug}
                      selectedNode={selectedNode}
                      onSelectNode={onSelectNode}
                    />
                  )}
                </div>
              );
            })}

          {/* === Market Signals === */}
          {filteredMarketSignals.length > 0 && (
            <>
              <SectionHeader
                expanded={expanded.has("section:market-signals")}
                onToggle={() => toggle("section:market-signals")}
              >
                Market Signals
              </SectionHeader>

              {expanded.has("section:market-signals") &&
                filteredMarketSignals.map((signal) => {
                  const node: NavNode = {
                    type: "market-signal",
                    signalSlug: signal.slug,
                    title: signal.title,
                    relevance: signal.relevance,
                  };
                  return (
                    <TreeRow
                      key={signal.slug}
                      depth={0}
                      selected={isSelected(node)}
                      onClick={() => onSelectNode(node)}
                    >
                      <Badge
                        size="xs"
                        variant="filled"
                        color={RELEVANCE_COLORS[signal.relevance] ?? "gray"}
                        styles={{ root: { flexShrink: 0, textTransform: "none", fontWeight: 500 } }}
                      >
                        {signal.relevance}
                      </Badge>
                      <span className="truncate">{signal.title}</span>
                      <span className="ml-auto text-xs opacity-40">{signal.date}</span>
                    </TreeRow>
                  );
                })}
            </>
          )}

          {/* === Partnerships === */}
          <SectionHeader
            expanded={expanded.has("section:partnerships")}
            onToggle={() => toggle("section:partnerships")}
          >
            Partnerships
          </SectionHeader>

          {expanded.has("section:partnerships") &&
            filteredPartnerships.map((partnership) => {
              const node: NavNode = {
                type: "intel-partnership",
                slug: partnership.slug,
                name: partnership.name,
                status: partnership.status,
              };
              return (
                <TreeRow
                  key={partnership.slug}
                  depth={0}
                  selected={isSelected(node)}
                  onClick={() => onSelectNode(node)}
                >
                  <Badge
                    size="xs"
                    variant="filled"
                    color={PARTNERSHIP_STATUS_COLORS[partnership.status] ?? "gray"}
                    styles={{ root: { flexShrink: 0, textTransform: "none", fontWeight: 500 } }}
                  >
                    {partnership.status.replace(/-/g, " ")}
                  </Badge>
                  <span className="truncate">{partnership.name}</span>
                </TreeRow>
              );
            })}

          {/* === Strategy === */}
          <SectionHeader
            expanded={expanded.has("section:strategy")}
            onToggle={() => toggle("section:strategy")}
          >
            Strategy
          </SectionHeader>

          {expanded.has("section:strategy") && (
            <>
              <TreeRow
                depth={0}
                selected={isSelected({ type: "strategy-doc", docType: "strategic-context" })}
                onClick={() => onSelectNode({ type: "strategy-doc", docType: "strategic-context" })}
              >
                <span className="truncate">Strategic Context Snapshot</span>
              </TreeRow>
              <TreeRow
                depth={0}
                selected={isSelected({ type: "strategy-doc", docType: "watch-list" })}
                onClick={() => onSelectNode({ type: "strategy-doc", docType: "watch-list" })}
              >
                <span className="truncate">Watch List</span>
              </TreeRow>
              <TreeRow
                depth={0}
                selected={isSelected({ type: "strategy-doc", docType: "sources" })}
                onClick={() => onSelectNode({ type: "strategy-doc", docType: "sources" })}
              >
                <span className="truncate">Sources & Queries</span>
              </TreeRow>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

/** Lazily loads and shows signal children for a competitor */
function CompetitorSignals({
  slug,
  selectedNode,
  onSelectNode,
}: {
  slug: string;
  selectedNode: NavNode | null;
  onSelectNode: (node: NavNode) => void;
}) {
  const [signals, setSignals] = useState<IntelSignal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`http://localhost:4001/api/intel/competitors/${slug}/signals`)
      .then((r) => r.json())
      .then((data) => setSignals(data.signals ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-2 py-1" style={{ paddingLeft: 24 }}>
        <Loader size={12} />
        <span className="text-xs opacity-50">Loading signals...</span>
      </div>
    );
  }

  if (signals.length === 0) {
    return (
      <div className="px-2 py-1 text-xs opacity-40" style={{ paddingLeft: 40 }}>
        No signals
      </div>
    );
  }

  return (
    <>
      {signals.map((signal) => {
        const node: NavNode = {
          type: "competitor-signal",
          competitorSlug: slug,
          signalSlug: signal.slug,
          title: signal.title,
          relevance: signal.relevance,
        };
        const selected = selectedNode ? navNodeId(node) === navNodeId(selectedNode) : false;

        return (
          <TreeRow
            key={signal.slug}
            depth={1}
            selected={selected}
            onClick={() => onSelectNode(node)}
          >
            <Badge
              size="xs"
              variant="light"
              color={RELEVANCE_COLORS[signal.relevance] ?? "gray"}
              styles={{ root: { flexShrink: 0, textTransform: "none", fontWeight: 500 } }}
            >
              {signal.relevance}
            </Badge>
            <span className="truncate">{signal.title}</span>
            <span className="ml-auto text-xs opacity-40">{signal.date}</span>
          </TreeRow>
        );
      })}
    </>
  );
}
