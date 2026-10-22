import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { safeNext } from "@/lib/format";

const TYPES: EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

/**
 * Email confirmation and password-recovery links using token_hash. Unlike the
 * PKCE code flow, these work when the email is opened on a different device.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const site = env.siteUrl.replace(/\/+$/, "");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = type === "recovery" ? "/reset-password" : safeNext(searchParams.get("next"), "/account/institute");

  if (tokenHash && type && TYPES.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${site}${next}`);
  }
  return NextResponse.redirect(`${site}/login?error=link_invalid`);
}
