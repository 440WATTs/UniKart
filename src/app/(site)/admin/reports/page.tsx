import Link from "next/link";
import { AdminForm } from "@/components/admin/AdminForm";
import { REPORT_REASONS } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { moderateListing, resolveReport } from "../actions";

export default async function ReportsAdmin({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status = "open" } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("reports")
    .select(
      "*, listing:listings(id, title, status, removed_by_moderator), reporter:profiles!reports_reporter_id_fkey(display_name), reported:profiles!reports_reported_user_id_fkey(id, display_name)",
    )
    .eq("status", status)
    .order("created_at", { ascending: true })
    .limit(100);
  const rows = (data ?? []) as {
    id: string;
    reason: string;
    details: string | null;
    created_at: string;
    resolution_note: string | null;
    conversation_id: string | null;
    listing: { id: string; title: string; status: string; removed_by_moderator: boolean } | null;
    reporter: { display_name: string } | null;
    reported: { id: string; display_name: string } | null;
  }[];

  return (
    <div>
      <h1 className="mb-4 font-display text-2xl font-extrabold">Reports</h1>
      <nav className="mb-4 flex gap-2 text-sm">
        {["open", "actioned", "dismissed"].map((s) => (
          <a key={s} href={`?status=${s}`} className={`chip capitalize ${s === status ? "border-ink bg-sun" : ""}`}>
            {s}
          </a>
        ))}
      </nav>
      {rows.length === 0 && <p className="text-sm">No {status} reports.</p>}
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.id} className="card space-y-2 p-4 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <p className="font-bold">{REPORT_REASONS.find((x) => x.id === r.reason)?.label}</p>
              <p className="text-xs text-muted">
                by {r.reporter?.display_name ?? "former member"} · {formatDateTime(r.created_at)}
              </p>
            </div>
            {r.listing && (
              <p>
                Listing:{" "}
                <Link href={`/product/${r.listing.id}`} className="link">
                  {r.listing.title}
                </Link>{" "}
                ({r.listing.status})
              </p>
            )}
            {r.reported && (
              <p>
                Member: <Link href={`/admin/users?q=${encodeURIComponent(r.reported.display_name)}`} className="link">{r.reported.display_name}</Link>
                {r.conversation_id && " (reported from a conversation; message contents are private to participants)"}
              </p>
            )}
            {r.details && <p className="rounded bg-paper p-2">“{r.details}”</p>}
            {r.resolution_note && <p className="text-muted">Resolution: {r.resolution_note}</p>}
            {status === "open" && (
              <div className="flex flex-col gap-2 border-t border-line pt-3">
                {r.listing && !r.listing.removed_by_moderator && (
                  <AdminForm action={moderateListing} confirm="Remove this listing?">
                    <input type="hidden" name="id" value={r.listing.id} />
                    <input type="hidden" name="reportId" value={r.id} />
                    <input type="hidden" name="action" value="remove" />
                    <input name="reason" required placeholder="Reason shown to the seller" className="input min-h-9 min-w-48 flex-1 text-sm" />
                    <button className="btn-danger btn-sm">Remove listing</button>
                  </AdminForm>
                )}
                <AdminForm action={resolveReport}>
                  <input type="hidden" name="id" value={r.id} />
                  <input name="note" placeholder="Resolution note" className="input min-h-9 min-w-48 flex-1 text-sm" />
                  <button name="status" value="actioned" className="btn-primary btn-sm">
                    Mark actioned
                  </button>
                  <button name="status" value="dismissed" className="btn-secondary btn-sm">
                    Dismiss
                  </button>
                </AdminForm>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
