"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";
import { REPORT_REASONS } from "@/lib/constants";
import { rupeesToPaise } from "@/lib/format";
import type { ActionState } from "@/lib/types";
import { dbErrorCode, DEFAULT_ERROR, errorText } from "@/lib/errors";
import { logError } from "@/lib/log";

const uuid = z.string().uuid();

/** Maps a database error to user-facing text; unknown errors are logged with the request ID. */
export async function friendlyDbError(message: string | undefined) {
  const code = dbErrorCode(message);
  if (code) return errorText(code);
  if (message && /row-level security/i.test(message)) return errorText("forbidden");
  await logError("db", message ?? "unknown");
  return DEFAULT_ERROR;
}

export async function toggleSave(listingId: string, save: boolean): Promise<{ saved: boolean; error?: string }> {
  const viewer = await getViewer();
  if (!viewer) return { saved: !save, error: "Please log in to save items." };
  if (!uuid.safeParse(listingId).success) return { saved: !save, error: "Invalid item." };
  const supabase = await createClient();
  const { error } = save
    ? await supabase.from("saved_listings").upsert({ user_id: viewer.id, listing_id: listingId }, { ignoreDuplicates: true })
    : await supabase.from("saved_listings").delete().eq("user_id", viewer.id).eq("listing_id", listingId);
  if (error) return { saved: !save, error: await friendlyDbError(error.message) };
  revalidatePath("/saved");
  return { saved: save };
}

export async function startConversation(form: FormData) {
  const listingId = String(form.get("listingId") ?? "");
  if (!uuid.safeParse(listingId).success) redirect("/marketplace");
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=/product/${listingId}`);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_conversation", { p_listing: listingId });
  // Only a known code goes in the URL; the page maps it to text.
  if (error) redirect(`/product/${listingId}?error=${dbErrorCode(error.message) ?? "unknown"}`);
  redirect(`/messages/${data}`);
}

export async function makeOffer(_: ActionState, form: FormData): Promise<ActionState> {
  const listingId = String(form.get("listingId") ?? "");
  if (!uuid.safeParse(listingId).success) return { error: "Invalid item." };
  const amount = rupeesToPaise(String(form.get("amount") ?? ""));
  if (!amount || amount <= 0) return { error: "Enter a valid amount in rupees." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("make_offer", { p_listing: listingId, p_amount_paise: amount });
  if (error) return { error: await friendlyDbError(error.message) };
  const { data: conv } = await supabase.rpc("start_conversation", { p_listing: listingId });
  redirect(`/messages/${conv}`);
}

const reportSchema = z.object({
  listingId: uuid.optional(),
  reportedUserId: uuid.optional(),
  conversationId: uuid.optional(),
  reason: z.enum(REPORT_REASONS.map((r) => r.id) as [string, ...string[]]),
  details: z.string().trim().max(2000).optional(),
});

export async function submitReport(_: ActionState, form: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  if (!viewer) return { error: "Please log in to report." };
  const opt = (k: string) => (form.get(k) ? String(form.get(k)) : undefined);
  const parsed = reportSchema.safeParse({
    listingId: opt("listingId"),
    reportedUserId: opt("reportedUserId"),
    conversationId: opt("conversationId"),
    reason: form.get("reason"),
    details: opt("details"),
  });
  if (!parsed.success) return { error: "Choose a reason for the report." };
  const supabase = await createClient();
  const { error } = await supabase.from("reports").insert({
    listing_id: parsed.data.listingId ?? null,
    reported_user_id: parsed.data.reportedUserId ?? null,
    conversation_id: parsed.data.conversationId ?? null,
    reason: parsed.data.reason,
    details: parsed.data.details ?? null,
  });
  if (error) return { error: await friendlyDbError(error.message) };
  return { ok: true, message: "Thanks. A moderator will review this report." };
}
