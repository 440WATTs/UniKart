import Link from "next/link";
import { AdminForm } from "@/components/admin/AdminForm";
import { STATUS_LABEL } from "@/lib/constants";
import { formatDate, formatPrice } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { moderateListing } from "../actions";

export default async function ListingsAdmin({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const { q = "", status = "" } = await searchParams;
  const supabase = await createClient();
  let query = supabase
    .from("listings")
    .select("id, title, status, kind, price_paise, is_demo, removed_by_moderator, created_at, seller:profiles!listings_seller_id_fkey(display_name)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (q) query = query.ilike("title", `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  if (status) query = query.eq("status", status);
  const { data } = await query;
  const rows = (data ?? []) as unknown as {
    id: string;
    title: string;
    status: string;
    kind: string;
    price_paise: number | null;
    is_demo: boolean;
    removed_by_moderator: boolean;
    created_at: string;
    seller: { display_name: string } | null;
  }[];
  return (
    <div>
      <h1 className="mb-4 font-display text-2xl font-extrabold">Listings</h1>
      <form className="mb-4 flex flex-wrap gap-2">
        <label className="flex-1">
          <span className="sr-only">Search titles</span>
          <input name="q" defaultValue={q} placeholder="Search titles" className="input min-h-10" />
        </label>
        <label>
          <span className="sr-only">Status</span>
          <select name="status" defaultValue={status} className="input min-h-10">
            <option value="">Any status</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <button className="btn-secondary">Filter</button>
      </form>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="card flex flex-col gap-2 p-3 text-sm lg:flex-row lg:items-center">
            <div className="min-w-0 flex-1">
              <Link href={`/product/${r.id}`} className="link font-semibold">
                {r.title}
              </Link>
              <p className="text-xs text-muted">
                {r.kind === "wanted" ? "Wanted" : formatPrice(r.price_paise)} · {STATUS_LABEL[r.status]}
                {r.removed_by_moderator ? " (by moderator)" : ""} · {r.seller?.display_name ?? "former member"} · {formatDate(r.created_at)}
                {r.is_demo && <span className="badge-demo ml-1">Demo</span>}
              </p>
            </div>
            <AdminForm action={moderateListing} confirm={r.removed_by_moderator ? "Restore this listing?" : "Remove this listing?"}>
              <input type="hidden" name="id" value={r.id} />
              <input type="hidden" name="action" value={r.removed_by_moderator ? "restore" : "remove"} />
              <input name="reason" required placeholder="Reason (sent to seller)" className="input min-h-9 w-56 text-sm" />
              <button className={r.removed_by_moderator ? "btn-secondary btn-sm" : "btn-danger btn-sm"}>{r.removed_by_moderator ? "Restore" : "Remove"}</button>
            </AdminForm>
          </li>
        ))}
      </ul>
    </div>
  );
}
