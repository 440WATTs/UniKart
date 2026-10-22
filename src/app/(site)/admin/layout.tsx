import Link from "next/link";
import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/session";

export const metadata = { title: "Admin" };

const LINKS = [
  ["/admin", "Overview"],
  ["/admin/memberships", "Memberships"],
  ["/admin/reports", "Reports"],
  ["/admin/listings", "Listings"],
  ["/admin/users", "Users"],
  ["/admin/categories", "Categories"],
  ["/admin/institutes", "Institutes"],
  ["/admin/inbox", "Contact inbox"],
  ["/admin/audit", "Audit log"],
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer("/admin");
  // Server-side role check from user_roles (not editable by users).
  if (!viewer.isStaff) notFound();
  return (
    <div className="container-page py-6">
      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-lg border-2 border-ink bg-ink p-2 text-white">
        <span className="px-2 font-pixel text-lg">UniMart Admin</span>
        <span className="rounded bg-sun px-2 py-0.5 text-xs font-bold text-ink">{viewer.isAdmin ? "Administrator" : "Moderator"}</span>
        <nav aria-label="Admin" className="flex w-full gap-1 overflow-x-auto md:w-auto">
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href} className="shrink-0 rounded px-2.5 py-1.5 text-sm font-semibold hover:bg-white hover:text-ink">
              {label}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}
