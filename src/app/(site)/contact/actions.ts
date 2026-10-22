"use server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getViewer } from "@/lib/session";
import { logError } from "@/lib/log";
import { allowAll, clientIp, RATE_LIMITED } from "@/lib/rate-limit";
import type { ActionState } from "@/lib/types";

const schema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(120),
  email: z.string().trim().email("Enter a valid email.").max(200),
  subject: z.string().trim().min(1, "Enter a subject.").max(160),
  body: z.string().trim().min(10, "Write at least 10 characters.").max(4000),
});

/**
 * Visitors can't write to contact_messages directly (audit H3); the server
 * inserts with the service role after per-IP rate limiting.
 */
export async function sendContactMessage(_: ActionState, form: FormData): Promise<ActionState> {
  const sent: ActionState = { ok: true, message: "Thanks, your message has been sent. We'll reply by email." };
  if (form.get("website")) return sent; // honeypot
  const parsed = schema.safeParse({ name: form.get("name"), email: form.get("email"), subject: form.get("subject"), body: form.get("body") });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { error: "Please fix the highlighted fields.", fieldErrors };
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
