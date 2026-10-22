import Image from "next/image";
import Link from "next/link";
import { ImageIcon } from "@/components/icons";
import { OwnerActions } from "@/components/product/OwnerActions";
import { EmptyState, PageTitle } from "@/components/ui/EmptyState";
import { STATUS_LABEL } from "@/lib/constants";
import { storageUrl } from "@/lib/env";
import { formatDate, formatPrice } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/session";
import type { ListingStatus } from "@/lib/types";

export const metadata = { title: "My listings" };

const TABS = {
  active: { label: "Active", statuses: ["active", "reserved"] },
  drafts: { label: "Drafts", statuses: ["draft"] },
  sold: { label: "Sold", statuses: ["sold"] },
  removed: { label: "Removed", statuses: ["removed", "expired"] },
} as const;

type Row = {
  id: string;
  title: string;
  kind: string;
  price_paise: number | null;
  status: ListingStatus;
  removed_by_moderator: boolean;
  created_at: string;
  published_at: string | null;
  images: { storage_path: string; position: number }[];
};

export default async function MyListingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const viewer = await requireViewer("/account/listings");
  const { tab: t } = await searchParams;
  const tab = (t && t in TABS ? t : "active") as keyof typeof TABS;
  const supabase = await createClient();
  const { data } = await supabase
    .from("listings")
    .select("id, title, kind, price_paise, status, removed_by_moderator, created_at, published_at, images:listing_images(storage_path, position)")
    .eq("seller_id", viewer.id)
    .in("status", [...TABS[tab].statuses])
    .order("created_at", { ascending: false })
    .limit(100);
  const rows = (data as Row[] | null) ?? [];
  const { data: stats } = rows.length ? await supabase.rpc("my_listing_stats", { p_ids: rows.map((r) => r.id) }) : { data: [] };
  const statMap = new Map(((stats as { listing_id: string; saves: number; conversations: number }[] | null) ?? []).map((s) => [s.listing_id, s]));

  return (
    <div>
      <PageTitle
        title="My listings"
        actions={
          <Link href="/sell" className="btn-primary">
            + New listing
          </Link>
        }
      />
      <nav aria-label="Listing status" className="mb-4 flex gap-1 overflow-x-auto border-b-2 border-ink">
        {Object.entries(TABS).map(([k, v]) => (
          <Link
            key={k}
            href={`/account/listings?tab=${k}`}
            aria-current={tab === k ? "page" : undefined}
            className={`-mb-0.5 shrink-0 rounded-t-md border-2 px-4 py-2 text-sm font-semibold ${tab === k ? "border-ink border-b-paper bg-paper" : "border-transparent text-muted hover:text-ink"}`}
          >
            {v.label}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <EmptyState icon="🏷️" title={`No ${TABS[tab].label.toLowerCase()} listings`} action={tab === "active" ? <Link href="/sell" className="btn-primary">Sell something</Link> : undefined}>
          {tab === "active" ? "Items you publish appear here." : null}
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const img = r.images.sort((a, b) => a.position - b.position)[0];
            const s = statMap.get(r.id);
            return (
              <li key={r.id} className="card flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
                <Link href={`/product/${r.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded border border-line bg-paper">
                    {img ? <Image src={storageUrl("listing-images", img.storage_path)} alt="" fill sizes="80px" className="object-cover" /> : <ImageIcon className="m-7 text-muted" />}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{r.title}</p>
                    <p className="text-sm font-bold">{r.kind === "wanted" ? `Wanted · ${r.price_paise ? formatPrice(r.price_paise) : "budget open"}` : formatPrice(r.price_paise)}</p>
                    <p className="text-xs text-muted">
                      <span className="chip mr-1.5 py-0">{STATUS_LABEL[r.status]}</span>
                      Posted {formatDate(r.published_at ?? r.created_at)}
                      {s ? ` · ${s.saves} saves · ${s.conversations} chats` : ""}
                    </p>
                  </div>
                </Link>
                <OwnerActions id={r.id} status={r.status} wanted={r.kind === "wanted"} lockedByModerator={r.removed_by_moderator} compact />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
