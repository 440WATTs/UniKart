#!/usr/bin/env python3
"""Build the static, demo-data UI preview served by GitHub Pages at /UniKart/preview/.

    npm run preview:build        -> .preview-build/site/  (index.html = landing, preview/ = app)

The real app needs a server and Supabase, which GitHub Pages can't provide. This
script copies the app to .preview-build/app, swaps the data layer for the demo
data in preview/src, replaces server actions with "Preview only" stubs, applies
the few changes a static export needs, and exports it. The repository's own
source is never modified.

Every patch asserts the code it expects, so the build fails loudly if the app
changes in a way the preview no longer understands.
"""
import glob
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORK = ROOT / ".preview-build"
APP = WORK / "app"
SITE = WORK / "site"
BASE = "/UniKart/preview"


def sub(path, old, new, count=1):
    p = APP / path
    s = p.read_text(encoding="utf-8")
    if old not in s:
        sys.exit(f"build-preview: expected text not found in {path}:\n{old[:200]}")
    p.write_text(s.replace(old, new, count), encoding="utf-8")


def write(path, text):
    p = APP / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding="utf-8")


def resub(path, pattern, repl, flags=0, required=True):
    p = APP / path
    s = p.read_text(encoding="utf-8")
    new, n = re.subn(pattern, repl, s, flags=flags)
    if required and n == 0:
        sys.exit(f"build-preview: pattern not found in {path}: {pattern}")
    p.write_text(new, encoding="utf-8")


def copy_app():
    shutil.rmtree(WORK, ignore_errors=True)
    ignore = shutil.ignore_patterns("node_modules", ".next", ".git", ".preview-build", ".github", "out")
    shutil.copytree(ROOT, APP, ignore=ignore)
    (APP / "node_modules").symlink_to(ROOT / "node_modules")
    shutil.copytree(ROOT / "preview" / "src", APP / "src" / "preview", ignore=shutil.ignore_patterns("search"))
    for f in ("page.tsx", "SearchClient.tsx"):
        shutil.copy(ROOT / "preview" / "src" / "search" / f, APP / "src" / "app" / "(site)" / "search" / f)
    shutil.rmtree(APP / "preview")
    # Server-only parts a static export can't have.
    for p in ("src/middleware.ts", "src/instrumentation.ts", "src/app/api", "src/app/auth", "src/app/favicon.ico"):
        t = APP / p
        shutil.rmtree(t) if t.is_dir() else t.unlink(missing_ok=True)


def patch():
    write("next.config.ts", f'''import type {{ NextConfig }} from "next";
// PREVIEW ONLY: static export for GitHub Pages.
const nextConfig: NextConfig = {{
  output: "export",
  basePath: "{BASE}",
  trailingSlash: true,
  images: {{ unoptimized: true }},
}};
export default nextConfig;
''')

    # Data layer -> demo data.
    mock = 'import { createMockClient } from "@/preview/mock-client";\n'
    write("src/lib/supabase/server.ts", mock + "export async function createClient() {\n  return createMockClient();\n}\n")
    write("src/lib/supabase/client.ts", '"use client";\n' + mock + "export function createClient() {\n  return createMockClient();\n}\n")
    write("src/lib/supabase/admin.ts", mock + "export function createAdminClient() {\n  return createMockClient();\n}\n")

    # Server actions -> "Preview only" stubs (static exports can't have server actions).
    stub = 'import { PREVIEW_MSG, previewState } from "@/preview/stubs";\n'
    write("src/app/(site)/actions.ts", stub + '''export async function friendlyDbError(_m?: string) {
  return PREVIEW_MSG;
}
export async function toggleSave(_id: string, save: boolean) {
  return { saved: !save, error: PREVIEW_MSG };
}
export async function startConversation(_f: FormData) {}
export const makeOffer = previewState;
export const submitReport = previewState;
''')
    write("src/app/(site)/(auth)/actions.ts", stub + '''void PREVIEW_MSG;
export const login = previewState;
export const signup = previewState;
export const requestPasswordReset = previewState;
export const updatePassword = previewState;
export async function signInWithGoogle(_f: FormData) {}
''')
    write("src/app/(site)/account/actions.ts", stub + '''export const updateProfile = previewState;
export const requestInstituteCode = previewState;
export const confirmInstituteCode = previewState;
export const requestManualReview = previewState;
export const deleteAccount = previewState;
export async function updateAvatar(_p: string | null) {
  return { ok: false, error: PREVIEW_MSG };
}
export async function markAllNotificationsRead() {}
''')
    write("src/app/(site)/sell/actions.ts", '''import { PREVIEW_MSG } from "@/preview/stubs";
export type ListingInput = {
  id: string;
  kind: "sale" | "wanted";
  title?: string;
  category_id?: string;
  price?: string;
  is_free?: boolean;
  condition?: "new" | "like_new" | "good" | "fair" | "for_parts" | null;
  listing_type?: "fixed" | "fixed_offers";
  negotiable?: boolean;
  description?: string;
  brand?: string;
  model?: string;
  purchase_date?: string;
  original_price?: string;
  images?: string[];
  publish?: boolean;
};
export type SaveResult = { ok: boolean; id?: string; error?: string; fieldErrors?: Record<string, string> };
export async function saveListing(_i: ListingInput): Promise<SaveResult> {
  return { ok: false, error: PREVIEW_MSG };
}
export async function setListingStatus(_id: string, _s: string) {
  return { ok: false, error: PREVIEW_MSG };
}
export async function deleteDraft(_id: string) {
  return { ok: false, error: PREVIEW_MSG };
}
''')
    write("src/app/(site)/contact/actions.ts", 'import { previewState } from "@/preview/stubs";\nexport const sendContactMessage = previewState;\n')
    write("src/app/(site)/admin/actions.ts", '''import { previewState } from "@/preview/stubs";
export const reviewMembership = previewState;
export const moderateListing = previewState;
export const resolveReport = previewState;
export const setSuspension = previewState;
export const setRole = previewState;
export const saveCategory = previewState;
export const saveInstitute = previewState;
export async function markContactHandled(_f: FormData) {}
''')

    # Photos from the exported demo folder; always "configured".
    sub("src/lib/env.ts", "export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);", "export const isSupabaseConfigured = true; // preview: demo data")
    resub("src/lib/env.ts", r"export function storageUrl\(.*?\n}\n", f'export function storageUrl(_bucket: "listing-images" | "avatars", path: string) {{\n  return `{BASE}/${{path}}`;\n}}\n', flags=re.S)
    sub("src/lib/errors.ts", "export const DB_ERRORS: Record<string, string> = {", 'export const DB_ERRORS: Record<string, string> = {\n  preview_only: "Preview only: this action needs the real backend (Supabase), so nothing was saved.",')
    sub("src/components/messages/ChatThread.tsx", "const OFFER_ERRORS: Record<string, string> = {", 'const OFFER_ERRORS: Record<string, string> = {\n  preview_only: "Preview only: messages and offers need the real backend.",')

    # Static rendering + a banner on every page.
    sub("src/app/(site)/layout.tsx", '// Every page depends on the signed-in user (cookies), so never prerender.\nexport const dynamic = "force-dynamic";\n', "")
    sub("src/app/(site)/layout.tsx", "      <Header />", '''      <div role="note" className="border-b-2 border-ink bg-ink px-4 py-1.5 text-center text-xs font-semibold text-sun">
        UI PREVIEW — demo data and a pretend signed-in account. Nothing you do here is saved.
      </div>
      <Header />''')
    sub("src/app/layout.tsx", 'icons: { icon: "/brand/unikart-logo.png" },', f'icons: {{ icon: "{BASE}/brand/unikart-logo.png" }},')
    sub("src/components/layout/Logo.tsx", 'src="/brand/unikart-logo.png"', f'src="{BASE}/brand/unikart-logo.png"')
    sub("src/components/layout/Logo.tsx", "<Link href={href} className=", "<Link href={href} prefetch={false} className=")

    # Login/signup show their forms although the preview pretends you're signed in.
    for p in ("src/app/(site)/(auth)/login/page.tsx", "src/app/(site)/(auth)/signup/page.tsx"):
        resub(p, r"\n  if \(await getViewer\(\)\) redirect\(next\);", "")

    # "Message seller" opens a demo chat; static params for dynamic routes.
    p = "src/app/(site)/product/[id]/page.tsx"
    sub(p, '''      <form action={startConversation}>
        <input type="hidden" name="listingId" value={listing.id} />
        <SubmitButton className="btn-primary w-full text-base" pendingText="Opening chat…">
          <ChatIcon size={18} /> {contactLabel}
        </SubmitButton>
      </form>''', '''      <Link href="/messages/00000000-0000-4000-8000-200000000001" className="btn-primary w-full text-base">
        <ChatIcon size={18} /> {contactLabel} (opens a demo chat)
      </Link>''')
    sub(p, 'import { startConversation } from "../../actions";', 'import { STATIC_IDS } from "@/preview/data";\nexport const dynamicParams = false;\nexport function generateStaticParams() {\n  return STATIC_IDS.listings.map((id) => ({ id }));\n}')
    for p, key in (("src/app/(site)/messages/[id]/page.tsx", "conversations"), ("src/app/(site)/sell/[id]/edit/page.tsx", "myListings")):
        sub(p, "\nexport default", f'\nimport {{ STATIC_IDS }} from "@/preview/data";\nexport const dynamicParams = false;\nexport function generateStaticParams() {{\n  return STATIC_IDS.{key}.map((id) => ({{ id }}));\n}}\n\nexport default')

    p = "src/app/(site)/account/notifications/page.tsx"
    sub(p, '''            <form action={markAllNotificationsRead}>
              <SubmitButton className="btn-secondary btn-sm" pendingText="Marking…">
                Mark all as read
              </SubmitButton>
            </form>''', '''            <button type="button" className="btn-secondary btn-sm" disabled title="Preview only">
              Mark all as read
            </button>''')
    sub(p, 'import { markAllNotificationsRead } from "../actions";\n', "")
    sub(p, 'import { SubmitButton } from "@/components/ui/form";\n', "")

    # Admin forms without server actions.
    sub("src/components/admin/AdminForm.tsx", "  action: (s: ActionState, f: FormData) => Promise<ActionState>;", "  action?: (s: ActionState, f: FormData) => Promise<ActionState>;")
    sub("src/components/admin/AdminForm.tsx", "  const [state, formAction, pending] = useActionState(action, null);", '  const [state, formAction, pending] = useActionState(action ?? (async () => ({ error: "Preview only: admin actions are disabled." })), null);')
    for p in glob.glob(str(APP / "src/app/(site)/admin/**/page.tsx"), recursive=True):
        rel = os.path.relpath(p, APP)
        resub(rel, r"<AdminForm( key=\{role\})? action=\{\w+\}", lambda m: "<AdminForm" + (m.group(1) or ""), required=False)
        resub(rel, r'import \{[^}]*\} from "\.\./actions";\n', "", required=False)
    sub("src/app/(site)/admin/inbox/page.tsx", '<form action={markContactHandled} className="mt-3">', '<form className="mt-3">')
    sub("src/app/(site)/admin/inbox/page.tsx", '<SubmitButton className="btn-secondary btn-sm">Mark handled</SubmitButton>', '<button type="button" disabled className="btn-secondary btn-sm">Mark handled</button>')
    sub("src/app/(site)/admin/inbox/page.tsx", 'import { SubmitButton } from "@/components/ui/form";\n', "")

    # "Log out" goes back to the preview's landing page.
    for p in ("src/app/(site)/account/page.tsx", "src/components/account/AccountNav.tsx", "src/components/layout/Header.tsx", "src/components/layout/MobileMenu.tsx"):
        sub(p, 'action="/auth/signout" method="post"', f'action="{BASE}/" method="get"')
    sub("src/app/(site)/account/settings/page.tsx", '<a href="/privacy" className="link">', f'<a href="{BASE}/privacy/" className="link">')

    # Search suggestions from the demo data (no /api/suggest on a static host).
    p = "src/components/layout/HeaderSearch.tsx"
    sub(p, '''    const ctl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/suggest?q=${encodeURIComponent(term)}`, { signal: ctl.signal })
        .then((r) => (r.ok ? r.json() : { suggestions: [] }))
        .then((d) => setSuggestions(d.suggestions ?? []))
        .catch(() => {});
    }, 180);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };''', '''    const t = setTimeout(() => {
      const q = term.toLowerCase();
      const cats = previewCategories
        .filter((c) => c.name.toLowerCase().includes(q))
        .slice(0, 2)
        .map((c) => ({ type: "category" as const, label: c.name, href: `/search/?category=${c.id}` }));
      const titles = previewListings
        .filter((l) => l.status === "active" && l.title.toLowerCase().includes(q))
        .slice(0, 6)
        .map((l) => ({ type: "listing" as const, label: l.title, href: `/search/?q=${encodeURIComponent(l.title)}` }));
      setSuggestions([...cats, ...titles]);
    }, 120);
    return () => clearTimeout(t);''')
    sub(p, 'import { SearchIcon } from "@/components/icons";', 'import { SearchIcon } from "@/components/icons";\nimport { categories as previewCategories, listings as previewListings } from "@/preview/data";')
    sub(p, "router.push(`/search${sp.size ? `?${sp}` : \"\"}`);", "router.push(`/search/${sp.size ? `?${sp}` : \"\"}`);")

    # A static host has no query string on the server: other pages use their default view.
    for p in glob.glob(str(APP / "src/app/**/*.tsx"), recursive=True):
        resub(os.path.relpath(p, APP), r"await searchParams", "({} as Awaited<typeof searchParams>)", required=False)
    resub("src/app/(site)/categories/page.tsx", r"\.then\(\(r\) =>", ".then((r: { count: number | null }) =>")

    # Preview-only visual fixes (not applied to the app).
    sub("src/app/globals.css", "  .btn {\n    display: inline-flex;", "  .btn,\n  .btn-primary,\n  .btn-secondary,\n  .btn-dark,\n  .btn-danger {\n    display: inline-flex;")
    sub("src/app/globals.css", '  .btn:disabled,\n  .btn[aria-disabled="true"] {', '  :is(.btn, .btn-primary, .btn-secondary, .btn-dark, .btn-danger):disabled,\n  :is(.btn, .btn-primary, .btn-secondary, .btn-dark, .btn-danger)[aria-disabled="true"] {')
    sub("src/components/layout/Header.tsx", 'text-xs font-bold lg:inline-flex"', 'text-xs font-bold whitespace-nowrap lg:inline-flex"')


def demo_images():
    script = APP / "scripts" / "demo-images.ts"
    script.write_text('''import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { COLORS, listings } from "../src/preview/data";
const esc = (s: string) => s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);
mkdirSync("public/demo", { recursive: true });
(async () => {
  for (const l of listings) {
    for (const img of l.images) {
      const lines: string[] = [];
      for (const w of l.title.split(" ")) {
        const last = lines.at(-1);
        if (last && (last + " " + w).length <= 18) lines[lines.length - 1] = last + " " + w;
        else lines.push(w);
      }
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><rect width="800" height="800" fill="${COLORS[l.category_id] ?? "#faf6eb"}"/><rect x="40" y="40" width="720" height="720" fill="none" stroke="#000" stroke-width="8"/><text x="400" y="150" font-family="monospace" font-size="44" font-weight="700" text-anchor="middle">DEMO PHOTO</text>${lines.map((t, i) => `<text x="400" y="${360 + i * 64}" font-family="sans-serif" font-size="54" font-weight="700" text-anchor="middle">${esc(t)}</text>`).join("")}<text x="400" y="700" font-family="monospace" font-size="30" text-anchor="middle">UI preview — not a real item</text></svg>`;
      await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(`public/${img.storage_path}`);
    }
  }
})();
''', encoding="utf-8")
    subprocess.run(["node", "--import", "tsx", "scripts/demo-images.ts"], cwd=APP, check=True)


def build():
    env = {k: v for k, v in os.environ.items() if not k.startswith(("NEXT_PUBLIC_SUPABASE", "SUPABASE_"))}
    subprocess.run(["npx", "tsc", "--noEmit", "-p", "."], cwd=APP, check=True)
    # next/font downloads Google Fonts; a transient failure is retried.
    for attempt in range(3):
        if subprocess.run(["npx", "next", "build"], cwd=APP, env=env).returncode == 0:
            return
        print(f"build-preview: next build failed (attempt {attempt + 1}), retrying")
    sys.exit("build-preview: next build failed")


def package():
    out = APP / "out"
    html = (out / "landing.html").read_text(encoding="utf-8")
    m = next(m for m in re.finditer(r"<script>(.*?)</script>", html, flags=re.S) if "var CAT" in m.group(1))
    js = m.group(1)
    for a, b in [
        ('"/search?"', f'"{BASE}/search/?"'),
        ('"/marketplace"', f'"{BASE}/marketplace/"'),
        ('go("/sell")', f'go("{BASE}/sell/")'),
        ('go("/login")', f'go("{BASE}/login/")'),
        ('go("/")', f'go("{BASE}/")'),
        ('Sell: "/sell"', f'Sell: "{BASE}/sell/"'),
        ('Search: "/search"', f'Search: "{BASE}/search/"'),
        ('Messages: "/messages"', f'Messages: "{BASE}/messages/"'),
        ('Profile: "/account"', f'Profile: "{BASE}/account/"'),
        ('Sold: "/account/listings?tab=sold"', f'Sold: "{BASE}/account/listings/"'),
        ('href="/account"', f'href="{BASE}/account/"'),
        ('href="/messages"', f'href="{BASE}/messages/"'),
        # No server behind the preview: skip the session check (button stays "Login").
        ('fetch("/api/session", { credentials: "same-origin" })', "Promise.resolve(null)"),
        ('fetch("/auth/signout", { method: "POST" })', "Promise.resolve()"),
    ]:
        if a not in js:
            sys.exit(f"build-preview: landing script changed, missing {a}")
        js = js.replace(a, b)
    if re.findall(r'"/(?!UniKart)[a-z]', js):
        sys.exit("build-preview: landing script has unprefixed links")
    html = html[: m.start(1)] + js + html[m.end(1):]
    html = html.replace('<body id="top">', '<body id="top"><div style="position:fixed;bottom:0;left:0;right:0;z-index:10002;background:#000;color:#ffe34d;font:700 12px/1.6 monospace;text-align:center;padding:4px 8px">UI PREVIEW — the marketplace behind these buttons uses demo data</div>', 1)
    (out / "index.html").write_text(html, encoding="utf-8")

    # Site layout for GitHub Pages: landing at the root, app under /preview/.
    shutil.rmtree(SITE, ignore_errors=True)
    SITE.mkdir(parents=True)
    # The site root also gets the connected landing page (its links point into /preview/).
    shutil.copy(out / "index.html", SITE / "index.html")
    shutil.copytree(out, SITE / "preview")
    (SITE / ".nojekyll").write_text("")  # keep _next/ (Jekyll drops underscore folders)
    print(f"build-preview: site ready in {SITE.relative_to(ROOT)} ({sum(1 for _ in SITE.rglob('*'))} files)")


if __name__ == "__main__":
    copy_app()
    patch()
    demo_images()
    build()
    package()
