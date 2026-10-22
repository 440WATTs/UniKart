import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { safeNext } from "@/lib/format";
import { logError } from "@/lib/log";

/**
 * OAuth (Google) and PKCE email-link callback. Supabase validates the Google
 * credential server-side; we exchange the one-time code for a session cookie.
 * Redirects use the configured site URL, never the request's Host header.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const site = env.siteUrl.replace(/\/+$/, "");
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${site}${next}`);
    await logError("auth.callback", error.message);
    return NextResponse.redirect(`${site}/login?error=link_invalid`);
  }
  const cancelled = searchParams.get("error") === "access_denied";
  return NextResponse.redirect(`${site}/login?error=${cancelled ? "oauth_cancelled" : "oauth_failed"}`);
}
