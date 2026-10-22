import { AdminForm } from "@/components/admin/AdminForm";
import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/lib/types";
import { saveCategory } from "../actions";

export default async function CategoriesAdmin() {
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("*").order("sort_order");
  const rows = (data as Category[] | null) ?? [];
  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-extrabold">Categories</h1>
      <p className="mb-4 text-sm text-muted">Administrators only. Deactivating hides a category from menus; existing listings keep it.</p>
      <ul className="space-y-2">
        {rows.map((c) => (
          <li key={c.id} className="card p-3">
            <AdminForm action={saveCategory}>
              <input type="hidden" name="id" value={c.id} />
              <code className="w-28 text-xs">{c.id}</code>
              <label className="min-w-40 flex-1">
                <span className="sr-only">Name</span>
                <input name="name" defaultValue={c.name} className="input min-h-9 text-sm" />
              </label>
              <label className="w-24">
                <span className="sr-only">Sort order</span>
                <input name="sort_order" type="number" defaultValue={c.sort_order} className="input min-h-9 text-sm" />
              </label>
              <label className="flex items-center gap-1 text-sm">
                <input type="checkbox" name="is_active" defaultChecked={c.is_active} className="h-4 w-4 accent-black" /> Active
              </label>
              <button className="btn-secondary btn-sm">Save</button>
            </AdminForm>
          </li>
        ))}
      </ul>
      <h2 className="mt-8 mb-2 font-bold">Add category</h2>
      <div className="card p-3">
        <AdminForm action={saveCategory}>
          <input type="hidden" name="isNew" value="true" />
          <input name="id" placeholder="id (e.g. sports)" required className="input min-h-9 w-40 text-sm" aria-label="Category ID" />
          <input name="name" placeholder="Name" required className="input min-h-9 min-w-40 flex-1 text-sm" aria-label="Name" />
          <input name="sort_order" type="number" defaultValue={80} className="input min-h-9 w-24 text-sm" aria-label="Sort order" />
          <label className="flex items-center gap-1 text-sm">
            <input type="checkbox" name="is_active" defaultChecked className="h-4 w-4 accent-black" /> Active
          </label>
          <button className="btn-primary btn-sm">Add</button>
        </AdminForm>
      </div>
    </div>
  );
}
