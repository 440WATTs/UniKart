import Link from "next/link";
import { CheckBadge } from "@/components/icons";
import { accountTypeLabel } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { getInstitute, getUnreadCounts, requireViewer } from "@/lib/session";

export const metadata = { title: "Your account" };

export default async function AccountPage() {
  const viewer = await requireViewer("/account");
  const p = viewer.profile;
  const institute = await getInstitute(viewer.membership?.institute_id);
  const supabase = await createClient();
  const count = (q: PromiseLike<{ count: number | null }>) => q.then((r) => r.count ?? 0);
  const [active, sold, saved, unread] = await Promise.all([
    count(supabase.from("listings").select("id", { count: "exact", head: true }).eq("seller_id", viewer.id).in("status", ["active", "reserved"])),
    count(supabase.from("listings").select("id", { count: "exact", head: true }).eq("seller_id", viewer.id).eq("status", "sold")),
    count(supabase.from("saved_listings").select("listing_id", { count: "exact", head: true }).eq("user_id", viewer.id)),
    getUnreadCounts(viewer.id),
  ]);
  const status = viewer.membership?.status;

  const tiles = [
    ["/account/listings", "My Listings", `${active} active`],
    ["/saved", "Saved Items", `${saved} saved`],
    ["/messages", "Messages", unread.messages ? `${unread.messages} unread` : "Your chats"],
    ["/account/listings?tab=sold", "Sold Items", `${sold} sold`],
    ["/account/profile", "Profile Information", "Name, department, year"],
    ["/account/institute", "Institute Verification", status ? status[0].toUpperCase() + status.slice(1) : "Not started"],
    ["/account/notifications", "Notifications", unread.notifications ? `${unread.notifications} unread` : "All caught up"],
    ["/account/settings", "Settings", "Password, blocks, account"],
    ["/help", "Help and Safety", "Trading safely"],
  ];

  return (
    <div>
      <section className="overflow-hidden rounded-lg border-2 border-ink bg-white shadow-hard" aria-label="Profile summary">
        <div className="bg-sky px-5 py-6 sm:px-6">
          <h1 className="font-display text-2xl font-extrabold tracking-tight uppercase sm:text-3xl">{p?.full_name || p?.display_name || "Your name"}</h1>
          <p className="mt-0.5 font-semibold">{accountTypeLabel(p?.account_type)}</p>
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-white px-3 py-1 text-sm font-bold">
            {viewer.isVerified ? (
              <>
                <CheckBadge size={16} /> {institute?.display_name} — Verified Member
              </>
            ) : status === "pending" ? (
              <>{institute?.display_name} — Verification pending</>
            ) : (
              <>Not yet verified</>
            )}
          </p>
        </div>
        <dl className="grid gap-x-6 gap-y-2 px-5 py-4 text-sm sm:grid-cols-2 sm:px-6">
          {p?.department && (
            <div>
              <dt className="text-muted">Department</dt>
              <dd className="font-medium">{p.department}</dd>
            </div>
          )}
          {p?.academic_year && (
            <div>
              <dt className="text-muted">Year</dt>
              <dd className="font-medium">{p.academic_year}</dd>
            </div>
          )}
          {p?.designation && (
            <div>
              <dt className="text-muted">Designation</dt>
              <dd className="font-medium">{p.designation}</dd>
            </div>
          )}
          <div>
            <dt className="text-muted">Member since</dt>
            <dd className="font-medium">{formatDate(p?.created_at)}</dd>
          </div>
        </dl>
        {(!p?.account_type || !p?.department) && (
          <p className="border-t border-line bg-butter px-5 py-2 text-sm sm:px-6">
            Complete your <Link href="/account/profile" className="link">profile</Link> so buyers and sellers know who they&apos;re dealing with.
          </p>
        )}
        {viewer.isSuspended && (
          <p role="alert" className="border-t border-danger bg-danger-soft px-5 py-2 text-sm text-danger sm:px-6">
            Your account is suspended{p?.suspended_at ? ` since ${formatDate(p.suspended_at)}` : ""}. You can&apos;t publish or send messages.
          </p>
        )}
      </section>

      <ul className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
        {tiles.map(([href, label, sub]) => (
          <li key={href}>
            <Link href={href} className="block h-full rounded-lg border border-line bg-white p-4 hover:border-ink hover:bg-paper">
              <span className="block font-bold">{label}</span>
              <span className="text-sm text-muted">{sub}</span>
            </Link>
          </li>
        ))}
        <li>
          <form action="/auth/signout" method="post" className="h-full">
            <button type="submit" className="block h-full w-full rounded-lg border border-line bg-white p-4 text-left hover:border-ink hover:bg-paper">
              <span className="block font-bold">Log Out</span>
              <span className="text-sm text-muted">Sign out of this device</span>
            </button>
          </form>
        </li>
      </ul>
    </div>
  );
}
