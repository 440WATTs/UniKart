"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { safeNext } from "@/lib/format";
import { logError } from "@/lib/log";
import { allowAll, clientIp, RATE_LIMITED } from "@/lib/rate-limit";
import type { ActionState } from "@/lib/types";

/**
 * Links in emails and OAuth redirects always use the configured site URL,
 * never request headers (which a client can set): prevents reset-link poisoning.
 */
const siteUrl = () => env.siteUrl.replace(/\/+$/, "");

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
  password: z.string().min(1, "Enter your password.").max(200),
});

export async function login(_: ActionState, form: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  // Sign-in runs on our server, so Supabase sees one IP for everyone: limit per IP and per account here.
  const ip = await clientIp();
  if (!(await allowAll([[`login:ip:${ip}`, 30, 900], [`login:email:${parsed.data.email}`, 10, 900]]))) return { error: RATE_LIMITED };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (/confirm/i.test(error.message)) return { error: "Please confirm your email first. Check your inbox for the link." };
    if (error.status === 429) return { error: RATE_LIMITED };
    return { error: "Incorrect email or password." };
  }
  redirect(safeNext(form.get("next") as string | null));
}

const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(72)
  .regex(/[A-Za-z]/, "Include at least one letter.")
  .regex(/\d/, "Include at least one number.");

const signupSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
  password: passwordSchema,
  terms: z.literal("on", { errorMap: () => ({ message: "Please accept the terms to continue." }) }),
});

export async function signup(_: ActionState, form: FormData): Promise<ActionState> {
  const parsed = signupSchema.safeParse({
    fullName: form.get("fullName"),
    email: form.get("email"),
    password: form.get("password"),
    terms: form.get("terms"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { error: "Please fix the highlighted fields.", fieldErrors };
  }
  if (!(await allowAll([[`signup:ip:${await clientIp()}`, 10, 3600]]))) return { error: RATE_LIMITED };
  const supabase = await createClient();
  const next = safeNext(form.get("next") as string | null, "/account/institute");
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${siteUrl()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) {
    if (error.status === 429) return { error: RATE_LIMITED };
    if (/password/i.test(error.message)) return { error: "Choose a stronger password.", fieldErrors: { password: error.message } };
    await logError("auth.signup", error.message);
    // Generic text: avoids revealing whether an account exists.
    return { error: "We couldn't create the account. Please check your details and try again." };
  }
  // With email confirmation on, Supabase returns no session until the link is clicked.
  if (!data.session) {
    return { ok: true, message: `If ${parsed.data.email} can be registered, a confirmation link is on its way. Open it to finish creating your account.` };
  }
  redirect(next);
}

export async function signInWithGoogle(form: FormData) {
  if (!env.googleAuthEnabled) redirect("/login?error=google_disabled");
  const next = safeNext(form.get("next") as string | null);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${siteUrl()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) {
    await logError("auth.google", error?.message ?? "no url");
    redirect("/login?error=oauth_failed");
  }
  redirect(data.url);
}

export async function requestPasswordReset(_: ActionState, form: FormData): Promise<ActionState> {
  const email = z.string().trim().toLowerCase().email().max(254).safeParse(form.get("email"));
  if (!email.success) return { error: "Enter a valid email address." };
  const done: ActionState = { ok: true, message: "If an account exists for that email, a reset link is on its way." };
  if (!(await allowAll([[`reset:ip:${await clientIp()}`, 10, 3600], [`reset:email:${email.data}`, 3, 3600]]))) return { error: RATE_LIMITED };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.data, { redirectTo: `${siteUrl()}/auth/callback?next=/reset-password` });
  if (error && error.status !== 429) await logError("auth.reset", error.message);
  // Same response whether or not the account exists, to avoid account enumeration.
  return done;
}

export async function updatePassword(_: ActionState, form: FormData): Promise<ActionState> {
  const pw = passwordSchema.safeParse(form.get("password"));
  if (!pw.success) return { error: pw.error.issues[0].message };
  if (form.get("password") !== form.get("confirm")) return { error: "Passwords do not match." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: pw.data });
  if (error) {
    if (/session/i.test(error.message)) return { error: "Your reset link has expired. Request a new one." };
    return { error: "Couldn't update the password. Choose a different one and try again." };
  }
  return { ok: true, message: "Your password has been updated." };
}
