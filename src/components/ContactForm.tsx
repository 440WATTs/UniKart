"use client";
import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/ui/form";
import { sendContactMessage } from "@/app/(site)/contact/actions";

export function ContactForm() {
  const [state, action] = useActionState(sendContactMessage, null);
  if (state?.ok) return <FormMessage state={state} />;
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="card space-y-4 p-5" noValidate>
      <FormMessage state={state} />
      {/* Honeypot for simple bots; hidden from people and assistive tech. */}
      <div aria-hidden className="hidden">
        <label>
          Website <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <Field label="Your name" name="name" error={fe.name}>
        <input id="name" name="name" required maxLength={120} autoComplete="name" className="input" />
      </Field>
      <Field label="Email" name="email" error={fe.email}>
        <input id="email" name="email" type="email" required maxLength={200} autoComplete="email" className="input" />
      </Field>
      <Field label="Subject" name="subject" error={fe.subject}>
        <input id="subject" name="subject" required maxLength={160} className="input" />
      </Field>
      <Field label="Message" name="body" error={fe.body}>
        <textarea id="body" name="body" required rows={6} minLength={10} maxLength={4000} className="input" />
      </Field>
      <SubmitButton pendingText="Sending…">Send message</SubmitButton>
    </form>
  );
}
