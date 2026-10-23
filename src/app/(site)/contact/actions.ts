"use server";
import { contactSchema, fieldErrors } from "@/lib/validation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getViewer } from "@/lib/session";
import { logError } from "@/lib/log";
import { allowAll, clientIp, RATE_LIMITED } from "@/lib/rate-limit";
import type { ActionState } from "@/lib/types";

/**
 * Visitors can't write to contact_messages directly (audit H3); the server
 * inserts with the service role after per-IP rate limiting.
 */
export async function sendContactMessage(_: ActionState, form: FormData): Promise<ActionState> {
  const sent: ActionState = { ok: true, message: "Thanks, your message has been sent. We'll reply by email." };
  if (form.get("website")) return sent; // honeypot
  const parsed = contactSchema.safeParse({ name: form.get("name"), email: form.get("email"), subject: form.get("subject"), body: form.get("body") });
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  }
  if (!(await allowAll([[`contact:ip:${await clientIp()}`, 5, 3600], ["contact:global", 300, 3600]]))) return { error: RATE_LIMITED };
  const viewer = await getViewer();
  const { error } = await createAdminClient()
    .from("contact_messages")
    .insert({ ...parsed.data, user_id: viewer?.id ?? null });
  if (error) {
    await logError("contact", error.message);
    return { error: "Could not send your message. Please email us instead." };
  }
  return sent;
}
