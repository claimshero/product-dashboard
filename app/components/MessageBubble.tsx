import { Collapse, Loader, Paper } from "@mantine/core";
import { useState } from "react";
import Markdown from "react-markdown";
import type { Message, MessageBlock, ResultStats } from "~/types/chat";

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
}

/** Friendly display names for common tool names */
function formatToolName(name: string): string {
  const map: Record<string, string> = {
    Read: "Reading file",
    Edit: "Editing file",
    Write: "Writing file",
    Bash: "Running command",
    Grep: "Searching code",
    Glob: "Finding files",
    WebSearch: "Web search",
    WebFetch: "Fetching URL",
    Agent: "Running agent",
  };
  return map[name] ?? name;
}

function ThinkingBlock({ block }: { block: Extract<MessageBlock, { type: "thinking" }> }) {
  const [expanded, setExpanded] = useState(false);
  const isActive = !block.done;

  return (
    <div className="mb-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 rounded px-2 py-1 text-xs font-medium border-none cursor-pointer transition-colors"
        style={{
          backgroundColor: "var(--mantine-color-dark-5)",
          color: "var(--mantine-color-dark-1)",
        }}
      >
        {isActive ? (
          <Loader size={10} color="violet" type="dots" />
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>
            <polyline points="9 18 15 12 9 6" />
          </svg>
        )}
        <span>{isActive ? "Thinking..." : "Thought process"}</span>
        {block.content.length > 0 && (
          <span style={{ color: "var(--mantine-color-dark-3)", marginLeft: "auto" }}>
            {Math.ceil(block.content.length / 4)} chars
          </span>
        )}
      </button>
      <Collapse in={expanded || isActive}>
        <div
          className="mt-1 max-h-48 overflow-y-auto rounded px-3 py-2 text-xs"
          style={{
            backgroundColor: "var(--mantine-color-dark-8)",
            color: "var(--mantine-color-dark-2)",
            fontFamily: "monospace",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {block.content || "..."}
        </div>
      </Collapse>
    </div>
  );
}

function ToolUseBlock({ block }: { block: Extract<MessageBlock, { type: "tool_use" }> }) {
  const isRunning = block.status === "running";

  return (
    <div
      className="mb-1 flex items-center gap-2 rounded px-2 py-1 text-xs"
      style={{
        backgroundColor: "var(--mantine-color-dark-8)",
        color: "var(--mantine-color-dark-2)",
      }}
    >
      {isRunning ? (
        <Loader size={10} color="blue" type="oval" />
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--mantine-color-green-6)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
      <span style={{ color: "var(--mantine-color-dark-1)" }}>
        {formatToolName(block.name)}
      </span>
      {block.elapsed != null && block.elapsed > 0 && (
        <span style={{ color: "var(--mantine-color-dark-3)", marginLeft: "auto" }}>
          {block.elapsed.toFixed(1)}s
        </span>
      )}
    </div>
  );
}

function ResultFooter({ result }: { result: ResultStats }) {
  const cost = result.costUsd > 0 ? `$${result.costUsd.toFixed(3)}` : null;
  const tokens = result.inputTokens + result.outputTokens;
  const tokenStr = tokens > 0 ? `${(tokens / 1000).toFixed(1)}k tokens` : null;
  const duration = result.durationMs > 0 ? `${(result.durationMs / 1000).toFixed(1)}s` : null;
  const parts = [cost, tokenStr, duration].filter(Boolean);
  if (parts.length === 0) return null;

  return (
    <div
      className="mt-2 border-t pt-1.5 text-[10px]"
      style={{
        borderColor: "var(--mantine-color-dark-5)",
        color: "var(--mantine-color-dark-3)",
      }}
    >
      {parts.join(" \u00b7 ")}
    </div>
  );
}

export function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const hasBlocks = message.blocks && message.blocks.length > 0;

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <Paper
        shadow="sm"
        radius="md"
        p="sm"
        className="max-w-[80%]"
        bg={isUser ? "blue.8" : "dark.6"}
      >
        {isUser ? (
          <div
            className="text-sm text-white"
            style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
          >
            {message.content}
          </div>
        ) : hasBlocks ? (
          <div>
            {message.blocks!.map((block, i) => {
              if (block.type === "thinking") {
                return <ThinkingBlock key={`thinking-${i}`} block={block} />;
              }
              if (block.type === "tool_use") {
                return <ToolUseBlock key={`tool-${block.id}`} block={block} />;
              }
              if (block.type === "text") {
                return (
                  <div key={`text-${i}`} className="prose prose-invert prose-sm max-w-none text-[var(--mantine-color-gray-1)]">
                    <Markdown>{block.content}</Markdown>
                  </div>
                );
              }
              return null;
            })}
            {message.result && <ResultFooter result={message.result} />}
          </div>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none text-[var(--mantine-color-gray-1)]">
            <Markdown>{message.content}</Markdown>
          </div>
        )}
      </Paper>
    </div>
  );
}
