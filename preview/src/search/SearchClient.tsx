"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ProductCard, ProductGrid } from "@/components/product/ProductCard";
import { Filters, SortSelect } from "@/components/search/Filters";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { conditionLabel, PAGE_SIZE } from "@/lib/constants";
import { toPrefixQuery } from "@/lib/search-query";
import { listings, saved_listings } from "@/preview/data";
import type { ListingCard } from "@/lib/types";

const matches = (l: (typeof listings)[number], tsq: string) => {
  const words = [l.title, l.description, l.category_id].join(" ").toLowerCase().split(/[^\p{L}\p{N}]+/u);
  return tsq
    .split("&")
    .map((t) => t.trim().replace(/:\*$/, ""))
    .filter(Boolean)
    .every((t) => words.some((w) => w.startsWith(t)));
};

export function SearchClient({ categories, instituteName }: { categories: { id: string; name: string }[]; instituteName: string }) {
  const params = useSearchParams();
  const sp = Object.fromEntries(params.entries()) as Record<string, string>;
  const statuses = sp.availability === "all" ? ["active", "reserved", "sold"] : ["active"];
  const tsq = sp.q ? toPrefixQuery(sp.q) : "";
  const conds = (sp.condition ?? "").split(",").filter(Boolean);
  let rows = listings.filter(
    (l) =>
      l.kind === "sale" &&
      statuses.includes(l.status) &&
      (!tsq || matches(l, tsq)) &&
      (!sp.category || l.category_id === sp.category) &&
      (!sp.min || (l.price_paise ?? 0) >= Number(sp.min) * 100) &&
      (!sp.max || (l.price_paise ?? 0) <= Number(sp.max) * 100) &&
      (!conds.length || conds.includes(l.condition ?? "")) &&
      (sp.type !== "free" || l.price_paise === 0) &&
      (sp.type !== "offers" || l.listing_type === "fixed_offers") &&
      (sp.type !== "fixed" || (l.listing_type === "fixed" && (l.price_paise ?? 0) > 0)),
  );
  if (sp.sort === "price_asc") rows = [...rows].sort((a, b) => (a.price_paise ?? 0) - (b.price_paise ?? 0));
  else if (sp.sort === "price_desc") rows = [...rows].sort((a, b) => (b.price_paise ?? 0) - (a.price_paise ?? 0));
  else rows = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const shown = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) as unknown as ListingCard[];
  const saved = new Set(saved_listings.map((s) => s.listing_id));
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
      if (!v || k === "page" || k === key || (key === "price" && (k === "min" || k === "max"))) return;
      next.set(k, v);
    });
    return `/search/${next.size ? `?${next}` : ""}`;
  };

  return (
    <div className="container-page py-6">
      <div className="lg:flex lg:gap-8">
        <Filters categories={categories} total={rows.length} />
        <div className="min-w-0 flex-1">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-xl font-extrabold sm:text-2xl">{heading}</h1>
              <p className="text-sm text-muted" aria-live="polite">
                {rows.length} {rows.length === 1 ? "item" : "items"} in {instituteName}
              </p>
            </div>
            <SortSelect />
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
          {shown.length === 0 ? (
            <EmptyState
              icon="🔍"
              title={page > pages ? "No more results" : "No items match your search"}
              action={
                <Link href="/search/" className="btn-secondary">
                  Clear search
                </Link>
              }
            >
              Try fewer words, check the spelling, or remove some filters.
            </EmptyState>
          ) : (
            <ProductGrid>
              {shown.map((l) => (
                <ProductCard key={l.id} listing={l} saved={saved.has(l.id)} signedIn instituteName={instituteName} />
              ))}
            </ProductGrid>
          )}
          <Pagination page={page} pages={pages} basePath="/search/" params={sp} />
        </div>
      </div>
    </div>
  );
}
