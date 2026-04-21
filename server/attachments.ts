import crypto from "crypto";
import fs from "fs";
import path from "path";
import { ATTACHMENTS_DIR } from "./config.js";

export interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  kind: "image" | "document" | "text";
  /** Absolute path on disk */
  path: string;
  /** URL the frontend uses to render/fetch the file */
  url: string;
}

const IMAGE_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

const TEXT_EXTENSIONS = new Set([
  ".md",
  ".txt",
  ".csv",
  ".json",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".py",
  ".go",
  ".rs",
  ".java",
  ".c",
  ".cpp",
  ".h",
  ".hpp",
  ".rb",
  ".sh",
  ".yml",
  ".yaml",
  ".toml",
  ".html",
  ".css",
  ".log",
  ".xml",
]);

function classify(mimeType: string, filename: string): Attachment["kind"] {
  if (IMAGE_MIMES.has(mimeType) || mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/pdf") return "document";
  if (mimeType.startsWith("text/")) return "text";
  const ext = path.extname(filename).toLowerCase();
  if (TEXT_EXTENSIONS.has(ext)) return "text";
  return "document";
}

export function ensureAttachmentsDir(): void {
  if (!fs.existsSync(ATTACHMENTS_DIR)) {
    fs.mkdirSync(ATTACHMENTS_DIR, { recursive: true });
  }
}

/**
 * Persist uploaded files for a conversation. Returns attachment metadata.
 * Expects files already buffered in memory (multer memoryStorage).
 */
export function saveAttachments(
  conversationId: string,
  files: Express.Multer.File[]
): Attachment[] {
  if (files.length === 0) return [];
  const dir = path.join(ATTACHMENTS_DIR, conversationId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return files.map((file) => {
    const id = crypto.randomUUID();
    const safeName = file.originalname.replace(/[^\w.\-]+/g, "_");
    const storedName = `${id}-${safeName}`;
    const absPath = path.join(dir, storedName);
    fs.writeFileSync(absPath, file.buffer);

    return {
      id,
      filename: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      kind: classify(file.mimetype, file.originalname),
      path: absPath,
      url: `/attachments/${conversationId}/${encodeURIComponent(storedName)}`,
    };
  });
}

/**
 * Build a text prompt that inlines text-file contents and references binary
 * attachments by their on-disk path. Claude's Read tool handles images and PDFs
 * natively when given a file path, which is more reliable than feeding base64
 * content blocks through the Claude Code CLI's stream-json input.
 */
export function buildPromptWithAttachments(
  prompt: string,
  attachments: Attachment[]
): string {
  if (attachments.length === 0) return prompt;

  const inlineTexts: string[] = [];
  const fileRefs: string[] = [];

  for (const att of attachments) {
    if (att.kind === "text") {
      try {
        const raw = fs.readFileSync(att.path, "utf-8");
        inlineTexts.push(
          `--- Attached file: ${att.filename} ---\n${raw}\n--- end of ${att.filename} ---`
        );
        continue;
      } catch {
        // fall through to file reference
      }
    }
    fileRefs.push(`- ${att.filename} (${att.mimeType}) at: ${att.path}`);
  }

  const parts: string[] = [];
  if (prompt.trim()) parts.push(prompt);

  if (fileRefs.length > 0) {
    parts.push(
      `The user has attached the following file(s). Use the Read tool to view them:\n${fileRefs.join("\n")}`
    );
  }

  if (inlineTexts.length > 0) {
    parts.push(inlineTexts.join("\n\n"));
  }

  return parts.join("\n\n");
}
