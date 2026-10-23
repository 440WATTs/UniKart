import { Suspense } from "react";
import { getCategories } from "@/lib/listings";
import { getInstitute } from "@/lib/session";
import { SearchClient } from "./SearchClient";

export const metadata = { title: "Search" };

// PREVIEW ONLY: a static host can't read the query string on the server, so the
// preview filters the demo listings in the browser. The real app filters in Postgres.
export default async function SearchPage() {
  const [institute, categories] = await Promise.all([getInstitute(), getCategories()]);
  return (
    <Suspense fallback={<div className="container-page py-6">Loading…</div>}>
      <SearchClient categories={categories.map((c) => ({ id: c.id, name: c.name }))} instituteName={institute?.display_name ?? ""} />
    </Suspense>
  );
}
