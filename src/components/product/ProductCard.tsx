import { ListingImage } from "@/components/product/ListingImage";
import Link from "next/link";
import { CheckBadge, ImageIcon } from "@/components/icons";
import { SaveButton } from "@/components/product/SaveButton";
import { conditionLabel, STATUS_LABEL } from "@/lib/constants";
import { storageUrl } from "@/lib/env";
import { formatPrice, timeAgo } from "@/lib/format";
import type { ListingCard } from "@/lib/types";

export function ProductCard({
  listing,
  saved,
  signedIn,
  instituteName,
  priority,
}: {
  listing: ListingCard;
  saved: boolean;
  signedIn: boolean;
  instituteName?: string;
  priority?: boolean;
}) {
  const img = listing.images[0];
  const wanted = listing.kind === "wanted";
  const free = !wanted && listing.price_paise === 0;
  const unavailable = listing.status === "sold" || listing.status === "reserved";
  const seller = listing.seller;
  const verified = seller?.verified_institute_id === listing.institute_id;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-lg border border-line bg-white transition-shadow hover:shadow-[0_4px_14px_rgb(0_0_0/0.12)]">
      <div className="relative aspect-square bg-paper">
        {img ? (
          <ListingImage
            src={storageUrl("listing-images", img.storage_path)}
            alt={listing.title}
            fill
            sizes="(min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className={`object-cover ${unavailable ? "opacity-60" : ""}`}
            priority={priority}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted">
            <ImageIcon size={36} />
            <span className="sr-only">No photo</span>
          </div>
        )}
        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
          {wanted && <span className="rounded bg-ink px-2 py-0.5 text-[11px] font-bold text-white">WANTED</span>}
          {free && <span className="rounded border-2 border-ink bg-sun px-2 py-0.5 text-[11px] font-black">FREE</span>}
          {unavailable && (
            <span className="rounded bg-ink px-2 py-0.5 text-[11px] font-bold text-white uppercase">{STATUS_LABEL[listing.status]}</span>
          )}
          {listing.is_demo && <span className="badge-demo">Demo</span>}
        </div>
        <div className="absolute top-2 right-2 z-10">
          <SaveButton listingId={listing.id} initialSaved={saved} signedIn={signedIn} />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className={`text-lg leading-tight font-extrabold ${free ? "text-ok" : ""}`}>
          {wanted ? (listing.price_paise ? `Budget ${formatPrice(listing.price_paise)}` : "Budget open") : formatPrice(listing.price_paise)}
        </p>
        <h3 className="line-clamp-2 text-sm leading-snug font-medium">
          {/* Stretched link: the whole card opens the product, the Save button sits above it. */}
          <Link href={`/product/${listing.id}`} className="after:absolute after:inset-0 after:content-['']">
            {listing.title}
          </Link>
        </h3>
        {!wanted && listing.condition && <p className="text-xs text-muted">{conditionLabel(listing.condition)}</p>}
        <div className="mt-auto flex flex-wrap items-center gap-x-1.5 gap-y-1 pt-1 text-xs text-muted">
          <span className="truncate font-medium text-ink-soft">{seller?.display_name || "Member"}</span>
          {verified && (
            <span className="badge-verified px-1.5 py-0 text-[10px]" title={`Verified ${instituteName ?? "institute"} member`}>
              <CheckBadge size={12} /> {instituteName ?? "Verified"}
            </span>
          )}
          <span aria-hidden>·</span>
          <time dateTime={listing.published_at ?? listing.created_at}>{timeAgo(listing.published_at ?? listing.created_at)}</time>
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">{children}</div>;
}
