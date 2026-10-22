import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { env, isSupabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Liveness + database readiness for uptime monitors. Returns 503 when the
 * database can't be reached within 3 s. Reveals no configuration details.
 */
export async function GET() {
  const started = Date.now();
  if (!isSupabaseConfigured) {
    return NextResponse.json({ status: "unconfigured" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  let db: "ok" | "error" = "error";
  try {
    const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, { auth: { persistSession: false } });
    const { error } = await supabase.from("categories").select("id", { head: true, count: "exact" }).abortSignal(AbortSignal.timeout(3000));
    if (!error) db = "ok";
  } catch {
    db = "error";
  }
  const ok = db === "ok";
  return NextResponse.json(
    { status: ok ? "ok" : "degraded", db, latencyMs: Date.now() - started },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
