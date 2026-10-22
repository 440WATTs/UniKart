import { notFound } from "next/navigation";
import { ChatThread } from "@/components/messages/ChatThread";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/session";
import type { Message, Offer } from "@/lib/types";

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireViewer(`/messages/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();

  // RLS returns nothing unless the viewer is a participant.
  const { data: conv } = await supabase
    .from("conversations")
    .select(
      "id, initiator_id, owner_id, listing:listings(id, title, status, kind, price_paise, listing_type, seller_id, images:listing_images(storage_path, position)), " +
        "initiator:profiles!conversations_initiator_id_fkey(id, display_name, verified_institute_id), owner:profiles!conversations_owner_id_fkey(id, display_name, verified_institute_id)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!conv) notFound();
  const c = conv as unknown as {
    id: string;
    initiator_id: string | null;
    owner_id: string | null;
    listing: { id: string; title: string; status: string; kind: string; price_paise: number | null; listing_type: string; images: { storage_path: string; position: number }[] } | null;
    initiator: { id: string; display_name: string; verified_institute_id: string | null } | null;
    owner: { id: string; display_name: string; verified_institute_id: string | null } | null;
  };

  const [{ data: messages }, { data: offers }, { data: block }] = await Promise.all([
    supabase.from("messages").select("*").eq("conversation_id", id).order("created_at", { ascending: false }).limit(200),
    supabase.from("offers").select("*").eq("conversation_id", id).order("created_at", { ascending: true }),
    supabase.from("blocks").select("blocked_id").eq("blocker_id", viewer.id),
  ]);
  await supabase.rpc("mark_conversation_read", { p_conv: id });

  const other = c.initiator_id === viewer.id ? c.owner : c.initiator;
  return (
    <ChatThread
      key={id}
      conversationId={id}
      me={viewer.id}
      other={other}
      listing={c.listing}
      isOwner={c.owner_id === viewer.id}
      initialMessages={((messages as Message[] | null) ?? []).reverse()}
      offers={(offers as Offer[] | null) ?? []}
      blockedByMe={Boolean(other && (block ?? []).some((b: { blocked_id: string }) => b.blocked_id === other.id))}
    />
  );
}
