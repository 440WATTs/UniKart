import { PageTitle } from "@/components/ui/EmptyState";

export const metadata = { title: "Privacy (draft)" };

export default function PrivacyPage() {
  return (
    <div className="container-page max-w-3xl py-8">
      <PageTitle title="Privacy notice — draft" />
      <p className="mb-6 rounded-md border-2 border-ink bg-butter p-3 text-sm">
        <strong>Draft for review.</strong> This notice must be reviewed by qualified counsel (including against the Digital Personal
        Data Protection Act, 2023) before a public launch.
      </p>
      <div className="card space-y-4 p-6 text-[15px] leading-relaxed">
        <h2 className="font-bold">What we store</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Account: email address, name, and a password hash (handled by Supabase Auth) or your Google account identifier.</li>
          <li>Profile details you choose to add: display name, account type, department, year, designation, photo.</li>
          <li>Institute verification: your institute email address and verification status. Codes are stored only as hashes.</li>
          <li>Listings, photos, saved items, messages, offers, reports and notifications you create.</li>
          <li>Moderation and audit records needed to keep the platform safe.</li>
        </ul>
        <h2 className="font-bold">Who can see it</h2>
        <p>Listings, display names and verification badges are visible to visitors. Messages are visible only to the two people in the conversation (moderators see report details, not chat history). Your email addresses are never shown to other members.</p>
        <h2 className="font-bold">What we don&apos;t do</h2>
        <p>We don&apos;t sell personal data, track your precise location, or show ads. Recent searches stay in your browser.</p>
        <h2 className="font-bold">Your choices</h2>
        <p>Edit your profile any time, and delete your account from Settings. Some records (e.g. reports and moderation decisions) may be kept for safety and legal reasons.</p>
      </div>
    </div>
  );
}
