import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as crypto from "node:crypto";

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationRecord extends ConversationSummary {
  sessionId?: string;
  messages: Message[];
}

const STORE_DIR = path.join(
  os.homedir(),
  "Library/Application Support/work-dashboard"
);
const STORE_PATH = path.join(STORE_DIR, "conversations.json");

function ensureStoreDir(): void {
  if (!fs.existsSync(STORE_DIR)) {
    fs.mkdirSync(STORE_DIR, { recursive: true });
  }
}

function readStore(): ConversationRecord[] {
  ensureStoreDir();
  if (!fs.existsSync(STORE_PATH)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(STORE_PATH, "utf-8");
    return JSON.parse(raw) as ConversationRecord[];
  } catch {
    return [];
  }
}

function writeStore(conversations: ConversationRecord[]): void {
  ensureStoreDir();
  const tmpPath = STORE_PATH + ".tmp";
  fs.writeFileSync(tmpPath, JSON.stringify(conversations, null, 2), "utf-8");
  fs.renameSync(tmpPath, STORE_PATH);
}

/**
 * List all conversations without message bodies, sorted by updatedAt descending.
 */
export function listConversations(): ConversationSummary[] {
  const conversations = readStore();
  return conversations
    .map(({ id, title, createdAt, updatedAt }) => ({
      id,
      title,
      createdAt,
      updatedAt,
    }))
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
}

/**
 * Get a full conversation including messages.
 */
export function getConversation(
  id: string
): ConversationRecord | undefined {
  const conversations = readStore();
  return conversations.find((c) => c.id === id);
}

/**
 * Create a new conversation with the given title. Returns the new record.
 */
export function createConversation(title: string): ConversationRecord {
  const conversations = readStore();
  const now = new Date().toISOString();
  const record: ConversationRecord = {
    id: crypto.randomUUID(),
    title,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
  conversations.push(record);
  writeStore(conversations);
  return record;
}

/**
 * Update fields on a conversation (sessionId, title, updatedAt).
 */
export function updateConversation(
  id: string,
  updates: Partial<Pick<ConversationRecord, "sessionId" | "title">>
): ConversationRecord | undefined {
  const conversations = readStore();
  const idx = conversations.findIndex((c) => c.id === id);
  if (idx === -1) return undefined;

  if (updates.sessionId !== undefined) {
    conversations[idx].sessionId = updates.sessionId;
  }
  if (updates.title !== undefined) {
    conversations[idx].title = updates.title;
  }
  conversations[idx].updatedAt = new Date().toISOString();
  writeStore(conversations);
  return conversations[idx];
}

/**
 * Delete a conversation by ID. Returns true if found and removed.
 */
export function deleteConversation(id: string): boolean {
  const conversations = readStore();
  const idx = conversations.findIndex((c) => c.id === id);
  if (idx === -1) return false;
  conversations.splice(idx, 1);
  writeStore(conversations);
  return true;
}

/**
 * Append messages to a conversation and update its timestamp.
 */
export function appendMessages(id: string, messages: Message[]): void {
  const conversations = readStore();
  const idx = conversations.findIndex((c) => c.id === id);
  if (idx === -1) return;
  conversations[idx].messages.push(...messages);
  conversations[idx].updatedAt = new Date().toISOString();
  writeStore(conversations);
}
