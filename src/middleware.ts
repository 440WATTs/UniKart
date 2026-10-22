import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { buildCsp, sanitizeRequestId } from "@/lib/csp";

const PROTECTED = ["/sell", "/messages", "/saved", "/account", "/admin"];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const requestId = sanitizeRequestId(request.headers.get("x-request-id")) ?? crypto.randomUUID();

  // "/" is the static landing page; its CSP (with script hashes) is set in next.config.ts.
  if (path === "/") {
    const res = NextResponse.next();
    res.headers.set("x-request-id", requestId);
    return res;
  }

  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp({
    nonce,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    dev: process.env.NODE_ENV === "development",
    https: (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://"),
  });
  // Next reads the nonce from the request's CSP header and applies it to its scripts.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);
  const finish = (res: NextResponse) => {
    res.headers.set("content-security-policy", csp);
    res.headers.set("x-request-id", requestId);
    return res;
  };

  let response = NextResponse.next({ request: { headers: requestHeaders } });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return finish(response);

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        requestHeaders.set("cookie", request.headers.get("cookie") ?? "");
        response = NextResponse.next({ request: { headers: requestHeaders } });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Verifies the session (refreshing it when expired) before any redirect decision.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  if (!signedIn && PROTECTED.some((p) => path === p || path.startsWith(p + "/"))) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    const redirect = NextResponse.redirect(login);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return finish(redirect);
  }
  return finish(response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/|landing.html|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
