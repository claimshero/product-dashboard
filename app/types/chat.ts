export interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  kind: "image" | "document" | "text";
  /** URL the client can fetch (served by the chat server at /attachments/...) */
  url: string;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
  /** Rich content blocks — present on streaming assistant messages */
  blocks?: MessageBlock[];
  /** Final result stats — cost, tokens, duration */
  result?: ResultStats;
  /** Files the user attached to this message */
  attachments?: Attachment[];
}

export type MessageBlock =
  | { type: "thinking"; content: string; done: boolean }
  | { type: "text"; content: string }
  | { type: "tool_use"; id: string; name: string; elapsed?: number; status: "running" | "done" | "error" };

export interface ResultStats {
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
}

export interface ConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation extends ConversationSummary {
  messages: Message[];
}
