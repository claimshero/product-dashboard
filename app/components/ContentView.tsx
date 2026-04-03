import { ScrollArea, Loader, Text, ActionIcon, Tooltip } from "@mantine/core";
import Markdown from "react-markdown";
import type { NavNode } from "~/types/navigation";
import type { SelectedItem } from "~/hooks/useDelivery";
import { useBetContent } from "~/hooks/useBets";
import { useMeetingContent } from "~/hooks/useMeetings";
import { useClientPartnerContent } from "~/hooks/useClientsPartners";
import { ItemDetails } from "./ItemDetails";

const API_BASE = "http://localhost:4001";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"]);
const PDF_EXTENSIONS = new Set([".pdf"]);

function getFileExtension(filePath: string): string {
  const dot = filePath.lastIndexOf(".");
  return dot >= 0 ? filePath.slice(dot).toLowerCase() : "";
}

interface ContentViewProps {
  selectedNode: NavNode | null;
  selectedItem: SelectedItem | null;
  onOpenSettings: () => void;
}

function BetMarkdownView({ slug, filePath }: { slug: string; filePath: string }) {
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

function BetImageView({ slug, filePath }: { slug: string; filePath: string }) {
  const url = `${API_BASE}/api/bets/${slug}/content?path=${encodeURIComponent(filePath)}`;
  return (
    <ScrollArea className="h-full" type="auto" scrollbarSize={6}>
      <div className="flex items-center justify-center p-4">
        <img
          src={url}
          alt={filePath}
          style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
        />
      </div>
    </ScrollArea>
  );
}

function BetPdfView({ slug, filePath }: { slug: string; filePath: string }) {
  const url = `${API_BASE}/api/bets/${slug}/content?path=${encodeURIComponent(filePath)}`;
  return (
    <iframe
      src={url}
      title={filePath}
      className="h-full w-full border-none"
      style={{ backgroundColor: "var(--mantine-color-dark-7)" }}
    />
  );
}

function MeetingNoteView({ filename }: { filename: string }) {
  const { content, loading } = useMeetingContent(filename);

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
        <Text size="sm" c="dimmed">Could not load meeting note</Text>
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

function ClientPartnerMarkdownView({ kind, slug, filePath }: { kind: "clients" | "partners"; slug: string; filePath: string }) {
  const { content, loading } = useClientPartnerContent(kind, slug, filePath);

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

function ClientPartnerFileView({ kind, slug, filePath }: { kind: "clients" | "partners"; slug: string; filePath: string }) {
  const ext = getFileExtension(filePath);
  const apiKind = kind;
  const url = `${API_BASE}/api/${apiKind}/${slug}/content?path=${encodeURIComponent(filePath)}`;

  if (IMAGE_EXTENSIONS.has(ext)) {
    return (
      <ScrollArea className="h-full" type="auto" scrollbarSize={6}>
        <div className="flex items-center justify-center p-4">
          <img src={url} alt={filePath} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
        </div>
      </ScrollArea>
    );
  }
  if (PDF_EXTENSIONS.has(ext)) {
    return <iframe src={url} title={filePath} className="h-full w-full border-none" style={{ backgroundColor: "var(--mantine-color-dark-7)" }} />;
  }
  return <ClientPartnerMarkdownView kind={kind} slug={slug} filePath={filePath} />;
}

function BetFileView({ slug, filePath }: { slug: string; filePath: string }) {
  const ext = getFileExtension(filePath);

  if (IMAGE_EXTENSIONS.has(ext)) {
    return <BetImageView slug={slug} filePath={filePath} />;
  }
  if (PDF_EXTENSIONS.has(ext)) {
    return <BetPdfView slug={slug} filePath={filePath} />;
  }
  return <BetMarkdownView slug={slug} filePath={filePath} />;
}

export function ContentView({ selectedNode, selectedItem, onOpenSettings }: ContentViewProps) {
  const showBetContent = selectedNode?.type === "bet" || selectedNode?.type === "bet-file";
  const showJiraDetails = selectedNode?.type === "jira-idea" || selectedNode?.type === "jira-epic" || selectedNode?.type === "jira-story";
  const showMeeting = selectedNode?.type === "meeting-note";
  const showClientPartner = selectedNode?.type === "client" || selectedNode?.type === "partner" ||
    selectedNode?.type === "client-file" || selectedNode?.type === "partner-file";

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header bar with settings */}
      <div
        className="flex items-center justify-between border-b px-3 py-1.5"
        style={{
          borderColor: "var(--mantine-color-dark-4)",
          backgroundColor: "var(--mantine-color-dark-8)",
        }}
      >
        <Text size="sm" fw={500} c="dimmed">
          {selectedNode ? getNodeLabel(selectedNode) : "Dashboard"}
        </Text>
        <Tooltip label="Settings">
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            onClick={onOpenSettings}
          >
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
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </ActionIcon>
        </Tooltip>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {showBetContent && selectedNode?.type === "bet" && (
          <BetFileView slug={selectedNode.slug} filePath="bet.md" />
        )}
        {showBetContent && selectedNode?.type === "bet-file" && (
          <BetFileView slug={selectedNode.slug} filePath={selectedNode.filePath} />
        )}
        {showJiraDetails && selectedItem && (
          <ItemDetails selectedItem={selectedItem} />
        )}
        {showMeeting && selectedNode?.type === "meeting-note" && (
          <MeetingNoteView filename={selectedNode.filename} />
        )}
        {showClientPartner && selectedNode?.type === "client" && (
          <ClientPartnerFileView kind="clients" slug={selectedNode.slug} filePath="client.md" />
        )}
        {showClientPartner && selectedNode?.type === "partner" && (
          <ClientPartnerFileView kind="partners" slug={selectedNode.slug} filePath="partner.md" />
        )}
        {showClientPartner && selectedNode?.type === "client-file" && (
          <ClientPartnerFileView kind="clients" slug={selectedNode.slug} filePath={selectedNode.filePath} />
        )}
        {showClientPartner && selectedNode?.type === "partner-file" && (
          <ClientPartnerFileView kind="partners" slug={selectedNode.slug} filePath={selectedNode.filePath} />
        )}
        {!showBetContent && !showJiraDetails && !showMeeting && !showClientPartner && (
          <div className="flex h-full items-center justify-center">
            <Text c="dimmed" size="sm">Select an item from the navigation to view details</Text>
          </div>
        )}
      </div>
    </div>
  );
}

function getNodeLabel(node: NavNode): string {
  switch (node.type) {
    case "bet":
      return `🎯 ${node.name}`;
    case "bet-file":
      return `📄 ${node.fileName}`;
    case "jira-idea":
      return `💡 ${node.key} — ${node.summary}`;
    case "jira-epic":
      return `⚡ ${node.key} — ${node.summary}`;
    case "jira-story":
      return `${node.issueType === "Bug" ? "🐛" : "📖"} ${node.key} — ${node.summary}`;
    case "meeting-note":
      return `📝 ${node.name} (${node.date})`;
    case "client":
      return `🏢 ${node.name}`;
    case "partner":
      return `🤝 ${node.name}`;
    case "client-file":
    case "partner-file":
      return `📄 ${node.fileName}`;
    default:
      return "";
  }
}
