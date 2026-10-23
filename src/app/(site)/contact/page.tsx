import { ContactForm } from "@/components/ContactForm";
import { PageTitle } from "@/components/ui/EmptyState";

export const metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <div className="container-page max-w-3xl py-8">
      <PageTitle title="Contact UniKart" subtitle="Questions, feedback or a problem with a listing? Send us a message." />
      <div className="grid gap-6 md:grid-cols-[1fr_240px]">
        <ContactForm />
        <aside className="card h-fit space-y-2 p-5 text-sm">
          <h2 className="font-bold">Other ways to reach us</h2>
          {/* Same contact details as the landing page footer. */}
          <p>
            Email: <a className="link break-all" href="mailto:b250002@nitsikkim.ac.in">b250002@nitsikkim.ac.in</a>
          </p>
          <p>
            Phone: <a className="link" href="tel:+917006032455">7006032455</a>
          </p>
          <p className="text-xs text-muted">To report a listing or a member, use the Report buttons so moderators get the details.</p>
        </aside>
      </div>
    </div>
  );
}
