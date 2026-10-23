const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2, minimumFractionDigits: 0 });

/** Prices are stored as integer paise. */
export function formatPrice(paise: number | null | undefined) {
  if (paise == null) return "—";
  if (paise === 0) return "FREE";
  return inr.format(paise / 100);
}

/** Parses a rupee amount typed by a user ("1,200" / "450.50") into paise. */
export function rupeesToPaise(input: string | number | null | undefined): number | null {
  if (input == null) return null;
  const s = String(input).replace(/[,\s₹]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  return Number(whole) * 100 + Number((frac + "00").slice(0, 2));
}

export function paiseToRupeesInput(paise: number | null | undefined) {
  if (paise == null) return "";
  return paise % 100 === 0 ? String(paise / 100) : (paise / 100).toFixed(2);
}

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function timeAgo(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return "";
  const diff = (new Date(iso).getTime() - now) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return "just now";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  return formatDate(iso);
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

/**
 * Only allow same-site relative redirects (prevents open redirects after login).
 * Browsers strip tabs/newlines and treat "\\" as "/", so "/\t/evil.com" would
 * otherwise become "//evil.com": reject control characters and backslashes,
 * then resolve against a dummy origin and require it to be unchanged.
 */
export function safeNext(next: string | null | undefined, fallback = "/marketplace") {
  if (typeof next !== "string" || next.length === 0 || next.length > 512) return fallback;
  if (/[\u0000-\u001f\u007f\\]/.test(next)) return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  try {
    const base = "https://unikart.invalid";
    const url = new URL(next, base);
    if (url.origin !== base) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
