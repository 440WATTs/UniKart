import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function AdminOverview() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_metrics");
  const m = (data as Record<string, number> | null) ?? {};
  const tiles: [string, string, string?][] = [
    ["users", "Registered users"],
    ["verified_members", "Verified members"],
    ["pending_memberships", "Pending verifications", "/admin/memberships"],
    ["active_listings", "Active listings (real)", "/admin/listings"],
    ["sold_listings", "Sold listings (real)"],
    ["demo_listings", "Demo listings"],
    ["open_reports", "Open reports", "/admin/reports"],
    ["conversations", "Conversations"],
    ["messages_7d", "Messages, last 7 days"],
  ];
  return (
    <div>
      <h1 className="mb-4 font-display text-2xl font-extrabold">Overview</h1>
      {error && <p className="text-danger">Could not load metrics.</p>}
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {tiles.map(([k, label, href]) => {
          const inner = (
            <>
              <span className="block text-3xl font-black">{m[k] ?? 0}</span>
              <span className="text-sm text-muted">{label}</span>
            </>
          );
          return (
            <li key={k} className="card p-4">
              {href ? (
                <Link href={href} className="block hover:underline">
                  {inner}
                </Link>
              ) : (
                inner
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-xs text-muted">All figures are counted directly from the database. Demo data is excluded from real counts.</p>
    </div>
  );
}
