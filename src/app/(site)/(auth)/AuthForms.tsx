"use client";
import Link from "next/link";
import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/ui/form";
import { login, requestPasswordReset, signup, updatePassword } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(login, null);
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <FormMessage state={state} />
      <Field label="Email" name="email">
        <input id="email" name="email" type="email" autoComplete="email" required className="input" />
      </Field>
      <Field label="Password" name="password">
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
      </Field>
      <div className="flex justify-end text-sm">
        <Link href="/forgot-password" className="link">
          Forgot password?
        </Link>
      </div>
      <SubmitButton className="btn-primary w-full" pendingText="Logging in…">
        Log in
      </SubmitButton>
    </form>
  );
}

export function SignupForm({ next }: { next: string }) {
  const [state, action] = useActionState(signup, null);
  if (state?.ok) return <FormMessage state={state} />;
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <FormMessage state={state} />
      <Field label="Full name" name="fullName" error={fe.fullName}>
        <input id="fullName" name="fullName" autoComplete="name" required className="input" aria-invalid={Boolean(fe.fullName)} />
      </Field>
      <Field label="Email" name="email" error={fe.email} hint="Any email works for your account. You verify your institute separately.">
        <input id="email" name="email" type="email" autoComplete="email" required className="input" aria-invalid={Boolean(fe.email)} aria-describedby="email-hint" />
      </Field>
      <Field label="Password" name="password" error={fe.password} hint="At least 8 characters, with a letter and a number.">
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} className="input" aria-invalid={Boolean(fe.password)} aria-describedby="password-hint" />
      </Field>
      <div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="terms" className="mt-0.5 h-5 w-5 accent-black" aria-invalid={Boolean(fe.terms)} />
          <span>
            I agree to the <Link href="/terms" className="link">terms</Link> and{" "}
            <Link href="/privacy" className="link">privacy notice</Link>, and I will follow the{" "}
            <Link href="/help#safety" className="link">safety guidelines</Link>.
          </span>
        </label>
        {fe.terms && <p className="field-error">{fe.terms}</p>}
      </div>
      <SubmitButton className="btn-primary w-full" pendingText="Creating account…">
        Create account
      </SubmitButton>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordReset, null);
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <Field label="Email" name="email">
        <input id="email" name="email" type="email" autoComplete="email" required className="input" />
      </Field>
      <SubmitButton className="btn-primary w-full" pendingText="Sending…">
        Send reset link
      </SubmitButton>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action] = useActionState(updatePassword, null);
  if (state?.ok)
    return (
      <div className="space-y-4">
        <FormMessage state={state} />
        <Link href="/marketplace" className="btn-primary w-full">
          Continue to UniMart
        </Link>
      </div>
    );
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <Field label="New password" name="password" hint="At least 8 characters, with a letter and a number.">
        <input id="password" name="password" type="password" autoComplete="new-password" required className="input" />
      </Field>
      <Field label="Confirm new password" name="confirm">
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" required className="input" />
      </Field>
      <SubmitButton className="btn-primary w-full" pendingText="Saving…">
        Update password
      </SubmitButton>
    </form>
  );
}
