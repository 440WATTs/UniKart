import Link from "next/link";
import { EmptyState, PageTitle } from "@/components/ui/EmptyState";
import { formatDateTime, formatPrice } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/session";
import type { Offer } from "@/lib/types";

export const metadata = { title: "Offers & deals" };

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-butter",
  accepted: "bg-ok-soft text-ok",
  completed: "bg-ok-soft text-ok",
  declined: "bg-danger-soft text-danger",
  countered: "bg-sky-soft",
  withdrawn: "bg-chrome",
  expired: "bg-chrome",
  cancelled: "bg-chrome",
};

export default async function OrdersPage() {
  const viewer = await requireViewer("/account/orders");
  const supabase = await createClient();
  const { data } = await supabase
    .from("offers")
    .select("*, listing:listings(id, title, price_paise, status)")
    .order("created_at", { ascending: false })
    .limit(100);
  const offers = (data as (Offer & { listing: { id: string; title: string; price_paise: number; status: string } | null })[] | null) ?? [];

  return (
    <div>
      <PageTitle
        title="Offers & deals"
        subtitle="A record of offers you've made and received. UniKart doesn't take payments: deals are completed in person."
      />
      {offers.length === 0 ? (
        <EmptyState icon="🤝" title="No offers yet">
          On listings that accept offers, use <strong>Make an offer</strong> to suggest a price.
        </EmptyState>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b-2 border-ink bg-paper text-xs uppercase">
              <tr>
                <th scope="col" className="px-3 py-2">Item</th>
                <th scope="col" className="px-3 py-2">Role</th>
                <th scope="col" className="px-3 py-2">Amount</th>
                <th scope="col" className="px-3 py-2">Status</th>
                <th scope="col" className="px-3 py-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {offers.map((o) => {
                const expired = o.status === "pending" && new Date(o.expires_at) < new Date();
                const status = expired ? "expired" : o.status;
                return (
                  <tr key={o.id} className="border-b border-line last:border-0">
                    <td className="px-3 py-2">
                      <Link href={`/messages/${o.conversation_id}`} className="link">
                        {o.listing?.title ?? "Listing unavailable"}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      {o.buyer_id === viewer.id ? "Buying" : "Selling"}
                      {o.made_by === viewer.id ? " · you offered" : ""}
                    </td>
                    <td className="px-3 py-2 font-semibold">
                      {formatPrice(o.amount_paise)}
                      {o.listing && <span className="block text-xs font-normal text-muted">asking {formatPrice(o.listing.price_paise)}</span>}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLE[status]}`}>{status}</span>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted">{formatDateTime(o.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
