import { z } from "zod";

/** Trimmed, lower-cased email address (shared by login, signup, reset and institute codes). */
export const emailField = (message = "Enter a valid email address.") =>
  z.string().trim().toLowerCase().max(254, message).pipe(z.email(message));

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(72, "Use at most 72 characters.")
  .regex(/[A-Za-z]/, "Include at least one letter.")
  .regex(/\d/, "Include at least one number.");

export const loginSchema = z.object({
  email: emailField(),
  password: z.string().min(1, "Enter your password.").max(200),
});

export const signupSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(120),
  email: emailField(),
  password: passwordSchema,
  terms: z.literal("on", { error: "Please accept the terms to continue." }),
});

export const contactSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(120),
  email: z.string().trim().max(200, "Enter a valid email.").pipe(z.email("Enter a valid email.")),
  subject: z.string().trim().min(1, "Enter a subject.").max(160),
  body: z.string().trim().min(10, "Write at least 10 characters.").max(4000),
});

/** First message per field, for forms that highlight fields. */
export function fieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const i of error.issues) out[String(i.path[0])] ??= i.message;
  return out;
}
