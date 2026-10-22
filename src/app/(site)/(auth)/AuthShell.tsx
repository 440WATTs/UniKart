import type { ReactNode } from "react";
import { env } from "@/lib/env";
import { signInWithGoogle } from "./actions";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <div className="bg-sky/40">
      <div className="container-page flex justify-center py-10 sm:py-14">
        <div className="w-full max-w-md overflow-hidden rounded-lg border-2 border-ink bg-paper shadow-hard">
          {/* Title bar echoes the landing page's window chrome. */}
          <div className="border-b-2 border-ink bg-chrome py-1 text-center font-mono text-sm font-bold">UniMart</div>
          <div className="p-6 sm:p-8">
            <h1 className="font-display text-2xl font-bold">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>}
            <div className="mt-6">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function GoogleButton({ next }: { next: string }) {
  if (!env.googleAuthEnabled) {
    return (
      <div className="rounded-md border-2 border-dashed border-ink/40 bg-white p-3 text-center text-sm text-muted">
        <button type="button" className="btn-secondary w-full" disabled aria-describedby="google-off">
          <GoogleMark /> Continue with Google
        </button>
        <p id="google-off" className="mt-2 text-xs">
          Google sign-in has not been set up for this site yet (see docs/SETUP.md). Use email for now.
        </p>
      </div>
    );
  }
  return (
    <form action={signInWithGoogle}>
      <input type="hidden" name="next" value={next} />
      <button type="submit" className="btn-secondary w-full">
        <GoogleMark /> Continue with Google
      </button>
    </form>
  );
}

export function OrDivider() {
  return (
    <div className="my-5 flex items-center gap-3 text-xs font-semibold text-muted uppercase">
      <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
