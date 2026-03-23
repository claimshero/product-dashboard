import { useState, useCallback, useEffect, useRef } from "react";
import { ScrollArea, ActionIcon, Tooltip, Badge, Loader } from "@mantine/core";
import { TextInput } from "@mantine/core";
import type { BetSummary, JiraIdea, MeetingNote, ClientPartnerSummary, NavNode } from "~/types/navigation";
import { navNodeId } from "~/types/navigation";
import type { DeliveryEpic } from "~/hooks/useDelivery";

interface NavTreeProps {
  bets: BetSummary[];
  ideas: JiraIdea[];
  deliveryEpics: DeliveryEpic[];
  meetings: MeetingNote[];
  clients: ClientPartnerSummary[];
  partners: ClientPartnerSummary[];
  selectedNode: NavNode | null;
  onSelectNode: (node: NavNode) => void;
  loading?: boolean;
  onRefresh?: () => void;
}

const BET_STATUS_COLORS: Record<string, string> = {
  Shaping: "yellow",
  Review: "gray",
  Delivery: "green",
};

const RELATIONSHIP_COLORS: Record<string, string> = {
  Active: "green",
  Prospect: "yellow",
  Dormant: "gray",
};

function issueTypeEmoji(type: string): string {
  switch (type.toLowerCase()) {
    case "bet":
      return "🎯";
    case "idea":
      return "💡";
    case "epic":
      return "⚡";
    case "story":
      return "📖";
    case "task":
      return "✅";
    case "sub-task":
    case "subtask":
      return "🔹";
    case "bug":
      return "🐛";
    default:
      return "📋";
  }
}

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

function FileIcon() {
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
      style={{ flexShrink: 0, opacity: 0.5 }}
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function FolderIcon() {
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
      style={{ flexShrink: 0, opacity: 0.5 }}
    >
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
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

export function NavTree({
  bets,
  ideas,
  deliveryEpics,
  meetings,
  clients,
  partners,
  selectedNode,
  onSelectNode,
  loading,
  onRefresh,
}: NavTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["section:bets", "section:ideas"]));
  const [searchQuery, setSearchQuery] = useState("");

  const toggle = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // Track whether a selection came from within the tree (click) vs external (task click)
  const internalSelectRef = useRef(false);

  const handleSelectNode = useCallback((node: NavNode) => {
    internalSelectRef.current = true;
    onSelectNode(node);
  }, [onSelectNode]);

  const isSelected = (node: NavNode) =>
    selectedNode ? navNodeId(node) === navNodeId(selectedNode) : false;

  // Auto-expand tree to reveal selected node — only for external selections
  useEffect(() => {
    if (!selectedNode) return;
    if (internalSelectRef.current) {
      internalSelectRef.current = false;
      return;
    }

    setExpanded((prev) => {
      const next = new Set(prev);
      const node = selectedNode;

      if (node.type === "bet") {
        next.add("section:bets");
        next.add(`bet:${node.slug}`);
      } else if (node.type === "bet-file") {
        next.add("section:bets");
        next.add(`bet:${node.slug}`);
        // Expand notes or research folder
        if (node.filePath.startsWith("notes/")) next.add(`notes:${node.slug}`);
        if (node.filePath.startsWith("research/")) next.add(`research:${node.slug}`);
      } else if (node.type === "jira-idea") {
        // Check if this idea belongs to a bet
        const parentBet = bets.find((b) => b.ideaKeys.includes(node.key));
        if (parentBet) {
          next.add("section:bets");
          next.add(`bet:${parentBet.slug}`);
        } else {
          // Could be in delivery or ideas backlog
          next.add("section:delivery-ideas");
          next.add("section:ideas");
        }
        next.add(`idea:${node.key}`);
      } else if (node.type === "jira-epic") {
        // Find parent idea via delivery epics
        const parentEpic = deliveryEpics.find((e) => e.key === node.key);
        if (parentEpic?.idea) {
          const parentBet = bets.find((b) => b.ideaKeys.includes(parentEpic.idea!.key));
          if (parentBet) {
            next.add("section:bets");
            next.add(`bet:${parentBet.slug}`);
          } else {
            next.add("section:delivery-ideas");
          }
          next.add(`idea:${parentEpic.idea.key}`);
        } else {
          next.add("section:delivery-ideas");
        }
        next.add(`epic:${node.key}`);
      } else if (node.type === "client") {
        next.add("section:clients-partners");
        next.add("section:clients");
        next.add(`client:${node.slug}`);
      } else if (node.type === "partner") {
        next.add("section:clients-partners");
        next.add("section:partners");
        next.add(`partner:${node.slug}`);
      } else if (node.type === "client-file") {
        next.add("section:clients-partners");
        next.add("section:clients");
        next.add(`client:${node.slug}`);
        if (node.filePath.startsWith("notes/")) next.add(`client-notes:${node.slug}`);
      } else if (node.type === "partner-file") {
        next.add("section:clients-partners");
        next.add("section:partners");
        next.add(`partner:${node.slug}`);
        if (node.filePath.startsWith("notes/")) next.add(`partner-notes:${node.slug}`);
      } else if (node.type === "jira-story") {
        // Find parent epic
        const parentEpic = deliveryEpics.find((e) =>
          e.children.some((c) => c.key === node.key || c.children?.some((s) => s.key === node.key))
        );
        if (parentEpic) {
          if (parentEpic.idea) {
            const parentBet = bets.find((b) => b.ideaKeys.includes(parentEpic.idea!.key));
            if (parentBet) {
              next.add("section:bets");
              next.add(`bet:${parentBet.slug}`);
            } else {
              next.add("section:delivery-ideas");
            }
            next.add(`idea:${parentEpic.idea.key}`);
          } else {
            next.add("section:delivery-ideas");
          }
          next.add(`epic:${parentEpic.key}`);
        }
      }

      return next;
    });
  }, [selectedNode, bets, deliveryEpics]);

  // Resolve bet ideaKeys to full idea objects (from ideas list or delivery epics)
  const betLinkedIdeas = (ideaKeys: string[]) => {
    if (ideaKeys.length === 0) return [];
    return ideaKeys
      .map((key) => {
        // Try ideas list first, then delivery epics
        const fromIdeas = ideas.find((i) => i.key === key);
        if (fromIdeas) return fromIdeas;
        const fromEpic = deliveryEpics.find((e) => e.idea?.key === key)?.idea;
        if (fromEpic) return fromEpic;
        return null;
      })
      .filter((i): i is NonNullable<typeof i> => i !== null);
  };

  // Get ideas that are linked from delivery epics (these are "in delivery" ideas)
  const linkedIdeaKeys = new Set(
    deliveryEpics.filter((e) => e.idea).map((e) => e.idea!.key)
  );

  // Standalone ideas = ideas not linked from any delivery epic
  const standaloneIdeas = ideas.filter((i) => !linkedIdeaKeys.has(i.key));

  // Find delivery epics for a specific idea
  const epicsForIdea = (ideaKey: string) =>
    deliveryEpics.filter((e) => e.idea?.key === ideaKey);

  // Get unique ideas from delivery epics
  const deliveryIdeas = deliveryEpics
    .filter((e) => e.idea)
    .reduce<{ key: string; summary: string; status: string; statusCategory: string; url: string }[]>(
      (acc, e) => {
        if (e.idea && !acc.find((a) => a.key === e.idea!.key)) {
          acc.push(e.idea);
        }
        return acc;
      },
      []
    );

  // Orphan epics = delivery epics with no linked idea
  const orphanEpics = deliveryEpics.filter((e) => !e.idea);

  // Search filter
  const q = searchQuery.toLowerCase().trim();
  const matchesSearch = (text: string) => !q || text.toLowerCase().includes(q);

  const filteredBets = q ? bets.filter((b) => matchesSearch(b.name) || matchesSearch(b.status) || b.ideaKeys.some((k) => matchesSearch(k))) : bets;
  const filteredDeliveryIdeas = q ? deliveryIdeas.filter((i) => matchesSearch(i.summary) || matchesSearch(i.key)) : deliveryIdeas;
  const filteredStandaloneIdeas = q ? standaloneIdeas.filter((i) => matchesSearch(i.summary) || matchesSearch(i.key)) : standaloneIdeas;
  const filteredOrphanEpics = q ? orphanEpics.filter((e) => matchesSearch(e.summary) || matchesSearch(e.key)) : orphanEpics;
  const filteredMeetings = q ? meetings.filter((m) => matchesSearch(m.name) || matchesSearch(m.date)) : meetings;
  const filteredClients = q ? clients.filter((c) => matchesSearch(c.name) || matchesSearch(c.relationship) || matchesSearch(c.contact)) : clients;
  const filteredPartners = q ? partners.filter((p) => matchesSearch(p.name) || matchesSearch(p.relationship) || matchesSearch(p.contact)) : partners;

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
          placeholder="Search..."
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
          {/* === Bets Section === */}
          <SectionHeader
            expanded={expanded.has("section:bets")}
            onToggle={() => toggle("section:bets")}
          >
            Bets
          </SectionHeader>

          {expanded.has("section:bets") &&
            filteredBets.map((bet) => {
              const betExpanded = expanded.has(`bet:${bet.slug}`);
              const betNode: NavNode = { type: "bet", slug: bet.slug, name: bet.name, status: bet.status };
              const hasNotes = bet.files.notes.length > 0;
              const hasResearch = bet.files.research.length > 0;

              return (
                <div key={bet.slug}>
                  {/* Bet row */}
                  <TreeRow
                    depth={0}
                    selected={isSelected(betNode)}
                    onClick={() => {
                      handleSelectNode(betNode);
                      toggle(`bet:${bet.slug}`);
                    }}
                  >
                    <ChevronIcon expanded={betExpanded} />
                    <span style={{ fontSize: 14, flexShrink: 0 }}>{issueTypeEmoji("bet")}</span>
                    <Badge
                      size="xs"
                      variant="filled"
                      color={BET_STATUS_COLORS[bet.status] ?? "gray"}
                      styles={{ root: { flexShrink: 0, textTransform: "none", fontWeight: 500 } }}
                    >
                      {bet.status}
                    </Badge>
                    <span className="truncate">{bet.name}</span>
                  </TreeRow>

                  {betExpanded && (
                    <>
                      {/* Notes folder */}
                      {hasNotes && (
                        <>
                          <TreeRow depth={1} onClick={() => toggle(`notes:${bet.slug}`)}>
                            <ChevronIcon expanded={expanded.has(`notes:${bet.slug}`)} />
                            <FolderIcon />
                            <span className="truncate opacity-80">notes</span>
                            <span className="ml-auto text-xs opacity-40">{bet.files.notes.length}</span>
                          </TreeRow>
                          {expanded.has(`notes:${bet.slug}`) &&
                            bet.files.notes.map((f) => {
                              const fileNode: NavNode = {
                                type: "bet-file",
                                slug: bet.slug,
                                filePath: `notes/${f}`,
                                fileName: f,
                              };
                              return (
                                <TreeRow
                                  key={f}
                                  depth={3}
                                  selected={isSelected(fileNode)}
                                  onClick={() => handleSelectNode(fileNode)}
                                >
                                  <FileIcon />
                                  <span className="truncate opacity-80">{f}</span>
                                </TreeRow>
                              );
                            })}
                        </>
                      )}

                      {/* Research folder */}
                      {hasResearch && (
                        <>
                          <TreeRow depth={1} onClick={() => toggle(`research:${bet.slug}`)}>
                            <ChevronIcon expanded={expanded.has(`research:${bet.slug}`)} />
                            <FolderIcon />
                            <span className="truncate opacity-80">research</span>
                            <span className="ml-auto text-xs opacity-40">{bet.files.research.length}</span>
                          </TreeRow>
                          {expanded.has(`research:${bet.slug}`) &&
                            bet.files.research.map((f) => {
                              const fileNode: NavNode = {
                                type: "bet-file",
                                slug: bet.slug,
                                filePath: `research/${f}`,
                                fileName: f,
                              };
                              return (
                                <TreeRow
                                  key={f}
                                  depth={3}
                                  selected={isSelected(fileNode)}
                                  onClick={() => handleSelectNode(fileNode)}
                                >
                                  <FileIcon />
                                  <span className="truncate opacity-80">{f}</span>
                                </TreeRow>
                              );
                            })}
                        </>
                      )}

                      {/* Linked Ideas (from **Ideas:** field in bet.md) */}
                      {betLinkedIdeas(bet.ideaKeys).map((idea) => {
                        const ideaEpics = epicsForIdea(idea.key);
                        const ideaExpanded = expanded.has(`idea:${idea.key}`);
                        const ideaNode: NavNode = {
                          type: "jira-idea",
                          key: idea.key,
                          summary: idea.summary,
                          status: idea.status,
                          statusCategory: idea.statusCategory,
                          url: idea.url,
                        };

                        return (
                          <div key={idea.key}>
                            <TreeRow
                              depth={1}
                              selected={isSelected(ideaNode)}
                              onClick={() => {
                                handleSelectNode(ideaNode);
                                if (ideaEpics.length > 0) toggle(`idea:${idea.key}`);
                              }}
                            >
                              {ideaEpics.length > 0 ? (
                                <ChevronIcon expanded={ideaExpanded} />
                              ) : (
                                <span style={{ width: 14, flexShrink: 0 }} />
                              )}
                              <span style={{ fontSize: 14, flexShrink: 0 }}>{issueTypeEmoji("idea")}</span>
                              <span className="truncate">{idea.summary}</span>
                            </TreeRow>

                            {ideaExpanded &&
                              ideaEpics.map((epic) => {
                                const epicNode: NavNode = {
                                  type: "jira-epic",
                                  key: epic.key,
                                  summary: epic.summary,
                                  status: epic.status,
                                  statusCategory: epic.statusCategory,
                                  url: epic.url,
                                  issueType: "Epic",
                                };
                                const epicExp = expanded.has(`epic:${epic.key}`);

                                return (
                                  <div key={epic.key}>
                                    <TreeRow
                                      depth={2}
                                      selected={isSelected(epicNode)}
                                      onClick={() => {
                                        handleSelectNode(epicNode);
                                        if (epic.children.length > 0) toggle(`epic:${epic.key}`);
                                      }}
                                    >
                                      {epic.children.length > 0 ? (
                                        <ChevronIcon expanded={epicExp} />
                                      ) : (
                                        <span style={{ width: 14, flexShrink: 0 }} />
                                      )}
                                      <span style={{ fontSize: 14, flexShrink: 0 }}>{issueTypeEmoji("epic")}</span>
                                      <span className="truncate">{epic.summary}</span>
                                    </TreeRow>

                                    {epicExp &&
                                      epic.children.map((story) => {
                                        const storyNode: NavNode = {
                                          type: "jira-story",
                                          key: story.key,
                                          summary: story.summary,
                                          status: story.status,
                                          statusCategory: story.statusCategory,
                                          url: story.url,
                                          issueType: story.issueType,
                                        };
                                        return (
                                          <TreeRow
                                            key={story.key}
                                            depth={3}
                                            selected={isSelected(storyNode)}
                                            onClick={() => handleSelectNode(storyNode)}
                                          >
                                            <span style={{ width: 14, flexShrink: 0 }} />
                                            <span style={{ fontSize: 14, flexShrink: 0 }}>{issueTypeEmoji(story.issueType)}</span>
                                            <span className="truncate">{story.summary}</span>
                                          </TreeRow>
                                        );
                                      })}
                                  </div>
                                );
                              })}
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              );
            })}

          {/* === Ideas in Delivery Section === */}
          {filteredDeliveryIdeas.length > 0 && (
            <>
              <SectionHeader
                expanded={expanded.has("section:delivery-ideas")}
                onToggle={() => toggle("section:delivery-ideas")}
              >
                In Delivery
              </SectionHeader>

              {expanded.has("section:delivery-ideas") &&
                filteredDeliveryIdeas.map((idea) => {
                  const ideaEpics = epicsForIdea(idea.key);
                  const ideaExpanded = expanded.has(`idea:${idea.key}`);
                  const ideaNode: NavNode = {
                    type: "jira-idea",
                    key: idea.key,
                    summary: idea.summary,
                    status: idea.status,
                    statusCategory: idea.statusCategory,
                    url: idea.url,
                  };

                  return (
                    <div key={idea.key}>
                      <TreeRow
                        depth={0}
                        selected={isSelected(ideaNode)}
                        onClick={() => {
                          handleSelectNode(ideaNode);
                          if (ideaEpics.length > 0) toggle(`idea:${idea.key}`);
                        }}
                      >
                        {ideaEpics.length > 0 ? (
                          <ChevronIcon expanded={ideaExpanded} />
                        ) : (
                          <span style={{ width: 14, flexShrink: 0 }} />
                        )}
                        <span style={{ fontSize: 14, flexShrink: 0 }}>{issueTypeEmoji("idea")}</span>
                        <span className="truncate">{idea.summary}</span>
                      </TreeRow>

                      {ideaExpanded &&
                        ideaEpics.map((epic) => {
                          const epicNode: NavNode = {
                            type: "jira-epic",
                            key: epic.key,
                            summary: epic.summary,
                            status: epic.status,
                            statusCategory: epic.statusCategory,
                            url: epic.url,
                            issueType: "Epic",
                          };
                          const epicExpanded = expanded.has(`epic:${epic.key}`);

                          return (
                            <div key={epic.key}>
                              <TreeRow
                                depth={1}
                                selected={isSelected(epicNode)}
                                onClick={() => {
                                  handleSelectNode(epicNode);
                                  if (epic.children.length > 0) toggle(`epic:${epic.key}`);
                                }}
                              >
                                {epic.children.length > 0 ? (
                                  <ChevronIcon expanded={epicExpanded} />
                                ) : (
                                  <span style={{ width: 14, flexShrink: 0 }} />
                                )}
                                <span style={{ fontSize: 14, flexShrink: 0 }}>{issueTypeEmoji("epic")}</span>
                                <span className="truncate">{epic.summary}</span>
                              </TreeRow>

                              {epicExpanded &&
                                epic.children.map((story) => {
                                  const storyNode: NavNode = {
                                    type: "jira-story",
                                    key: story.key,
                                    summary: story.summary,
                                    status: story.status,
                                    statusCategory: story.statusCategory,
                                    url: story.url,
                                    issueType: story.issueType,
                                  };
                                  return (
                                    <TreeRow
                                      key={story.key}
                                      depth={2}
                                      selected={isSelected(storyNode)}
                                      onClick={() => handleSelectNode(storyNode)}
                                    >
                                      <span style={{ width: 14, flexShrink: 0 }} />
                                      <span style={{ fontSize: 14, flexShrink: 0 }}>{issueTypeEmoji(story.issueType)}</span>
                                      <span className="truncate">{story.summary}</span>
                                    </TreeRow>
                                  );
                                })}
                            </div>
                          );
                        })}
                    </div>
                  );
                })}
            </>
          )}

          {/* === Ideas Backlog Section === */}
          {filteredStandaloneIdeas.length > 0 && (
            <>
              <SectionHeader
                expanded={expanded.has("section:ideas")}
                onToggle={() => toggle("section:ideas")}
              >
                Ideas Backlog
              </SectionHeader>

              {expanded.has("section:ideas") &&
                filteredStandaloneIdeas.map((idea) => {
                  const ideaNode: NavNode = {
                    type: "jira-idea",
                    key: idea.key,
                    summary: idea.summary,
                    status: idea.status,
                    statusCategory: idea.statusCategory,
                    url: idea.url,
                  };
                  return (
                    <TreeRow
                      key={idea.key}
                      depth={0}
                      selected={isSelected(ideaNode)}
                      onClick={() => handleSelectNode(ideaNode)}
                    >
                      <span style={{ width: 14, flexShrink: 0 }} />
                      <span style={{ fontSize: 14, flexShrink: 0 }}>{issueTypeEmoji("idea")}</span>
                      <span className="truncate">{idea.summary}</span>
                    </TreeRow>
                  );
                })}
            </>
          )}

          {/* === Epics without Ideas Section === */}
          {filteredOrphanEpics.length > 0 && (
            <>
              <SectionHeader
                expanded={expanded.has("section:orphan-epics")}
                onToggle={() => toggle("section:orphan-epics")}
              >
                Epics without Ideas
              </SectionHeader>

              {expanded.has("section:orphan-epics") &&
                filteredOrphanEpics.map((epic) => {
                  const epicNode: NavNode = {
                    type: "jira-epic",
                    key: epic.key,
                    summary: epic.summary,
                    status: epic.status,
                    statusCategory: epic.statusCategory,
                    url: epic.url,
                    issueType: "Epic",
                  };
                  const epicExp = expanded.has(`epic:${epic.key}`);

                  return (
                    <div key={epic.key}>
                      <TreeRow
                        depth={0}
                        selected={isSelected(epicNode)}
                        onClick={() => {
                          handleSelectNode(epicNode);
                          if (epic.children.length > 0) toggle(`epic:${epic.key}`);
                        }}
                      >
                        {epic.children.length > 0 ? (
                          <ChevronIcon expanded={epicExp} />
                        ) : (
                          <span style={{ width: 14, flexShrink: 0 }} />
                        )}
                        <span style={{ fontSize: 14, flexShrink: 0 }}>{issueTypeEmoji("epic")}</span>
                        <span className="truncate">{epic.summary}</span>
                      </TreeRow>

                      {epicExp &&
                        epic.children.map((story) => {
                          const storyNode: NavNode = {
                            type: "jira-story",
                            key: story.key,
                            summary: story.summary,
                            status: story.status,
                            statusCategory: story.statusCategory,
                            url: story.url,
                            issueType: story.issueType,
                          };
                          return (
                            <TreeRow
                              key={story.key}
                              depth={1}
                              selected={isSelected(storyNode)}
                              onClick={() => handleSelectNode(storyNode)}
                            >
                              <span style={{ width: 14, flexShrink: 0 }} />
                              <span style={{ fontSize: 14, flexShrink: 0 }}>{issueTypeEmoji(story.issueType)}</span>
                              <span className="truncate">{story.summary}</span>
                            </TreeRow>
                          );
                        })}
                    </div>
                  );
                })}
            </>
          )}

          {/* === Client & Partner Work Section === */}
          {(filteredClients.length > 0 || filteredPartners.length > 0) && (
            <>
              <SectionHeader
                expanded={expanded.has("section:clients-partners")}
                onToggle={() => toggle("section:clients-partners")}
              >
                Client & Partner Work
              </SectionHeader>

              {expanded.has("section:clients-partners") && (
                <>
                  {/* Clients sub-section */}
                  {filteredClients.length > 0 && (
                    <>
                      <SectionHeader
                        expanded={expanded.has("section:clients")}
                        onToggle={() => toggle("section:clients")}
                      >
                        <span style={{ paddingLeft: 8 }}>Clients</span>
                      </SectionHeader>

                      {expanded.has("section:clients") &&
                        filteredClients.map((client) => {
                          const clientExpanded = expanded.has(`client:${client.slug}`);
                          const clientNode: NavNode = { type: "client", slug: client.slug, name: client.name, relationship: client.relationship };
                          const hasNotes = client.files.notes.length > 0;

                          return (
                            <div key={client.slug}>
                              <TreeRow
                                depth={1}
                                selected={isSelected(clientNode)}
                                onClick={() => {
                                  handleSelectNode(clientNode);
                                  toggle(`client:${client.slug}`);
                                }}
                              >
                                <ChevronIcon expanded={clientExpanded} />
                                <span style={{ fontSize: 14, flexShrink: 0 }}>🏢</span>
                                <Badge
                                  size="xs"
                                  variant="filled"
                                  color={RELATIONSHIP_COLORS[client.relationship] ?? "gray"}
                                  styles={{ root: { flexShrink: 0, textTransform: "none", fontWeight: 500 } }}
                                >
                                  {client.relationship}
                                </Badge>
                                <span className="truncate">{client.name}</span>
                              </TreeRow>

                              {clientExpanded && hasNotes && (
                                <>
                                  <TreeRow depth={2} onClick={() => toggle(`client-notes:${client.slug}`)}>
                                    <ChevronIcon expanded={expanded.has(`client-notes:${client.slug}`)} />
                                    <FolderIcon />
                                    <span className="truncate opacity-80">notes</span>
                                    <span className="ml-auto text-xs opacity-40">{client.files.notes.length}</span>
                                  </TreeRow>
                                  {expanded.has(`client-notes:${client.slug}`) &&
                                    client.files.notes.map((f) => {
                                      const fileNode: NavNode = {
                                        type: "client-file",
                                        slug: client.slug,
                                        filePath: `notes/${f}`,
                                        fileName: f,
                                      };
                                      return (
                                        <TreeRow
                                          key={f}
                                          depth={3}
                                          selected={isSelected(fileNode)}
                                          onClick={() => handleSelectNode(fileNode)}
                                        >
                                          <FileIcon />
                                          <span className="truncate opacity-80">{f}</span>
                                        </TreeRow>
                                      );
                                    })}
                                </>
                              )}
                            </div>
                          );
                        })}
                    </>
                  )}

                  {/* Partners sub-section */}
                  {filteredPartners.length > 0 && (
                    <>
                      <SectionHeader
                        expanded={expanded.has("section:partners")}
                        onToggle={() => toggle("section:partners")}
                      >
                        <span style={{ paddingLeft: 8 }}>Partners</span>
                      </SectionHeader>

                      {expanded.has("section:partners") &&
                        filteredPartners.map((partner) => {
                          const partnerExpanded = expanded.has(`partner:${partner.slug}`);
                          const partnerNode: NavNode = { type: "partner", slug: partner.slug, name: partner.name, relationship: partner.relationship };
                          const hasNotes = partner.files.notes.length > 0;

                          return (
                            <div key={partner.slug}>
                              <TreeRow
                                depth={1}
                                selected={isSelected(partnerNode)}
                                onClick={() => {
                                  handleSelectNode(partnerNode);
                                  toggle(`partner:${partner.slug}`);
                                }}
                              >
                                <ChevronIcon expanded={partnerExpanded} />
                                <span style={{ fontSize: 14, flexShrink: 0 }}>🤝</span>
                                <Badge
                                  size="xs"
                                  variant="filled"
                                  color={RELATIONSHIP_COLORS[partner.relationship] ?? "gray"}
                                  styles={{ root: { flexShrink: 0, textTransform: "none", fontWeight: 500 } }}
                                >
                                  {partner.relationship}
                                </Badge>
                                <span className="truncate">{partner.name}</span>
                              </TreeRow>

                              {partnerExpanded && hasNotes && (
                                <>
                                  <TreeRow depth={2} onClick={() => toggle(`partner-notes:${partner.slug}`)}>
                                    <ChevronIcon expanded={expanded.has(`partner-notes:${partner.slug}`)} />
                                    <FolderIcon />
                                    <span className="truncate opacity-80">notes</span>
                                    <span className="ml-auto text-xs opacity-40">{partner.files.notes.length}</span>
                                  </TreeRow>
                                  {expanded.has(`partner-notes:${partner.slug}`) &&
                                    partner.files.notes.map((f) => {
                                      const fileNode: NavNode = {
                                        type: "partner-file",
                                        slug: partner.slug,
                                        filePath: `notes/${f}`,
                                        fileName: f,
                                      };
                                      return (
                                        <TreeRow
                                          key={f}
                                          depth={3}
                                          selected={isSelected(fileNode)}
                                          onClick={() => handleSelectNode(fileNode)}
                                        >
                                          <FileIcon />
                                          <span className="truncate opacity-80">{f}</span>
                                        </TreeRow>
                                      );
                                    })}
                                </>
                              )}
                            </div>
                          );
                        })}
                    </>
                  )}
                </>
              )}
            </>
          )}

          {/* === Meeting Notes Section === */}
          {filteredMeetings.length > 0 && (
            <>
              <SectionHeader
                expanded={expanded.has("section:meetings")}
                onToggle={() => toggle("section:meetings")}
              >
                Meeting Notes
              </SectionHeader>

              {expanded.has("section:meetings") && (() => {
                // Group meetings by date
                const byDate = new Map<string, MeetingNote[]>();
                for (const m of filteredMeetings) {
                  const date = m.date || "Unknown";
                  if (!byDate.has(date)) byDate.set(date, []);
                  byDate.get(date)!.push(m);
                }
                const sortedDates = [...byDate.keys()].sort().reverse();

                return sortedDates.map((date) => (
                  <div key={date}>
                    <TreeRow depth={0} onClick={() => toggle(`meeting-date:${date}`)}>
                      <ChevronIcon expanded={expanded.has(`meeting-date:${date}`)} />
                      <FolderIcon />
                      <span className="truncate opacity-80">{date}</span>
                      <span className="ml-auto text-xs opacity-40">{byDate.get(date)!.length}</span>
                    </TreeRow>

                    {expanded.has(`meeting-date:${date}`) &&
                      byDate.get(date)!.map((meeting) => {
                        const meetingNode: NavNode = {
                          type: "meeting-note",
                          filename: meeting.filename,
                          name: meeting.name,
                          date: meeting.date,
                        };
                        return (
                          <TreeRow
                            key={meeting.filename}
                            depth={1}
                            selected={isSelected(meetingNode)}
                            onClick={() => handleSelectNode(meetingNode)}
                          >
                            <FileIcon />
                            <span className="truncate">{meeting.name}</span>
                          </TreeRow>
                        );
                      })}
                  </div>
                ));
              })()}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
