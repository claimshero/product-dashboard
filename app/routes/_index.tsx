import { ChatInterface } from "~/components/ChatInterface";

export default function Index() {
  return (
    <div className="flex h-screen items-center justify-center bg-[var(--mantine-color-dark-8)]">
      <div className="flex h-full w-full max-w-4xl flex-col">
        <ChatInterface />
      </div>
    </div>
  );
}
