import Link from "next/link";
import { PageTitle } from "@/components/ui/EmptyState";

export const metadata = { title: "Help & Safety" };

const SECTIONS: { id: string; title: string; body: React.ReactNode }[] = [
  {
    id: "how",
    title: "How UniKart works",
    body: (
      <>
        <p>
          <strong>Buying:</strong> browse or search → open a listing → message the seller → agree a price (or send an offer) → meet
          on campus → check the item → pay the seller directly.
        </p>
        <p>
          <strong>Selling:</strong> verify your institute membership → add photos, a title, price and condition → preview → publish →
          answer messages → mark the item sold.
        </p>
        <p>UniKart does not handle payments, delivery or refunds. Deals are between the two members.</p>
      </>
    ),
  },
  {
    id: "safety",
    title: "Safe campus exchanges",
    body: (
      <ul className="list-disc space-y-1 pl-5">
        <li>Meet in a busy, public place on campus (library entrance, canteen, main gate) during the day.</li>
        <li>Bring a friend for expensive items. Tell someone where you&apos;re going.</li>
        <li>Inspect and test the item before paying. For electronics, check it powers on and matches the photos.</li>
        <li>Pay only when you have the item in hand. Prefer UPI or cash at the meeting, never in advance.</li>
        <li>Don&apos;t invite people to your hostel room or share your room number publicly.</li>
      </ul>
    ),
  },
  {
    id: "scams",
    title: "Avoiding scams",
    body: (
      <ul className="list-disc space-y-1 pl-5">
        <li>Never share OTPs, UPI PINs, passwords or bank details. UniKart staff will never ask for them.</li>
        <li>Be wary of prices that are far too low, urgent pressure, or requests to move to another app immediately.</li>
        <li>Never pay a “deposit” or “delivery fee” to reserve an item.</li>
        <li>Don&apos;t scan QR codes to “receive” money; receiving money never needs your PIN.</li>
      </ul>
    ),
  },
  {
    id: "prohibited",
    title: "Prohibited items",
    body: (
      <>
        <p>Don&apos;t list:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Alcohol, tobacco, vapes, drugs, medicines or anything requiring a prescription.</li>
          <li>Weapons, explosives, fireworks or hazardous chemicals.</li>
          <li>Stolen, counterfeit or pirated goods, including copied textbooks and software licences.</li>
          <li>Exam papers, assignments or academic-misconduct services.</li>
          <li>Animals, personal data, accounts, or anything illegal under Indian law or institute rules.</li>
          <li>Lotteries, raffles or paid lucky draws.</li>
        </ul>
        <p>Moderators may remove listings that break these rules.</p>
      </>
    ),
  },
  {
    id: "reporting",
    title: "Reporting abuse",
    body: (
      <p>
        Use <strong>Report listing</strong> on any product page, or <strong>Report this member</strong> in a chat. You can also block a
        member from the chat menu. Reports go to UniKart moderators. If you are in danger, contact campus security or call 112.
      </p>
    ),
  },
  {
    id: "verification",
    title: "What the verified badge means",
    body: (
      <p>
        A <strong>Verified Member</strong> badge means UniKart confirmed the person belongs to that institute, usually through their
        institute email. It is not a guarantee of honesty or of an item&apos;s quality, and it doesn&apos;t mean the institute endorses
        UniKart.
      </p>
    ),
  },
  {
    id: "offers",
    title: "Offers",
    body: (
      <p>
        On listings marked “offers accepted”, you can propose a lower price. The seller can accept, decline or counter. An accepted
        offer reserves the item while you arrange to meet; it is not a payment and not a binding contract. Offers expire after 48
        hours. UniKart does not run auctions.
      </p>
    ),
  },
  {
    id: "privacy",
    title: "Privacy",
    body: (
      <p>
        Your email address and phone number are never shown on listings. Use UniKart Messages for first contact and only share
        other details when you&apos;re comfortable. See the <Link href="/privacy" className="link">privacy notice</Link>.
      </p>
    ),
  },
  {
    id: "limits",
    title: "Platform limitations",
    body: (
      <p>
        UniKart is an independent student project, not a service of NIT Sikkim. It doesn&apos;t inspect items, guarantee
        transactions, handle payments or resolve disputes beyond removing content and suspending accounts that break the rules.
      </p>
    ),
  },
];

export default function HelpPage() {
  return (
    <div className="container-page max-w-3xl py-8">
      <PageTitle title="Help & Safety" subtitle="Everything you need to buy and sell safely on campus." />
      <nav aria-label="On this page" className="mb-6 flex flex-wrap gap-2">
        {SECTIONS.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="chip hover:border-ink">
            {s.title}
          </a>
        ))}
      </nav>
      <div className="space-y-4">
        {SECTIONS.map((s) => (
          <section key={s.id} id={s.id} className="card scroll-mt-32 space-y-2 p-5 text-[15px] leading-relaxed">
            <h2 className="font-display text-lg font-bold">{s.title}</h2>
            {s.body}
          </section>
        ))}
      </div>
      <p className="mt-6 text-sm">
        Still stuck? <Link href="/contact" className="link">Contact us</Link>.
      </p>
    </div>
  );
}
