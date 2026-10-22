import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ListingImage, ListingStatus } from "@/lib/types";

export interface ConversationSummary {
  id: string;
  last_message_at: string;
  initiator_id: string | null;
  owner_id: string | null;
  listing: { id: string; title: string; status: ListingStatus; kind: string; price_paise: number | null; images: ListingImage[] } | null;
  initiator: { id: string; display_name: string } | null;
  owner: { id: string; display_name: string } | null;
  other: { id: string; display_name: string } | null;
  lastMessage: { body: string; sender_id: string | null; created_at: string } | null;
  unread: boolean;
}

const CONV_SELECT =
  "id, last_message_at, initiator_id, owner_id, " +
  "listing:listings(id, title, status, kind, price_paise, images:listing_images(storage_path, position)), " +
  "initiator:profiles!conversations_initiator_id_fkey(id, display_name), " +
  "owner:profiles!conversations_owner_id_fkey(id, display_name)";

/** Conversations the viewer participates in (RLS guarantees no others are returned). */
export async function listConversations(userId: string, limit = 50): Promise<ConversationSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("conversations").select(CONV_SELECT).order("last_message_at", { ascending: false }).limit(limit);
  const convs = (data as unknown as ConversationSummary[] | null) ?? [];
  if (!convs.length) return [];
  // Latest message + unread flag per conversation in one query (audit L1).
  const { data: previews } = await supabase.rpc("conversation_previews", { p_ids: convs.map((c) => c.id) });
  type Preview = { conversation_id: string; body: string | null; sender_id: string | null; created_at: string | null; unread: boolean };
  const byId = new Map(((previews as Preview[] | null) ?? []).map((p) => [p.conversation_id, p]));
  return convs.map((c) => {
    const p = byId.get(c.id);
    return {
      ...c,
      other: c.initiator_id === userId ? c.owner : c.initiator,
      lastMessage: p?.body && p.created_at ? { body: p.body, sender_id: p.sender_id, created_at: p.created_at } : null,
      unread: Boolean(p?.unread),
    };
  });
}
