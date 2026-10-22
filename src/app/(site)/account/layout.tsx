import { AccountNav } from "@/components/account/AccountNav";
import { requireViewer } from "@/lib/session";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  await requireViewer("/account");
  return (
    <div className="container-page py-6 sm:py-8">
      <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-8">
        <AccountNav />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
