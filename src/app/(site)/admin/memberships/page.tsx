import { AdminForm } from "@/components/admin/AdminForm";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { reviewMembership } from "../actions";

export default async function MembershipsAdmin({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status = "pending" } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("institute_memberships")
    .select("*, user:profiles!institute_memberships_user_id_fkey(id, full_name, display_name, account_type, department, academic_year, designation)")
    .eq("status", status)
    .order("created_at", { ascending: true })
    .limit(100);
  const rows = (data ?? []) as {
    id: string;
    institute_id: string;
    status: string;
    method: string;
    institute_email: string | null;
    applicant_note: string | null;
    review_note: string | null;
    created_at: string;
    user: { full_name: string; display_name: string; account_type: string | null; department: string | null; academic_year: string | null; designation: string | null } | null;
  }[];
  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-extrabold">Institute memberships</h1>
      <p className="mb-4 text-sm text-muted">Approve only when you are confident the person belongs to the institute. Decisions are logged and the user is notified.</p>
      <nav className="mb-4 flex gap-2 text-sm">
        {["pending", "verified", "rejected", "revoked"].map((s) => (
          <a key={s} href={`?status=${s}`} className={`chip capitalize ${s === status ? "border-ink bg-sun" : ""}`}>
            {s}
          </a>
        ))}
      </nav>
      {rows.length === 0 && <p className="text-sm">Nothing here.</p>}
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.id} className="card p-4 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <div>
                <p className="font-bold">{r.user?.full_name || r.user?.display_name}</p>
                <p className="text-muted">
                  {[r.user?.account_type, r.user?.department, r.user?.academic_year, r.user?.designation].filter(Boolean).join(" · ") || "Profile incomplete"}
                </p>
              </div>
              <p className="text-right text-xs text-muted">
                {r.institute_id} · {r.method.replace("_", " ")}
                <br />
                {formatDateTime(r.created_at)}
              </p>
            </div>
            {r.institute_email && <p className="mt-2">Institute email: {r.institute_email}</p>}
            {r.applicant_note && <p className="mt-2 rounded bg-paper p-2">“{r.applicant_note}”</p>}
            {r.review_note && <p className="mt-2 text-muted">Review note: {r.review_note}</p>}
            <AdminForm action={reviewMembership} className="mt-3 flex flex-wrap items-end gap-2">
              <input type="hidden" name="id" value={r.id} />
              <label className="min-w-48 flex-1">
                <span className="sr-only">Note to the user</span>
                <input name="note" placeholder="Note (shown to the user)" className="input min-h-9 text-sm" />
              </label>
              {r.status !== "verified" && (
                <button name="decision" value="verified" className="btn-primary btn-sm">
                  Approve
                </button>
              )}
              {r.status === "pending" && (
                <button name="decision" value="rejected" className="btn-secondary btn-sm">
                  Reject
                </button>
              )}
              {r.status === "verified" && (
                <button name="decision" value="revoked" className="btn-danger btn-sm">
                  Revoke
                </button>
              )}
            </AdminForm>
          </li>
        ))}
      </ul>
    </div>
  );
}
