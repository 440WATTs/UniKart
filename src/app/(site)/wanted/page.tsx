import Link from "next/link";
import { ProductCard, ProductGrid } from "@/components/product/ProductCard";
import { EmptyState, PageTitle } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { savedIdsFor, searchListings, type SearchParams } from "@/lib/listings";
import { getInstitute, getViewer } from "@/lib/session";

export const metadata = { title: "Wanted items" };

export default async function WantedPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const [viewer, institute] = await Promise.all([getViewer(), getInstitute()]);
  if (!institute) return null;
  const result = await searchListings(institute.id, { ...sp, kind: "wanted" });
  const saved = await savedIdsFor(viewer?.id, result.listings.map((l) => l.id));
  return (
    <div className="container-page py-8">
      <PageTitle
        title="Wanted on campus"
        subtitle="Things members are looking for. If you have one, open the request and contact the buyer."
        actions={
          <Link href="/sell?kind=wanted" className="btn-primary">
            Post a wanted request
          </Link>
        }
      />
      {result.listings.length ? (
        <ProductGrid>
          {result.listings.map((l) => (
            <ProductCard key={l.id} listing={l} saved={saved.has(l.id)} signedIn={Boolean(viewer)} instituteName={institute.display_name} />
          ))}
        </ProductGrid>
      ) : (
        <EmptyState icon="📣" title="No wanted requests yet">
          Looking for a textbook or a cycle? Post a request and sellers can reach you.
        </EmptyState>
      )}
      <Pagination page={result.page} pages={result.pages} basePath="/wanted" params={{ ...sp }} />
    </div>
  );
}
