"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";
import { friendlyDbError } from "@/app/(site)/actions";
import type { ActionState } from "@/lib/types";

/**
 * Every admin action is re-authorized in the database (SECURITY DEFINER
 * functions call require_staff()/is_admin()); these checks just fail early.
 */
async function staff(adminOnly = false) {
  const v = await getViewer();
  if (!v || !v.isStaff || (adminOnly && !v.isAdmin)) throw new Error("forbidden");
  return createClient();
}

async function run(fn: () => Promise<{ error: { message: string } | null }>, path: string, ok: string): Promise<ActionState> {
  try {
    const { error } = await fn();
    if (error) return { error: await friendlyDbError(error.message) };
  } catch {
    return { error: "You don't have permission to do that." };
  }
  revalidatePath(path);
  return { ok: true, message: ok };
}

export async function reviewMembership(_: ActionState, form: FormData) {
  const decision = z.enum(["verified", "rejected", "revoked"]).parse(form.get("decision"));
  return run(
    async () =>
      (await staff()).rpc("review_membership", {
        p_membership: String(form.get("id")),
        p_decision: decision,
        p_note: String(form.get("note") ?? "") || null,
      }),
    "/admin/memberships",
    `Membership ${decision}.`,
  );
}

export async function moderateListing(_: ActionState, form: FormData) {
  const action = z.enum(["remove", "restore"]).parse(form.get("action"));
  const reason = String(form.get("reason") ?? "").trim();
  if (!reason) return { error: "Give a reason; it is shown to the seller and recorded." };
  return run(
    async () =>
      (await staff()).rpc("moderate_listing", {
        p_listing: String(form.get("id")),
        p_action: action,
        p_reason: reason,
        p_report: form.get("reportId") ? String(form.get("reportId")) : null,
      }),
    "/admin",
    action === "remove" ? "Listing removed." : "Listing restored.",
  );
}

export async function resolveReport(_: ActionState, form: FormData) {
  const status = z.enum(["actioned", "dismissed"]).parse(form.get("status"));
  return run(
    async () => (await staff()).rpc("resolve_report", { p_report: String(form.get("id")), p_status: status, p_note: String(form.get("note") ?? "") || null }),
    "/admin/reports",
    `Report ${status}.`,
  );
}

export async function setSuspension(_: ActionState, form: FormData) {
  const suspend = form.get("suspend") === "true";
  const reason = String(form.get("reason") ?? "").trim();
  if (suspend && !reason) return { error: "Give a reason for the suspension." };
  return run(
    async () => (await staff()).rpc("set_user_suspension", { p_user: String(form.get("id")), p_suspend: suspend, p_reason: reason || null }),
    "/admin/users",
    suspend ? "User suspended and their listings removed." : "Suspension lifted.",
  );
}

export async function setRole(_: ActionState, form: FormData) {
  const role = z.enum(["admin", "moderator"]).parse(form.get("role"));
  const grant = form.get("grant") === "true";
  return run(
    async () => (await staff(true)).rpc("set_user_role", { p_user: String(form.get("id")), p_role: role, p_grant: grant }),
    "/admin/users",
    grant ? `Granted ${role}.` : `Removed ${role}.`,
  );
}

const categorySchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{2,40}$/, "ID: 2–40 lowercase letters, numbers or dashes."),
  name: z.string().trim().min(2).max(60),
  sort_order: z.coerce.number().int().min(0).max(1000),
  is_active: z.boolean(),
});

export async function saveCategory(_: ActionState, form: FormData) {
  const parsed = categorySchema.safeParse({
    id: form.get("id"),
    name: form.get("name"),
    sort_order: form.get("sort_order"),
    is_active: form.get("is_active") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const isNew = form.get("isNew") === "true";
  return run(
    async () => {
      const supabase = await staff(true);
      return isNew
        ? supabase.from("categories").insert(parsed.data)
        : supabase.from("categories").update({ name: parsed.data.name, sort_order: parsed.data.sort_order, is_active: parsed.data.is_active }).eq("id", parsed.data.id);
    },
    "/admin/categories",
    "Category saved.",
  );
}

const instituteSchema = z.object({
  id: z.string(),
  display_name: z.string().trim().min(2).max(80),
  official_name: z.string().trim().min(2).max(200),
  email_domains: z.array(z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, "Domains look like nitsikkim.ac.in")),
  email_domains_confirmed: z.boolean(),
  allow_manual_review: z.boolean(),
  is_active: z.boolean(),
  offers_enabled: z.boolean(),
  public_browse: z.boolean(),
});

export async function saveInstitute(_: ActionState, form: FormData) {
  const parsed = instituteSchema.safeParse({
    id: form.get("id"),
    display_name: form.get("display_name"),
    official_name: form.get("official_name"),
    email_domains: String(form.get("email_domains") ?? "")
      .split(/[\s,]+/)
      .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
      .filter(Boolean),
    email_domains_confirmed: form.get("email_domains_confirmed") === "on",
    allow_manual_review: form.get("allow_manual_review") === "on",
    is_active: form.get("is_active") === "on",
    offers_enabled: form.get("offers_enabled") === "on",
    public_browse: form.get("public_browse") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  return run(
    async () => {
      const supabase = await staff(true);
      const { data: current } = await supabase.from("institutes").select("settings").eq("id", d.id).single();
      return supabase
        .from("institutes")
        .update({
          display_name: d.display_name,
          official_name: d.official_name,
          email_domains: d.email_domains,
          email_domains_confirmed: d.email_domains_confirmed && d.email_domains.length > 0,
          allow_manual_review: d.allow_manual_review,
          is_active: d.is_active,
          settings: { ...(current?.settings ?? {}), offers_enabled: d.offers_enabled, public_browse: d.public_browse },
        })
        .eq("id", d.id);
    },
    "/admin/institutes",
    "Institute saved.",
  );
}

export async function markContactHandled(form: FormData) {
  const supabase = await staff();
  await supabase.from("contact_messages").update({ handled: true }).eq("id", String(form.get("id")));
  revalidatePath("/admin/inbox");
}
