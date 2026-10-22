import Link from "next/link";
import { randomUUID } from "node:crypto";
import { ListingForm } from "@/components/sell/ListingForm";
import { PageTitle } from "@/components/ui/EmptyState";
import { getCategories } from "@/lib/listings";
import { getInstitute, requireViewer } from "@/lib/session";

export const metadata = { title: "Sell" };

export default async function SellPage({ searchParams }: { searchParams: Promise<{ kind?: string; title?: string }> }) {
  const sp = await searchParams;
  const kind = sp.kind === "wanted" ? "wanted" : "sale";
  const viewer = await requireViewer(`/sell${kind === "wanted" ? "?kind=wanted" : ""}`);
  const [institute, categories] = await Promise.all([getInstitute(viewer.membership?.institute_id), getCategories()]);

  if (!viewer.isVerified || !institute) {
    return (
      <div className="container-page max-w-2xl py-10">
        <div className="panel p-6">
          <h1 className="font-display text-2xl font-bold">{viewer.isSuspended ? "Your account is suspended" : "Verify your membership to sell"}</h1>
          <p className="mt-2 text-ink-soft">
            {viewer.isSuspended
              ? "Suspended accounts can't publish listings. Contact support if you think this is a mistake."
              : "UniMart listings are only published by verified members of your institute. It takes a minute with your institute email."}
          </p>
          {!viewer.isSuspended && (
            <Link href="/account/institute" className="btn-primary mt-5">
              Verify my membership
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="container-page max-w-3xl py-8">
      <PageTitle
        title={kind === "wanted" ? "Post a wanted request" : "Sell an item"}
        subtitle={
          <>
            Listing on the <strong>{institute.display_name}</strong> marketplace.{" "}
            {kind === "sale" ? (
              <Link href="/sell?kind=wanted" className="link">Looking to buy instead?</Link>
            ) : (
              <Link href="/sell" className="link">Selling something instead?</Link>
            )}
          </>
        }
      />
      <ListingForm
        userId={viewer.id}
        listingId={randomUUID()}
        kind={kind}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        offersEnabled={institute.settings.offers_enabled !== false}
        maxImages={institute.settings.max_images}
        initial={{ title: sp.title?.slice(0, 120) }}
        isEdit={false}
        instituteName={institute.display_name}
      />
    </div>
  );
}
