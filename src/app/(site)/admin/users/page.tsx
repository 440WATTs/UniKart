import { AdminForm } from "@/components/admin/AdminForm";
import { accountTypeLabel } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/session";
import { setRole, setSuspension } from "../actions";

export default async function UsersAdmin({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const viewer = await requireViewer("/admin/users");
  const supabase = await createClient();
  // Staff-only function: members can't read suspension state directly (audit M3).
  const { data, error } = await supabase.rpc("admin_list_users", { p_query: q.trim() || null, p_limit: 100 });
  const rows = (data ?? []) as {
    id: string;
    full_name: string;
    display_name: string;
    account_type: string | null;
    verified_institute_id: string | null;
    is_demo: boolean;
    suspended_at: string | null;
    created_at: string;
    roles: string[];
  }[];

  return (
    <div>
      <h1 className="mb-4 font-display text-2xl font-extrabold">Users</h1>
      <form className="mb-4 flex gap-2">
        <label className="flex-1">
          <span className="sr-only">Search by name</span>
          <input name="q" defaultValue={q} placeholder="Search by name" className="input min-h-10" />
        </label>
        <button className="btn-secondary">Search</button>
      </form>
      {error && <p role="alert" className="mb-3 text-sm text-danger">Could not load users.</p>}
      <ul className="space-y-2">
        {rows.map((u) => {
          const userRoles = u.roles ?? [];
          return (
            <li key={u.id} className="card space-y-2 p-3 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-semibold">
                    {u.full_name || u.display_name} {u.is_demo && <span className="badge-demo">Demo</span>}
                  </p>
                  <p className="text-xs text-muted">
                    {accountTypeLabel(u.account_type)} · {u.verified_institute_id ? `verified (${u.verified_institute_id})` : "not verified"} · joined{" "}
                    {formatDate(u.created_at)}
                    {userRoles.length ? ` · ${userRoles.join(", ")}` : ""}
                  </p>
                </div>
                {u.suspended_at && <span className="rounded bg-danger-soft px-2 py-0.5 text-xs font-bold text-danger">Suspended</span>}
              </div>
              {u.id !== viewer.id && (
                <div className="flex flex-wrap gap-2">
                  <AdminForm action={setSuspension} confirm={u.suspended_at ? "Lift this suspension?" : "Suspend this user and remove their listings?"}>
                    <input type="hidden" name="id" value={u.id} />
                    <input type="hidden" name="suspend" value={u.suspended_at ? "false" : "true"} />
                    {!u.suspended_at && <input name="reason" placeholder="Reason" className="input min-h-9 w-48 text-sm" />}
                    <button className={u.suspended_at ? "btn-secondary btn-sm" : "btn-danger btn-sm"}>{u.suspended_at ? "Unsuspend" : "Suspend"}</button>
                  </AdminForm>
                  {viewer.isAdmin &&
                    (["moderator", "admin"] as const).map((role) => (
                      <AdminForm key={role} action={setRole} confirm={`${userRoles.includes(role) ? "Remove" : "Grant"} ${role} role?`}>
                        <input type="hidden" name="id" value={u.id} />
                        <input type="hidden" name="role" value={role} />
                        <input type="hidden" name="grant" value={userRoles.includes(role) ? "false" : "true"} />
                        <button className="btn-secondary btn-sm">{userRoles.includes(role) ? `Remove ${role}` : `Make ${role}`}</button>
                      </AdminForm>
                    ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
