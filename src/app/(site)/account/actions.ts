"use server";
import { createHmac, randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getInstitute, getViewer } from "@/lib/session";
import { ACCOUNT_TYPES } from "@/lib/constants";
import { sendEmail } from "@/lib/email";
import type { ActionState } from "@/lib/types";
import { allowAll, clientIp, RATE_LIMITED } from "@/lib/rate-limit";
import { logError } from "@/lib/log";

const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name.").max(120),
  display_name: z.string().trim().min(2, "Enter a display name.").max(60),
  account_type: z.enum(ACCOUNT_TYPES.map((a) => a.id) as [string, ...string[]]),
  department: z.string().trim().max(120).optional(),
  academic_year: z.string().trim().max(40).optional(),
  designation: z.string().trim().max(120).optional(),
  bio: z.string().trim().max(500).optional(),
});

export async function updateProfile(_: ActionState, form: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  if (!viewer) return { error: "Please log in again." };
  const parsed = profileSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { error: "Please fix the highlighted fields.", fieldErrors };
  }
  const d = parsed.data;
  const supabase = await createClient();
  // Verification-critical fields (institute, verified status, roles) are not
  // updatable by users at all: the database only grants these columns.
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: d.full_name,
      display_name: d.display_name,
      account_type: d.account_type,
      department: d.department || null,
      academic_year: d.academic_year || null,
      designation: d.designation || null,
      bio: d.bio || null,
    })
    .eq("id", viewer.id);
  if (error) {
    await logError("profile.update", error.message);
    return { error: "Could not save your profile. Please try again." };
  }
  revalidatePath("/account", "layout");
  return { ok: true, message: "Profile saved." };
}

export async function updateAvatar(path: string | null): Promise<{ ok: boolean; error?: string }> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Please log in again." };
  if (path && (!path.startsWith(`${viewer.id}/`) || path.includes(".."))) return { ok: false, error: "Invalid photo." };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ avatar_url: path }).eq("id", viewer.id);
  if (error) return { ok: false, error: "Could not update your photo." };
  revalidatePath("/account", "layout");
  return { ok: true };
}

function hashCode(userId: string, code: string) {
  const secret = process.env.VERIFICATION_CODE_SECRET;
  if (!secret) throw new Error("VERIFICATION_CODE_SECRET is not set");
  return createHmac("sha256", secret).update(`${userId}:${code}`).digest("hex");
}

const DB_MEMBERSHIP_ERRORS: Record<string, string> = {
  institute_not_available: "This institute isn't available on UniMart.",
  email_domain_not_accepted: "That address isn't an accepted institute email.",
  email_already_used: "That institute email is already linked to another UniMart account.",
  already_verified: "You're already verified.",
  membership_revoked: "Your membership was revoked. Contact support.",
  too_many_codes_for_email: "Too many codes were requested for that address. Please wait an hour and try again.",
  too_many_codes: "Too many codes requested. Please wait an hour and try again.",
  rate_limited: "You're doing that too often. Please wait a little and try again.",
  note_too_short: "Please add a few more details (at least 10 characters).",
  cannot_request: "You can't request a review right now.",
};
// Map lookup is ordered so longer codes (too_many_codes_for_email) win.
const explain = (m?: string) => {
  const key = Object.keys(DB_MEMBERSHIP_ERRORS).find((k) => m?.includes(k));
  return key ? DB_MEMBERSHIP_ERRORS[key] : "Something went wrong. Please try again.";
};

export async function requestInstituteCode(_: ActionState, form: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  if (!viewer) return { error: "Please log in again." };
  const instituteId = String(form.get("instituteId") ?? "");
  const email = z.string().trim().toLowerCase().email().max(254).safeParse(form.get("email"));
  if (!email.success) return { error: "Enter your full institute email address." };
  if (!(await allowAll([[`code:ip:${await clientIp()}`, 15, 3600]]))) return { error: RATE_LIMITED };
  const institute = await getInstitute(instituteId);
  if (!institute?.is_active) return { error: "This institute isn't available." };
  if (!institute.email_domains_confirmed || institute.email_domains.length === 0)
    return { error: "Email verification isn't enabled for this institute yet. Please request a manual review." };

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const admin = createAdminClient();
  const { error } = await admin.rpc("membership_request_email_code", {
    p_user: viewer.id,
    p_institute: instituteId,
    p_email: email.data,
    p_code_hash: hashCode(viewer.id, code),
  });
  if (error) return { error: explain(error.message) };

  const sent = await sendEmail({
    to: email.data,
    subject: `Your UniMart verification code: ${code}`,
    text: `Your code to verify your ${institute.display_name} membership on UniMart is ${code}.\n\nIt expires in 15 minutes. If you didn't request this, you can ignore this email.`,
  });
  if (sent.error) return { error: sent.error };
  revalidatePath("/account/institute");
  return {
    ok: true,
    message: sent.devLogged
      ? "Development mode: no email provider is configured, so the code was printed in the server console."
      : `We emailed a 6-digit code to ${email.data}.`,
  };
}

export async function confirmInstituteCode(_: ActionState, form: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  if (!viewer) return { error: "Please log in again." };
  const code = String(form.get("code") ?? "").replace(/\D/g, "");
  if (code.length !== 6) return { error: "Enter the 6-digit code." };
  if (!(await allowAll([[`confirm:ip:${await clientIp()}`, 30, 3600]]))) return { error: RATE_LIMITED };
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("membership_confirm_email_code", {
    p_user: viewer.id,
    p_institute: String(form.get("instituteId") ?? ""),
    p_code_hash: hashCode(viewer.id, code),
  });
  if (error) return { error: "Something went wrong. Please try again." };
  const results: Record<string, ActionState> = {
    verified: { ok: true, message: "You're verified! You can now sell, message and make offers." },
    already_verified: { ok: true, message: "You're already verified." },
    invalid: { error: "That code isn't right. Check the email and try again." },
    expired: { error: "That code has expired. Request a new one." },
    too_many_attempts: { error: "Too many wrong attempts. Request a new code." },
    no_request: { error: "Request a code first." },
  };
  revalidatePath("/", "layout");
  return results[data as string] ?? { error: "Something went wrong." };
}

export async function requestManualReview(_: ActionState, form: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  if (!viewer) return { error: "Please log in again." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_manual_review", {
    p_institute: String(form.get("instituteId") ?? ""),
    p_note: String(form.get("note") ?? "").slice(0, 1000),
  });
  if (error) return { error: explain(error.message) };
  revalidatePath("/account/institute");
  return { ok: true, message: "Request sent. A moderator will review it; you'll get a notification." };
}

export async function markAllNotificationsRead() {
  const viewer = await getViewer();
  if (!viewer) return;
  const supabase = await createClient();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", viewer.id).is("read_at", null);
  revalidatePath("/", "layout");
}

export async function deleteAccount(_: ActionState, form: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  if (!viewer) return { error: "Please log in again." };
  if (String(form.get("confirm") ?? "").trim() !== "DELETE") return { error: "Type DELETE to confirm." };
  if (viewer.isAdmin) return { error: "Administrators must hand over the admin role before deleting their account." };
  const admin = createAdminClient();
  const { error: prepError } = await admin.rpc("prepare_account_deletion", { p_user: viewer.id });
  if (prepError) {
    await logError("account.delete.prepare", prepError.message);
    return { error: "Could not delete your account. Please contact support." };
  }
  // Remove uploaded files (listing photos and avatar).
  for (const bucket of ["listing-images", "avatars"]) {
    const { data: folders } = await admin.storage.from(bucket).list(viewer.id, { limit: 1000 });
    for (const f of folders ?? []) {
      if (f.id) await admin.storage.from(bucket).remove([`${viewer.id}/${f.name}`]);
      else {
        const { data: files } = await admin.storage.from(bucket).list(`${viewer.id}/${f.name}`, { limit: 1000 });
        if (files?.length) await admin.storage.from(bucket).remove(files.map((x) => `${viewer.id}/${f.name}/${x.name}`));
      }
    }
  }
  const { error } = await admin.auth.admin.deleteUser(viewer.id);
  if (error) {
    await logError("account.delete.auth", error.message);
    return { error: "Could not delete your account. Please contact support." };
  }
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/?deleted=1");
}
