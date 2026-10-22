import { ChatIcon } from "@/components/icons";

export default function MessagesIndex() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-ink-soft">
      <ChatIcon size={40} />
      <p className="font-semibold text-ink">Select a conversation</p>
      <p className="max-w-xs text-sm">Your chats with buyers and sellers appear here. Only the two people in a chat can read it.</p>
    </div>
  );
}
