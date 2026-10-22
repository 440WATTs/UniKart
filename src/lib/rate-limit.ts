import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/log";

/**
 * Client IP as reported by the hosting proxy. On Vercel `x-forwarded-for` is
 * set by the platform; on other hosts the proxy must overwrite (not append to)
 * this header, otherwise clients can spoof it (see docs/DEPLOYMENT.md).
 */
export async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Records a hit and returns false once `max` hits happened within `windowSeconds`.
 * Backed by the database (rate_limit_hit), so it works across server instances.
 * Fails closed: if the limiter can't be reached, the action is refused.
 */
export async function allow(key: string, max: number, windowSeconds: number): Promise<boolean> {
  try {
    const { data, error } = await createAdminClient().rpc("rate_limit_hit", {
      p_key: key,
      p_max: max,
      p_window: `${windowSeconds} seconds`,
    });
    if (error) throw error;
    return data === true;
  } catch (e) {
    await logError("rate-limit", e, { key: key.split(":")[0] });
    return false;
  }
}

/** Checks several limits; all must pass. Stops at the first refusal. */
export async function allowAll(limits: [key: string, max: number, windowSeconds: number][]) {
  for (const [k, m, w] of limits) if (!(await allow(k, m, w))) return false;
  return true;
}

export const RATE_LIMITED = "Too many attempts. Please wait a few minutes and try again.";
