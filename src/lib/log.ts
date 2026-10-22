import "server-only";
import { headers } from "next/headers";

/** Request ID set by the middleware, for correlating logs with user reports. */
export async function requestId() {
  try {
    return (await headers()).get("x-request-id") ?? "none";
  } catch {
    return "none";
  }
}

/**
 * Structured server-side error log. Never pass secrets, tokens, passwords or
 * message bodies here; database error text and identifiers only.
 */
export async function logError(scope: string, error: unknown, extra: Record<string, unknown> = {}) {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : JSON.stringify(error);
  console.error(JSON.stringify({ level: "error", scope, message, requestId: await requestId(), ...extra, at: new Date().toISOString() }));
}
