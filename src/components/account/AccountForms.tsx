"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/ui/form";
import { createClient } from "@/lib/supabase/client";
import { ACCOUNT_TYPES, IMAGE_RULES } from "@/lib/constants";
import { storageUrl } from "@/lib/env";
import { reencodeImage } from "@/lib/image";
import {
  confirmInstituteCode,
  deleteAccount,
  requestInstituteCode,
  requestManualReview,
  updateAvatar,
  updateProfile,
} from "@/app/(site)/account/actions";
import type { Profile } from "@/lib/types";

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, action] = useActionState(updateProfile, null);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="card space-y-4 p-5">
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" name="full_name" error={fe.full_name}>
          <input id="full_name" name="full_name" defaultValue={profile.full_name} className="input" required maxLength={120} />
        </Field>
        <Field label="Display name" name="display_name" error={fe.display_name} hint="Shown on your listings and in chats.">
          <input id="display_name" name="display_name" defaultValue={profile.display_name} className="input" required maxLength={60} />
        </Field>
        <Field label="I am a…" name="account_type" error={fe.account_type}>
          <select id="account_type" name="account_type" defaultValue={profile.account_type ?? ""} className="input" required>
            <option value="" disabled>
              Choose one
            </option>
            {ACCOUNT_TYPES.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Department (optional)" name="department">
          <input id="department" name="department" defaultValue={profile.department ?? ""} className="input" maxLength={120} placeholder="e.g. Electronics & Communication" />
        </Field>
        <Field label="Academic year (optional)" name="academic_year">
          <input id="academic_year" name="academic_year" defaultValue={profile.academic_year ?? ""} className="input" maxLength={40} placeholder="e.g. 2nd year B.Tech" />
        </Field>
        <Field label="Designation (faculty/staff, optional)" name="designation">
          <input id="designation" name="designation" defaultValue={profile.designation ?? ""} className="input" maxLength={120} />
        </Field>
      </div>
      <Field label="About you (optional)" name="bio">
        <textarea id="bio" name="bio" defaultValue={profile.bio ?? ""} rows={3} maxLength={500} className="input" />
      </Field>
      <p className="text-xs text-muted">
        Your name, display name, account type, department and year are visible to signed-in members. Never add your phone number or room number.
      </p>
      <SubmitButton pendingText="Saving…">Save profile</SubmitButton>
    </form>
  );
}

export function AvatarUpload({ userId, current }: { userId: string; current: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const url = current ? (current.startsWith("http") ? current : storageUrl("avatars", current)) : null;
  return (
    <div className="flex items-center gap-4">
      <div className="relative h-20 w-20 overflow-hidden rounded-full border-2 border-ink bg-sky">
        {url && <Image src={url} alt="Your profile photo" fill sizes="80px" className="object-cover" unoptimized={url.startsWith("http") && !url.includes("/storage/v1/")} />}
      </div>
      <div className="space-y-1">
        <label className="btn-secondary btn-sm cursor-pointer has-focus-visible:outline-3">
          {busy ? "Uploading…" : "Change photo"}
          <input
            type="file"
            accept={IMAGE_RULES.types.join(",")}
            className="sr-only"
            disabled={busy}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setError(undefined);
              if (!IMAGE_RULES.types.includes(f.type) || f.size > 15 * 1024 * 1024) return setError("Use a JPG, PNG or WebP photo.");
              setBusy(true);
              let r: { ok: boolean; error?: string };
              try {
                // Re-encoded to strip EXIF/GPS metadata and keep avatars small.
                const blob = await reencodeImage(f, 512);
                const path = `${userId}/avatar-${Date.now()}.jpg`;
                const { error } = await createClient().storage.from("avatars").upload(path, blob, { contentType: "image/jpeg" });
                r = error ? { ok: false, error: "Upload failed. Please try again." } : await updateAvatar(path);
              } catch (err) {
                r = { ok: false, error: (err as Error).message };
              }
              setBusy(false);
              if (!r.ok) setError(r.error);
              else router.refresh();
            }}
          />
        </label>
        {current && (
          <button type="button" className="block text-xs text-danger underline" onClick={async () => (await updateAvatar(null)).ok && router.refresh()}>
            Remove photo
          </button>
        )}
        {error && <p className="field-error">{error}</p>}
      </div>
    </div>
  );
}

export function InstituteEmailForms({ instituteId, domains, pendingEmail }: { instituteId: string; domains: string[]; pendingEmail?: string | null }) {
  const [reqState, reqAction] = useActionState(requestInstituteCode, null);
  const [codeState, codeAction] = useActionState(confirmInstituteCode, null);
  const router = useRouter();
  const sent = reqState?.ok || Boolean(pendingEmail);
  if (codeState?.ok) {
    return (
      <div className="space-y-3">
        <FormMessage state={codeState} />
        <button type="button" className="btn-primary" onClick={() => router.push("/sell")}>
          Start selling
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <form action={reqAction} className="space-y-3">
        <input type="hidden" name="instituteId" value={instituteId} />
        <FormMessage state={reqState} />
        <Field label="Institute email" name="email" hint={`Accepted: ${domains.map((d) => "@" + d).join(", ")}`}>
          <input id="email" name="email" type="email" required className="input" defaultValue={pendingEmail ?? ""} placeholder={`you@${domains[0] ?? "institute.ac.in"}`} />
        </Field>
        <SubmitButton className={sent ? "btn-secondary" : "btn-primary"} pendingText="Sending code…">
          {sent ? "Send a new code" : "Send verification code"}
        </SubmitButton>
      </form>
      {sent && (
        <form action={codeAction} className="space-y-3 border-t border-line pt-4">
          <input type="hidden" name="instituteId" value={instituteId} />
          <FormMessage state={codeState} />
          <Field label="6-digit code" name="code">
            <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required className="input max-w-40 text-center font-mono text-xl tracking-[0.3em]" />
          </Field>
          <SubmitButton pendingText="Checking…">Verify</SubmitButton>
        </form>
      )}
    </div>
  );
}

export function ManualReviewForm({ instituteId }: { instituteId: string }) {
  const [state, action] = useActionState(requestManualReview, null);
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="instituteId" value={instituteId} />
      <FormMessage state={state} />
      <Field label="Tell the moderators how you're connected to the institute" name="note" hint="e.g. your role, department and roll/employee number. Don't upload ID documents here.">
        <textarea id="note" name="note" rows={3} minLength={10} maxLength={1000} required className="input" />
      </Field>
      <SubmitButton className="btn-secondary" pendingText="Sending…">
        Request manual review
      </SubmitButton>
    </form>
  );
}

export function PasswordForm() {
  const [msg, setMsg] = useState<{ ok?: boolean; text: string }>();
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const pw = String(fd.get("password"));
        if (pw.length < 8 || !/\d/.test(pw) || !/[A-Za-z]/.test(pw)) return setMsg({ text: "Use at least 8 characters with a letter and a number." });
        if (pw !== fd.get("confirm")) return setMsg({ text: "Passwords do not match." });
        setBusy(true);
        const { error } = await createClient().auth.updateUser({ password: pw });
        setBusy(false);
        setMsg(error ? { text: error.message } : { ok: true, text: "Password updated." });
        if (!error) (e.target as HTMLFormElement).reset();
      }}
    >
      {msg && <FormMessage state={msg.ok ? { message: msg.text } : { error: msg.text }} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="New password" name="password">
          <input id="password" name="password" type="password" autoComplete="new-password" required className="input" />
        </Field>
        <Field label="Confirm new password" name="confirm">
          <input id="confirm" name="confirm" type="password" autoComplete="new-password" required className="input" />
        </Field>
      </div>
      <button type="submit" className="btn-secondary" disabled={busy}>
        {busy ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}

export function DeleteAccountForm() {
  const [state, action] = useActionState(deleteAccount, null);
  return (
    <form action={action} className="space-y-3">
      <FormMessage state={state} />
      <p className="text-sm">
        This removes your profile, listings, saved items and photos, and signs you out. Messages you sent stay visible to the
        other person as “Former member”, and moderation records are kept where needed for safety.
      </p>
      <Field label="Type DELETE to confirm" name="confirm">
        <input id="confirm-delete" name="confirm" className="input max-w-48" autoComplete="off" />
      </Field>
      <SubmitButton className="btn-danger" pendingText="Deleting…">
        Delete my account
      </SubmitButton>
    </form>
  );
}
