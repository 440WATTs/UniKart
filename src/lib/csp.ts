/**
 * Content-Security-Policy for app pages. Scripts must carry the per-request
 * nonce ('strict-dynamic' lets Next's own chunks load); everything else is
 * limited to this site and the Supabase project.
 */
export function buildCsp({ nonce, supabaseUrl, dev, https = !dev }: { nonce: string; supabaseUrl: string; dev: boolean; https?: boolean }) {
  let supabase = "";
  let supabaseWs = "";
  try {
    const u = new URL(supabaseUrl);
    supabase = u.origin;
    supabaseWs = `${u.protocol === "https:" ? "wss:" : "ws:"}//${u.host}`;
  } catch {
    // Not configured: setup screen only.
  }
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(dev ? ["'unsafe-eval'"] : [])],
    // Inline style attributes are used by Next (next/image, fonts) and the UI.
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", supabase, "https://*.googleusercontent.com"].filter(Boolean),
    "font-src": ["'self'"],
    "connect-src": ["'self'", supabase, supabaseWs, ...(dev ? ["ws:"] : [])].filter(Boolean),
    // Chrome applies form-action to redirects after a form POST (e.g. Google sign-in).
    "form-action": ["'self'", supabase, "https://accounts.google.com"].filter(Boolean),
    "frame-ancestors": ["'none'"],
    "base-uri": ["'self'"],
    "object-src": ["'none'"],
  };
  const parts = Object.entries(directives).map(([k, v]) => `${k} ${v.join(" ")}`);
  // Only on https sites: on a plain-http page it would upgrade same-origin requests and break them.
  if (https) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}

/** Request IDs from an upstream proxy are kept only if they look like IDs. */
export function sanitizeRequestId(incoming: string | null | undefined) {
  return incoming && /^[A-Za-z0-9._-]{8,128}$/.test(incoming) ? incoming : null;
}
