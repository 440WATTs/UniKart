import Image from "next/image";
import Link from "next/link";
import { ImageIcon } from "@/components/icons";
import { SaveButton } from "@/components/product/SaveButton";
import { EmptyState, PageTitle } from "@/components/ui/EmptyState";
import { conditionLabel, STATUS_LABEL } from "@/lib/constants";
import { storageUrl } from "@/lib/env";
import { formatPrice } from "@/lib/format";
import { CARD_SELECT } from "@/lib/listings";
import { createClient } from "@/lib/supabase/server";
import { getInstitutes, requireViewer } from "@/lib/session";
import type { ListingCard } from "@/lib/types";

export const metadata = { title: "Saved items" };

export default async function SavedPage() {
  const viewer = await requireViewer("/saved");
  const supabase = await createClient();
  const [{ data }, institutes] = await Promise.all([
    supabase.from("saved_listings").select(`created_at, listing:listings(${CARD_SELECT})`).eq("user_id", viewer.id).order("created_at", { ascending: false }).limit(200),
    getInstitutes(),
  ]);
  const rows = ((data as unknown as { listing: ListingCard | null }[] | null) ?? []).map((r) => r.listing);
  const instName = (id: string) => institutes.find((i) => i.id === id)?.display_name ?? id;

  return (
    <div className="container-page py-8">
      <PageTitle title="Saved items" subtitle="Items you've saved, with their current price and availability." />
      {rows.length === 0 ? (
        <EmptyState icon="♡" title="Nothing saved yet" action={<Link href="/marketplace" className="btn-primary">Browse the marketplace</Link>}>
          Tap the heart on any listing to keep it here.
        </EmptyState>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {rows.map((l, i) => {
            // A listing can disappear (removed by its seller or a moderator).
            if (!l) {
              return (
                <li key={i} className="card p-4 text-sm text-muted">
                  This item is no longer available.
                </li>
              );
            }
            const img = l.images.sort((a, b) => a.position - b.position)[0];
            const available = l.status === "active";
            return (
              <li key={l.id} className="card flex gap-3 p-3">
                <Link href={`/product/${l.id}`} className="relative h-24 w-24 shrink-0 overflow-hidden rounded border border-line bg-paper">
                  {img ? <Image src={storageUrl("listing-images", img.storage_path)} alt={l.title} fill sizes="96px" className={`object-cover ${available ? "" : "opacity-50"}`} /> : <ImageIcon className="m-9 text-muted" />}
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <Link href={`/product/${l.id}`} className="truncate font-semibold hover:underline">
                    {l.title}
                  </Link>
                  <p className="font-extrabold">{l.kind === "wanted" ? "Wanted" : formatPrice(l.price_paise)}</p>
                  <p className="text-xs text-muted">
                    {l.condition && `${conditionLabel(l.condition)} · `}
                    {instName(l.institute_id)} ·{" "}
                    <span className={available ? "font-semibold text-ok" : "font-semibold text-danger"}>{STATUS_LABEL[l.status]}</span>
                  </p>
                  <div className="mt-auto flex items-center gap-2 pt-2">
                    {available && (
                      <Link href={`/product/${l.id}`} className="btn-primary btn-sm">
                        Contact seller
                      </Link>
                    )}
                    <SaveButton listingId={l.id} initialSaved signedIn />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
