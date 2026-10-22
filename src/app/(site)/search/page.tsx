import Link from "next/link";
import { ProductCard, ProductGrid } from "@/components/product/ProductCard";
import { Filters, SortSelect } from "@/components/search/Filters";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { conditionLabel } from "@/lib/constants";
import { getCategories, savedIdsFor, searchListings, type SearchParams } from "@/lib/listings";
import { getInstitute, getViewer } from "@/lib/session";

export async function generateMetadata({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  return { title: sp.q ? `“${sp.q}”` : "Search" };
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const [viewer, institute, categories] = await Promise.all([getViewer(), getInstitute(), getCategories()]);
  if (!institute) return null;
  const result = await searchListings(institute.id, sp);
  const saved = await savedIdsFor(viewer?.id, result.listings.map((l) => l.id));
  const category = categories.find((c) => c.id === sp.category);

  const heading = sp.q ? `Results for “${sp.q}”` : sp.type === "free" ? "Free items" : (category?.name ?? "All listings");
  const chips: { label: string; key: string }[] = [];
  if (category && sp.q) chips.push({ label: category.name, key: "category" });
  if (sp.min || sp.max) chips.push({ label: `₹${sp.min || 0} – ${sp.max ? `₹${sp.max}` : "any"}`, key: "price" });
  if (sp.condition) chips.push({ label: sp.condition.split(",").map(conditionLabel).join(", "), key: "condition" });
  if (sp.type && sp.type !== "free") chips.push({ label: sp.type === "offers" ? "Accepts offers" : "Fixed price", key: "type" });
  if (sp.availability === "all") chips.push({ label: "Including sold", key: "availability" });

  const without = (key: string) => {
    const next = new URLSearchParams();
    Object.entries(sp).forEach(([k, v]) => {
      if (!v || k === "page") return;
      if (k === key || (key === "price" && (k === "min" || k === "max"))) return;
      next.set(k, v);
    });
    return `/search${next.size ? `?${next}` : ""}`;
  };

  return (
    <div className="container-page py-6">
      <div className="lg:flex lg:gap-8">
        <Filters categories={categories.map((c) => ({ id: c.id, name: c.name }))} total={result.total} />
        <div className="min-w-0 flex-1">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-xl font-extrabold sm:text-2xl">{heading}</h1>
              <p className="text-sm text-muted" aria-live="polite">
                {result.total} {result.total === 1 ? "item" : "items"} in {institute.display_name}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <SortSelect />
            </div>
          </div>
          {chips.length > 0 && (
            <ul className="mb-4 flex flex-wrap gap-2" aria-label="Active filters">
              {chips.map((c) => (
                <li key={c.key}>
                  <Link href={without(c.key)} className="chip hover:border-ink" aria-label={`Remove filter ${c.label}`}>
                    {c.label} <span aria-hidden>×</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {result.error ? (
            <EmptyState icon="⚠️" title="Search is unavailable right now">
              Please try again in a moment.
            </EmptyState>
          ) : result.outOfRange ? (
            <EmptyState icon="📄" title="No more results" action={<Link href={without("page")} className="btn-secondary">Back to page 1</Link>}>
              This page is past the end of the results.
            </EmptyState>
          ) : result.listings.length === 0 ? (
            <EmptyState
              icon="🔍"
              title="No items match your search"
              action={
                <>
                  <Link href="/search" className="btn-secondary">
                    Clear search
                  </Link>
                  <Link href={`/sell?kind=wanted${sp.q ? `&title=${encodeURIComponent(sp.q)}` : ""}`} className="btn-primary">
                    Post a wanted request
                  </Link>
                </>
              }
            >
              Try fewer words, check the spelling, or remove some filters. You can also tell sellers what you&apos;re looking for.
            </EmptyState>
          ) : (
            <ProductGrid>
              {result.listings.map((l, i) => (
                <ProductCard key={l.id} listing={l} saved={saved.has(l.id)} signedIn={Boolean(viewer)} instituteName={institute.display_name} priority={i < 4} />
              ))}
            </ProductGrid>
          )}
          <Pagination page={result.page} pages={result.pages} basePath="/search" params={{ ...sp }} />
        </div>
      </div>
    </div>
  );
}
