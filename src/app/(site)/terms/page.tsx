import { PageTitle } from "@/components/ui/EmptyState";

export const metadata = { title: "Terms (draft)" };

export default function TermsPage() {
  return (
    <div className="container-page max-w-3xl py-8">
      <PageTitle title="Terms of use — draft" />
      <p className="mb-6 rounded-md border-2 border-ink bg-butter p-3 text-sm">
        <strong>Draft for review.</strong> These terms have not been reviewed by a lawyer. They must be reviewed by qualified Indian
        legal counsel before UniKart is launched publicly.
      </p>
      <div className="card space-y-4 p-6 text-[15px] leading-relaxed">
        <p>UniKart is an independent student project that lets members of participating institutes list and find items. It is not operated or endorsed by NIT Sikkim or any other institute.</p>
        <p>You must give accurate information, use only your own account, and verify your institute membership honestly. One institute email may verify only one account.</p>
        <p>Sales and exchanges are agreements between the buyer and seller. UniKart is not a party to them, does not take payments, and does not guarantee items, members or outcomes.</p>
        <p>You must not list prohibited items (see Help &amp; Safety), mislead other members, harass anyone, or use UniKart for anything unlawful.</p>
        <p>Offers are a negotiation tool. An accepted offer reserves an item but is not a payment and does not by itself create an obligation to buy or sell.</p>
        <p>Moderators may remove content and suspend accounts that break these rules. Decisions are logged and can be appealed through the contact page.</p>
        <p>You can delete your account at any time from Settings.</p>
      </div>
    </div>
  );
}
