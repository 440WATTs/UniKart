import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { env, isSupabaseConfigured } from "@/lib/env";

export async function POST(request: NextRequest) {
  // Cross-site forms can't log people out (browsers always send Origin on POST).
  const origin = request.headers.get("origin");
  const allowed = new Set([new URL(env.siteUrl).origin, request.nextUrl.origin]);
  if (!origin || !allowed.has(origin)) return new NextResponse("Forbidden", { status: 403 });

  if (isSupabaseConfigured) {
    const supabase = await createClient();
    // Only this device; other devices stay signed in.
    await supabase.auth.signOut({ scope: "local" });
  }
  // 303 so the browser follows with GET after a form POST.
  return NextResponse.redirect(new URL("/", env.siteUrl), { status: 303 });
}
