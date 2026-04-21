import { ActionIcon, Text, Textarea, Tooltip } from "@mantine/core";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
} from "react";

export interface PendingAttachment {
  id: string;
  file: File;
  previewUrl?: string;
}

interface ChatInputProps {
  onSubmit: (prompt: string, attachments: PendingAttachment[]) => void;
  onStop?: () => void;
  disabled?: boolean;
  isStreaming?: boolean;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB per file
const MAX_TOTAL_SIZE = 25 * 1024 * 1024; // 25 MB total
const MAX_FILES = 10;

const ACCEPTED_TYPES =
  "image/*,application/pdf,.md,.txt,.csv,.json,.ts,.tsx,.js,.jsx,.py,.go,.rs,.java,.yml,.yaml,.toml,.html,.css,.log,.xml";

function isImage(file: File): boolean {
  return file.type.startsWith("image/");
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ChatInput({ onSubmit, onStop, disabled, isStreaming }: ChatInputProps) {
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  // Release preview URLs when the list changes or component unmounts
  useEffect(() => {
    return () => {
      for (const a of attachments) {
        if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFiles = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      setError(null);

      setAttachments((prev) => {
        const next = [...prev];
        let totalSize = prev.reduce((acc, a) => acc + a.file.size, 0);

        for (const file of files) {
          if (next.length >= MAX_FILES) {
            setError(`Max ${MAX_FILES} files per message`);
            break;
          }
          if (file.size > MAX_FILE_SIZE) {
            setError(`${file.name} is larger than ${formatSize(MAX_FILE_SIZE)}`);
            continue;
          }
          if (totalSize + file.size > MAX_TOTAL_SIZE) {
            setError(`Total attachments exceed ${formatSize(MAX_TOTAL_SIZE)}`);
            break;
          }
          totalSize += file.size;
          next.push({
            id: makeId(),
            file,
            previewUrl: isImage(file) ? URL.createObjectURL(file) : undefined,
          });
        }
        return next;
      });
    },
    []
  );

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments((prev) => {
      for (const a of prev) {
        if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
      }
      return [];
    });
  }, []);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (disabled) return;
    if (!trimmed && attachments.length === 0) return;
    onSubmit(trimmed, attachments);
    setValue("");
    // Don't revoke preview URLs yet — the parent may still render them in the
    // optimistic message. The parent takes ownership of the File references.
    setAttachments([]);
    setError(null);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      addFiles(files);
    }
  };

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files ? Array.from(e.target.files) : [];
    addFiles(picked);
    // Allow picking the same file again later
    e.target.value = "";
  };

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCounter.current += 1;
    if (e.dataTransfer?.types?.includes("Files")) {
      setIsDragActive(true);
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragActive(false);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragActive(false);
    const files = e.dataTransfer?.files ? Array.from(e.dataTransfer.files) : [];
    if (files.length > 0) addFiles(files);
  };

  const canSend = !disabled && (value.trim().length > 0 || attachments.length > 0);

  return (
    <div
      className="flex flex-col gap-2"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{
        outline: isDragActive
          ? "2px dashed var(--mantine-color-blue-5)"
          : "none",
        outlineOffset: 4,
        borderRadius: 6,
      }}
    >
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((a) => (
            <AttachmentChip
              key={a.id}
              attachment={a}
              onRemove={() => removeAttachment(a.id)}
            />
          ))}
          {attachments.length > 1 && (
            <button
              onClick={clearAttachments}
              className="text-xs underline border-none bg-transparent cursor-pointer"
              style={{ color: "var(--mantine-color-dimmed)" }}
            >
              clear all
            </button>
          )}
        </div>
      )}
      {error && (
        <Text size="xs" c="red.5">
          {error}
        </Text>
      )}
      <div className="flex items-end gap-2">
        <Tooltip label="Attach file">
          <ActionIcon
            size="lg"
            variant="subtle"
            color="gray"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            aria-label="Attach file"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </ActionIcon>
        </Tooltip>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_TYPES}
          style={{ display: "none" }}
          onChange={handleFilePick}
        />
        <Textarea
          className="flex-1"
          placeholder="Ask Claude a question..."
          value={value}
          onChange={(e) => setValue(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          disabled={disabled}
          autosize
          minRows={1}
          maxRows={6}
        />
        {isStreaming ? (
          <ActionIcon
            size="lg"
            variant="filled"
            color="red"
            onClick={onStop}
            aria-label="Stop generation"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </ActionIcon>
        ) : (
          <ActionIcon
            size="lg"
            variant="filled"
            color="blue"
            onClick={handleSubmit}
            disabled={!canSend}
            aria-label="Send message"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </ActionIcon>
        )}
      </div>
    </div>
  );
}

function AttachmentChip({
  attachment,
  onRemove,
}: {
  attachment: PendingAttachment;
  onRemove: () => void;
}) {
  const { file, previewUrl } = attachment;
  return (
    <div
      className="flex items-center gap-2 rounded border px-2 py-1 text-xs"
      style={{
        backgroundColor: "var(--mantine-color-dark-6)",
        borderColor: "var(--mantine-color-dark-4)",
        color: "var(--mantine-color-dark-0)",
        maxWidth: 260,
      }}
    >
      {previewUrl ? (
        <img
          src={previewUrl}
          alt={file.name}
          style={{
            width: 28,
            height: 28,
            objectFit: "cover",
            borderRadius: 3,
          }}
        />
      ) : (
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
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      )}
      <div className="flex flex-col overflow-hidden">
        <span className="truncate" style={{ maxWidth: 180 }}>
          {file.name}
        </span>
        <span style={{ color: "var(--mantine-color-dimmed)", fontSize: 10 }}>
          {formatSize(file.size)}
        </span>
      </div>
      <button
        onClick={onRemove}
        className="ml-1 border-none bg-transparent cursor-pointer"
        style={{ color: "var(--mantine-color-dimmed)", fontSize: 14 }}
        aria-label={`Remove ${file.name}`}
      >
        ×
      </button>
    </div>
  );
}
