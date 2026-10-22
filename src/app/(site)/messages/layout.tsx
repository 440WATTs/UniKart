import { ConversationPane } from "@/components/messages/ConversationPane";
import { listConversations } from "@/lib/messaging";
import { requireViewer } from "@/lib/session";

export const metadata = { title: "Messages" };

export default async function MessagesLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer("/messages");
  const conversations = await listConversations(viewer.id);
  return (
    <div className="container-page py-4 sm:py-6">
      <ConversationPane conversations={conversations}>{children}</ConversationPane>
    </div>
  );
}
