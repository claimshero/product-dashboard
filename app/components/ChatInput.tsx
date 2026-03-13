import { ActionIcon, Textarea } from "@mantine/core";
import { useState, type KeyboardEvent } from "react";

interface ChatInputProps {
  onSubmit: (prompt: string) => void;
  onStop?: () => void;
  disabled?: boolean;
  isStreaming?: boolean;
}

export function ChatInput({ onSubmit, onStop, disabled, isStreaming }: ChatInputProps) {
  const [value, setValue] = useState("");

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setValue("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex items-end gap-2">
      <Textarea
        className="flex-1"
        placeholder="Ask Claude a question..."
        value={value}
        onChange={(e) => setValue(e.currentTarget.value)}
        onKeyDown={handleKeyDown}
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
          disabled={disabled || !value.trim()}
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
  );
}
