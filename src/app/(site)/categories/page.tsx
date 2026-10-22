import Link from "next/link";
import { PageTitle } from "@/components/ui/EmptyState";
import { CATEGORY_ICON } from "@/lib/constants";
import { getCategories } from "@/lib/listings";
import { getInstitute } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const [categories, institute] = await Promise.all([getCategories(), getInstitute()]);
  const supabase = await createClient();
  // Real counts of available items per category.
  const counts = await Promise.all(
    categories.map((c) =>
      supabase
        .from("listings")
        .select("id", { count: "exact", head: true })
        .eq("institute_id", institute?.id ?? "")
        .eq("kind", "sale")
        .eq("status", "active")
        .eq("category_id", c.id)
        .then((r) => r.count ?? 0),
    ),
  );
  return (
    <div className="container-page py-8">
      <PageTitle title="Categories" subtitle={`Browse everything on the ${institute?.display_name ?? ""} marketplace.`} />
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {categories.map((c, i) => (
          <li key={c.id}>
            <Link href={`/search?category=${c.id}`} className="flex h-full items-center gap-4 rounded-lg border-2 border-ink bg-white p-4 hover:bg-butter">
              <span className="text-3xl" aria-hidden>
                {CATEGORY_ICON[c.id] ?? "📦"}
              </span>
              <span>
                <span className="block font-bold">{c.name}</span>
                <span className="text-xs text-muted">
                  {counts[i]} {counts[i] === 1 ? "item" : "items"} available
                </span>
              </span>
            </Link>
          </li>
        ))}
        <li>
          <Link href="/search?type=free" className="flex h-full items-center gap-4 rounded-lg border-2 border-ink bg-sun p-4 hover:bg-gold">
            <span className="text-3xl" aria-hidden>
              {CATEGORY_ICON.free}
            </span>
            <span className="font-bold">Free Items</span>
          </Link>
        </li>
        <li>
          <Link href="/wanted" className="flex h-full items-center gap-4 rounded-lg border-2 border-ink bg-sky p-4">
            <span className="text-3xl" aria-hidden>
              📣
            </span>
            <span className="font-bold">Wanted requests</span>
          </Link>
        </li>
      </ul>
    </div>
  );
}
