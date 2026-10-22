/**
 * Validates server configuration at startup (called from src/instrumentation.ts).
 * In production a missing or placeholder value stops the server from booting,
 * instead of failing later on the first user request.
 */
const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SITE_URL",
  "VERIFICATION_CODE_SECRET",
] as const;

/** https everywhere, except http://localhost for local production smoke tests. */
function isHttpsOrLocalhost(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" || (u.protocol === "http:" && ["localhost", "127.0.0.1"].includes(u.hostname));
  } catch {
    return false;
  }
}

export function checkServerEnv(env: Record<string, string | undefined> = process.env) {
  const problems: string[] = [];
  for (const k of REQUIRED) if (!env[k]?.trim()) problems.push(`${k} is not set`);
  if (env.NEXT_PUBLIC_SITE_URL && !isHttpsOrLocalhost(env.NEXT_PUBLIC_SITE_URL)) problems.push("NEXT_PUBLIC_SITE_URL must use https:// in production");
  if (env.NEXT_PUBLIC_SUPABASE_URL && !/^https:\/\//.test(env.NEXT_PUBLIC_SUPABASE_URL)) problems.push("NEXT_PUBLIC_SUPABASE_URL must use https:// in production");
  if (env.VERIFICATION_CODE_SECRET && env.VERIFICATION_CODE_SECRET.length < 32) problems.push("VERIFICATION_CODE_SECRET must be at least 32 characters");
  if (env.ALLOW_DEMO_SEED === "true") problems.push("ALLOW_DEMO_SEED must not be enabled in production");
  if ((env.RESEND_API_KEY && !env.EMAIL_FROM) || (!env.RESEND_API_KEY && env.EMAIL_FROM)) problems.push("RESEND_API_KEY and EMAIL_FROM must be set together");
  return problems;
}

export function assertServerEnv() {
  if (process.env.NODE_ENV !== "production") return;
  const problems = checkServerEnv();
  if (problems.length) {
    throw new Error(`Invalid production configuration:\n - ${problems.join("\n - ")}\nSee docs/SETUP.md.`);
  }
}
