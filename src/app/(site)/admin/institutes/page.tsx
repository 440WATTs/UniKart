import { AdminForm } from "@/components/admin/AdminForm";
import { createClient } from "@/lib/supabase/server";
import type { Institute } from "@/lib/types";
import { saveInstitute } from "../actions";

export default async function InstitutesAdmin() {
  const supabase = await createClient();
  const { data } = await supabase.from("institutes").select("*").order("display_name");
  const rows = (data as Institute[] | null) ?? [];
  const check = "flex items-center gap-2 text-sm";
  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-extrabold">Institutes</h1>
      <p className="mb-4 text-sm text-muted">
        Administrators only. Confirm official email domains with the institute before ticking “confirmed”: until then,
        email verification stays off and members are verified by manual review. New institutes are added with a database
        migration (see docs/INSTITUTES.md) and switched on here.
      </p>
      {rows.map((i) => (
        <section key={i.id} className="card mb-4 p-4">
          <h2 className="mb-3 font-bold">
            {i.display_name} <code className="text-xs text-muted">{i.id}</code>
          </h2>
          <AdminForm action={saveInstitute} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="id" value={i.id} />
            <label className="text-sm">
              <span className="field-label">Display name</span>
              <input name="display_name" defaultValue={i.display_name} className="input min-h-10" />
            </label>
            <label className="text-sm">
              <span className="field-label">Official name</span>
              <input name="official_name" defaultValue={i.official_name} className="input min-h-10" />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="field-label">Accepted email domains (comma separated)</span>
              <input name="email_domains" defaultValue={i.email_domains.join(", ")} className="input min-h-10" />
            </label>
            <div className="space-y-1.5 sm:col-span-2">
              <label className={check}>
                <input type="checkbox" name="email_domains_confirmed" defaultChecked={i.email_domains_confirmed} className="h-4 w-4 accent-black" />
                Email domains confirmed as official (enables email verification)
              </label>
              <label className={check}>
                <input type="checkbox" name="allow_manual_review" defaultChecked={i.allow_manual_review} className="h-4 w-4 accent-black" />
                Allow manual review requests
              </label>
              <label className={check}>
                <input type="checkbox" name="is_active" defaultChecked={i.is_active} className="h-4 w-4 accent-black" />
                Marketplace active
              </label>
              <label className={check}>
                <input type="checkbox" name="offers_enabled" defaultChecked={i.settings.offers_enabled !== false} className="h-4 w-4 accent-black" />
                Offers enabled
              </label>
              <label className={check}>
                <input type="checkbox" name="public_browse" defaultChecked={i.settings.public_browse !== false} className="h-4 w-4 accent-black" />
                Logged-out visitors can browse listings
              </label>
            </div>
            <div>
              <button className="btn-primary btn-sm">Save institute</button>
            </div>
          </AdminForm>
        </section>
      ))}
    </div>
  );
}
