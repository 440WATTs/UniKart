import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckBadge, ChatIcon, ShieldIcon } from "@/components/icons";
import { Gallery } from "@/components/product/Gallery";
import { OwnerActions } from "@/components/product/OwnerActions";
import { OfferButton, ReportButton } from "@/components/product/ProductActions";
import { ProductCard, ProductGrid } from "@/components/product/ProductCard";
import { SaveButton } from "@/components/product/SaveButton";
import { SubmitButton } from "@/components/ui/form";
import { accountTypeLabel, conditionLabel, STATUS_LABEL } from "@/lib/constants";
import { storageUrl } from "@/lib/env";
import { errorText } from "@/lib/errors";
import { formatDate, formatPrice, timeAgo } from "@/lib/format";
import { getCategories, getListing, recentListings, savedIdsFor } from "@/lib/listings";
import { getInstitute, getViewer } from "@/lib/session";
import { startConversation } from "../../actions";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const l = await getListing((await params).id);
  return { title: l?.title ?? "Listing not found" };
}

export default async function ProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const { error } = await searchParams;
  const [listing, viewer, categories] = await Promise.all([getListing(id), getViewer(), getCategories()]);
  if (!listing) notFound();
  const institute = await getInstitute(listing.institute_id);
  const isOwner = viewer?.id === listing.seller_id;
  const wanted = listing.kind === "wanted";
  const free = !wanted && listing.price_paise === 0;
  const available = listing.status === "active";
  const category = categories.find((c) => c.id === listing.category_id);
  const seller = listing.seller;
  const sellerVerified = seller?.verified_institute_id === listing.institute_id;
  const [saved, similar] = await Promise.all([
    savedIdsFor(viewer?.id, [listing.id]),
    available ? recentListings(listing.institute_id, { category: listing.category_id, excludeId: listing.id, limit: 5, kind: listing.kind }) : Promise.resolve([]),
  ]);
  const similarSaved = await savedIdsFor(viewer?.id, similar.map((s) => s.id));
  const images = listing.images.map((i) => ({ url: storageUrl("listing-images", i.storage_path) }));
  const offersOn = listing.listing_type === "fixed_offers" && available && !free && institute?.settings.offers_enabled !== false;

  const contactLabel = wanted ? "I have this — contact buyer" : "Message seller";
  let contact: React.ReactNode;
  if (isOwner) contact = null;
  else if (!viewer)
    contact = (
      <Link href={`/login?next=/product/${listing.id}`} className="btn-primary w-full">
        <ChatIcon size={18} /> Log in to {wanted ? "contact the buyer" : "message the seller"}
      </Link>
    );
  else if (!viewer.isVerified)
    contact = (
      <div className="rounded-md border-2 border-ink bg-butter p-3 text-sm">
        Only verified {institute?.display_name} members can contact {wanted ? "buyers" : "sellers"}.{" "}
        <Link href="/account/institute" className="link">
          Verify your membership
        </Link>
      </div>
    );
  else if (listing.status === "active" || listing.status === "reserved")
    contact = (
      <form action={startConversation}>
        <input type="hidden" name="listingId" value={listing.id} />
        <SubmitButton className="btn-primary w-full text-base" pendingText="Opening chat…">
          <ChatIcon size={18} /> {contactLabel}
        </SubmitButton>
      </form>
    );

  return (
    <div className="container-page py-6">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted">
        <ol className="flex flex-wrap gap-1">
          <li>
            <Link href="/marketplace" className="hover:underline">Marketplace</Link> /
          </li>
          {wanted ? (
            <li>
              <Link href="/wanted" className="hover:underline">Wanted</Link> /
            </li>
          ) : (
            category && (
              <li>
                <Link href={`/search?category=${category.id}`} className="hover:underline">{category.name}</Link> /
              </li>
            )
          )}
          <li aria-current="page" className="truncate text-ink">{listing.title}</li>
        </ol>
      </nav>

      {error && (
        <p role="alert" className="mb-4 rounded-md border-2 border-danger bg-danger-soft px-3 py-2 text-sm text-danger">
          {errorText(error)}
        </p>
      )}
      {listing.status !== "active" && (
        <p role="status" className={`mb-4 rounded-md border-2 border-ink px-3 py-2 text-sm font-semibold ${listing.status === "reserved" ? "bg-butter" : "bg-chrome"}`}>
          {listing.status === "sold" && (wanted ? "This request has been closed." : `This item was sold${listing.sold_at ? ` on ${formatDate(listing.sold_at)}` : ""}.`)}
          {listing.status === "reserved" && "This item is reserved for a buyer. It may become available again."}
          {listing.status === "draft" && "Draft — only you can see this listing."}
          {listing.status === "removed" && "This listing has been removed and is only visible to you."}
          {listing.status === "expired" && "This listing has expired."}
        </p>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <Gallery images={images} title={listing.title} />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {wanted && <span className="rounded bg-ink px-2 py-0.5 text-xs font-bold text-white">WANTED</span>}
              {listing.is_demo && <span className="badge-demo">Demo data — not a real item</span>}
              <span className="chip">{STATUS_LABEL[listing.status]}</span>
            </div>
            <h1 className="mt-2 font-display text-2xl leading-tight font-extrabold sm:text-3xl">{listing.title}</h1>
            <p className={`mt-3 text-3xl font-black ${free ? "text-ok" : ""}`}>
              {wanted ? (listing.price_paise ? `Budget ${formatPrice(listing.price_paise)}` : "Budget open") : formatPrice(listing.price_paise)}
            </p>
            {!wanted && !free && (
              <p className="mt-1 text-sm text-ink-soft">
                {listing.listing_type === "fixed_offers" ? "Fixed price · offers accepted" : listing.negotiable ? "Price negotiable" : "Fixed price"}
                {listing.original_price_paise ? ` · originally ${formatPrice(listing.original_price_paise)}` : ""}
              </p>
            )}
            <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              {!wanted && (
                <>
                  <dt className="text-muted">Condition</dt>
                  <dd className="font-medium">{conditionLabel(listing.condition)}</dd>
                </>
              )}
              <dt className="text-muted">Category</dt>
              <dd className="font-medium">{category?.name ?? listing.category_id}</dd>
              {listing.brand && (
                <>
                  <dt className="text-muted">Brand</dt>
                  <dd className="font-medium">{listing.brand}</dd>
                </>
              )}
              {listing.model && (
                <>
                  <dt className="text-muted">Model</dt>
                  <dd className="font-medium">{listing.model}</dd>
                </>
              )}
              {listing.purchase_date && (
                <>
                  <dt className="text-muted">Bought</dt>
                  <dd className="font-medium">{formatDate(listing.purchase_date)}</dd>
                </>
              )}
              <dt className="text-muted">Listed</dt>
              <dd className="font-medium">
                <time dateTime={listing.published_at ?? listing.created_at}>{timeAgo(listing.published_at ?? listing.created_at)}</time>
              </dd>
              <dt className="text-muted">Campus</dt>
              <dd className="font-medium">{institute?.display_name}</dd>
            </dl>
            <h2 className="mt-6 text-sm font-bold">Description</h2>
            <p className="mt-1 text-[15px] leading-relaxed whitespace-pre-line">{listing.description}</p>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="panel space-y-3 p-4">
            {isOwner ? (
              <>
                <p className="text-sm font-semibold">This is your listing.</p>
                <OwnerActions id={listing.id} status={listing.status} wanted={wanted} lockedByModerator={listing.removed_by_moderator} />
              </>
            ) : (
              <>
                {contact}
                {offersOn && viewer?.isVerified && <OfferButton listingId={listing.id} pricePaise={listing.price_paise ?? 0} title={listing.title} />}
                <div className="flex items-center gap-2">
                  <SaveButton listingId={listing.id} initialSaved={saved.has(listing.id)} signedIn={Boolean(viewer)} variant="button" />
                  {viewer && <ReportButton listingId={listing.id} />}
                </div>
              </>
            )}
          </div>

          <section className="card p-4" aria-labelledby="seller-h">
            <h2 id="seller-h" className="text-xs font-bold tracking-wide text-muted uppercase">
              {wanted ? "Requested by" : "Seller"}
            </h2>
            <div className="mt-2 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-ink bg-sky font-bold" aria-hidden>
                {(seller?.display_name || "M").slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold">{seller?.display_name || "Former member"}</p>
                <p className="text-xs text-muted">
                  {accountTypeLabel(seller?.account_type)}
                  {seller?.created_at ? ` · on UniMart since ${formatDate(seller.created_at)}` : ""}
                </p>
              </div>
            </div>
            {sellerVerified ? (
              <p className="badge-verified mt-3">
                <CheckBadge size={14} /> {institute?.display_name} — Verified Member
              </p>
            ) : seller?.is_demo ? (
              <p className="mt-3 text-xs text-muted">Demo account (not a real member)</p>
            ) : null}
            <p className="mt-2 text-xs text-muted">
              Verification confirms institute membership only. It is not a guarantee of honesty or of the item&apos;s quality.
            </p>
          </section>

          <section className="rounded-lg border-2 border-ink bg-sky-soft p-4 text-sm" aria-labelledby="safety-h">
            <h2 id="safety-h" className="flex items-center gap-2 font-bold">
              <ShieldIcon size={18} /> Trade safely
            </h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Keep the first conversation in UniMart Messages.</li>
              <li>Meet in a busy public spot on campus, in daylight.</li>
              <li>Check the item before you pay. Never pay in advance.</li>
              <li>Don&apos;t share passwords, OTPs or bank details.</li>
            </ul>
            <Link href="/help#safety" className="link mt-2 inline-block">
              More safety tips
            </Link>
          </section>
        </aside>
      </div>

      {similar.length > 0 && (
        <section className="mt-12" aria-labelledby="similar-h">
          <h2 id="similar-h" className="h-section mb-3">
            Similar {wanted ? "requests" : "items"}
          </h2>
          <ProductGrid>
            {similar.map((s) => (
              <ProductCard key={s.id} listing={s} saved={similarSaved.has(s.id)} signedIn={Boolean(viewer)} instituteName={institute?.display_name} />
            ))}
          </ProductGrid>
        </section>
      )}
    </div>
  );
}
