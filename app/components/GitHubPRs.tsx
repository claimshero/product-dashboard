import { ActionIcon, Badge, Text, Tooltip, ScrollArea } from "@mantine/core";
import { useGitHubPRs, type PullRequest } from "~/hooks/useGitHubPRs";

function timeAgo(dateStr: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function reviewBadge(decision: string | null) {
  switch (decision) {
    case "APPROVED":
      return (
        <Badge size="xs" variant="light" color="green">
          Approved
        </Badge>
      );
    case "CHANGES_REQUESTED":
      return (
        <Badge size="xs" variant="light" color="red">
          Changes
        </Badge>
      );
    case "REVIEW_REQUIRED":
      return (
        <Badge size="xs" variant="light" color="yellow">
          Review needed
        </Badge>
      );
    default:
      return null;
  }
}

function checksBadge(checks: PullRequest["checks"]) {
  switch (checks) {
    case "success":
      return (
        <Badge size="xs" variant="light" color="green">
          Checks pass
        </Badge>
      );
    case "failure":
      return (
        <Badge size="xs" variant="light" color="red">
          Checks fail
        </Badge>
      );
    case "pending":
      return (
        <Badge size="xs" variant="light" color="yellow">
          Checks running
        </Badge>
      );
    default:
      return null;
  }
}

function repoShortName(fullName: string): string {
  // "claimshero/repo-name" -> "repo-name"
  return fullName.split("/").pop() ?? fullName;
}

function PRRow({ pr }: { pr: PullRequest }) {
  return (
    <a
      href={pr.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block border-b border-[var(--mantine-color-dark-4)] px-4 py-3 transition-colors hover:bg-[var(--mantine-color-dark-5)]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <Text size="sm" fw={500} c="gray.2" lineClamp={1}>
            {pr.title}
          </Text>
          <div className="mt-1 flex items-center gap-2">
            <Text size="xs" c="dimmed">
              {repoShortName(pr.repo)}#{pr.number}
            </Text>
            <Text size="xs" c="dimmed">
              by {pr.author}
            </Text>
            <Text size="xs" c="dimmed">
              {timeAgo(pr.updatedAt)}
            </Text>
          </div>
        </div>
        <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>
          <span style={{ color: "var(--mantine-color-green-6)" }}>
            +{pr.additions}
          </span>{" "}
          <span style={{ color: "var(--mantine-color-red-6)" }}>
            -{pr.deletions}
          </span>
        </Text>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {reviewBadge(pr.reviewDecision)}
        {checksBadge(pr.checks)}
        {pr.labels.map((label) => (
          <Badge key={label} size="xs" variant="outline" color="gray">
            {label}
          </Badge>
        ))}
      </div>
    </a>
  );
}

export function GitHubPRs() {
  const { prs, loading, error, refresh } = useGitHubPRs();

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--mantine-color-dark-4)] px-4 py-3">
        <div className="flex items-center gap-2">
          <Text size="lg" fw={600} c="gray.2">
            Open PRs
          </Text>
          {!loading && (
            <Badge size="xs" variant="light" color="blue">
              {prs.length}
            </Badge>
          )}
        </div>
        <Tooltip label="Refresh">
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            onClick={refresh}
            loading={loading}
          >
            <span style={{ fontSize: 14 }}>&#x21bb;</span>
          </ActionIcon>
        </Tooltip>
      </div>

      {/* PR List */}
      <ScrollArea className="flex-1">
        {loading && prs.length === 0 ? (
          <div className="flex h-32 items-center justify-center">
            <Text c="dimmed" size="sm">
              Loading PRs...
            </Text>
          </div>
        ) : error ? (
          <div className="flex h-32 items-center justify-center">
            <Text c="red" size="sm">
              {error}
            </Text>
          </div>
        ) : prs.length === 0 ? (
          <div className="flex h-32 items-center justify-center">
            <Text c="dimmed" size="sm">
              No open PRs
            </Text>
          </div>
        ) : (
          prs.map((pr) => <PRRow key={`${pr.repo}-${pr.number}`} pr={pr} />)
        )}
      </ScrollArea>
    </div>
  );
}
