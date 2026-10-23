import Link from "next/link";
import { ProductCard, ProductGrid } from "@/components/product/ProductCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { CATEGORY_ICON } from "@/lib/constants";
import { getCategories, recentListings, savedIdsFor } from "@/lib/listings";
import { getInstitute, getViewer } from "@/lib/session";
import type { ListingCard } from "@/lib/types";

export const metadata = { title: "Marketplace" };

function Section({ title, href, children }: { title: string; href?: string; children: React.ReactNode }) {
  return (
    <section className="mt-10" aria-labelledby={title.replace(/\W+/g, "-")}>
      <div className="mb-3 flex items-end justify-between gap-2">
        <h2 id={title.replace(/\W+/g, "-")} className="h-section">
          {title}
        </h2>
        {href && (
          <Link href={href} className="link text-sm">
            See all →
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export default async function MarketplacePage() {
  const [viewer, institute, categories] = await Promise.all([getViewer(), getInstitute(), getCategories()]);
  if (!institute) return <div className="container-page py-10">The marketplace is not configured yet.</div>;

  const [recent, free, wanted] = await Promise.all([
    recentListings(institute.id, { limit: 15 }),
    recentListings(institute.id, { limit: 5, free: true }),
    recentListings(institute.id, { limit: 5, kind: "wanted" }),
  ]);
  const all: ListingCard[] = [...recent, ...free, ...wanted];
  const saved = await savedIdsFor(viewer?.id, all.map((l) => l.id));
  const hasDemo = all.some((l) => l.is_demo);
  const card = (l: ListingCard, i = 9) => (
    <ProductCard key={l.id} listing={l} saved={saved.has(l.id)} signedIn={Boolean(viewer)} instituteName={institute.display_name} priority={i < 4} />
  );

  return (
    <div>
      {/* Sky hero band, as on the landing page. */}
      <section className="border-b-2 border-ink bg-sky">
        <div className="container-page flex flex-col gap-6 py-8 sm:py-10 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-pixel text-base font-bold tracking-wide sm:text-lg">{institute.display_name.toUpperCase()} MARKETPLACE</p>
            <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Buy and sell with your campus community.</h1>
            <p className="mt-2 max-w-xl text-ink-soft">Find what you need. Sell what you no longer use. Trade with people from your institute.</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link href="/sell" className="btn-primary px-6 text-base">
              Sell something
            </Link>
            <Link href="/sell?kind=wanted" className="btn-secondary">
              Post a wanted item
            </Link>
          </div>
        </div>
      </section>

      <div className="container-page">
        {viewer && !viewer.isVerified && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-ink bg-butter px-4 py-3 text-sm">
            <p>
              <strong>Verify your {institute.display_name} membership</strong> to sell, message sellers and make offers.
            </p>
            <Link href="/account/institute" className="btn-dark btn-sm">
              Get verified
            </Link>
          </div>
        )}
        {hasDemo && (
          <p className="mt-6 rounded-md border border-ochre bg-butter/60 px-3 py-2 text-xs">
            Items marked <span className="badge-demo">Demo</span> are sample data for development and are not real items for sale.
          </p>
        )}

        <nav aria-label="Shop by category" className="mt-8">
          <h2 className="sr-only">Shop by category</h2>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
            {[...categories.filter((c) => c.id !== "other"), { id: "free", name: "Free Items" }, ...categories.filter((c) => c.id === "other")].map((c) => (
              <li key={c.id}>
                <Link
                  href={c.id === "free" ? "/search?type=free" : `/search?category=${c.id}`}
                  className="flex h-full flex-col items-center gap-1.5 rounded-lg border border-line bg-white px-2 py-3 text-center text-xs font-semibold hover:border-ink hover:bg-butter sm:text-sm"
                >
                  <span className="text-2xl" aria-hidden>
                    {CATEGORY_ICON[c.id] ?? "📦"}
                  </span>
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <Section title="Recently listed" href="/search">
          {recent.length ? (
            <ProductGrid>{recent.map((l, i) => card(l, i))}</ProductGrid>
          ) : (
            <EmptyState
              title="No listings yet"
              action={
                <Link href="/sell" className="btn-primary">
                  List the first item
                </Link>
              }
            >
              Be the first to list something on the {institute.display_name} marketplace.
            </EmptyState>
          )}
        </Section>

        {free.length > 0 && (
          <Section title="Free on campus" href="/search?type=free">
            <ProductGrid>{free.map((l) => card(l))}</ProductGrid>
          </Section>
        )}

        <Section title="Wanted on campus" href="/wanted">
          {wanted.length ? (
            <ProductGrid>{wanted.map((l) => card(l))}</ProductGrid>
          ) : (
            <p className="rounded-lg border border-line bg-white p-4 text-sm text-ink-soft">
              Looking for something nobody has listed?{" "}
              <Link href="/sell?kind=wanted" className="link">
                Post a wanted request
              </Link>{" "}
              and let sellers find you.
            </p>
          )}
        </Section>

        {/* Non-functional preview: no cross-campus inventory exists yet. */}
        <section className="mt-12 overflow-hidden rounded-lg border-2 border-ink bg-paper shadow-hard" aria-labelledby="coming-soon">
          <div className="border-b-2 border-ink bg-chrome py-1 text-center font-mono text-sm font-bold">UniKart</div>
          <div className="grid gap-4 p-6 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <h2 id="coming-soon" className="font-pixel text-xl font-bold">
                OTHER CAMPUSES — COMING SOON
              </h2>
              <p className="mt-1 text-sm text-ink-soft">
                Find great products from students at other institutes. Cross-campus discovery is coming soon. Your{" "}
                {institute.display_name} marketplace will always come first.
              </p>
            </div>
            <ul className="flex gap-2 text-xs font-semibold" aria-label="Preview of future views">
              <li className="rounded-full border-2 border-ink bg-sky px-3 py-1">My Campus</li>
              <li className="rounded-full border-2 border-dashed border-ink/40 px-3 py-1 text-muted">Nearby</li>
              <li className="rounded-full border-2 border-dashed border-ink/40 px-3 py-1 text-muted">All institutes</li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
