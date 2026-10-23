import { DeleteAccountForm, PasswordForm } from "@/components/account/AccountForms";
import { BlockList } from "@/components/account/BlockList";
import { PageTitle } from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/session";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const viewer = await requireViewer("/account/settings");
  const supabase = await createClient();
  const [{ data: user }, { data: blocks }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("blocks").select("blocked_id, created_at, blocked:profiles!blocks_blocked_id_fkey(display_name)").eq("blocker_id", viewer.id),
  ]);
  const providers = (user.user?.app_metadata?.providers as string[] | undefined) ?? [];

  return (
    <div className="space-y-6">
      <PageTitle title="Settings" />
      <section className="card space-y-2 p-5 text-sm">
        <h2 className="font-bold">Sign-in</h2>
        <p>
          Account email: <strong>{viewer.email}</strong>
        </p>
        <p className="text-muted">Signed in with: {providers.length ? providers.map((p) => (p === "email" ? "email & password" : p)).join(", ") : "email"}</p>
        <p className="text-muted">Your account email is private and is never shown to other members.</p>
      </section>
      {providers.includes("email") && (
        <section className="card p-5">
          <h2 className="mb-3 font-bold">Change password</h2>
          <PasswordForm />
        </section>
      )}
      <section className="card p-5">
        <h2 className="mb-1 font-bold">Blocked members</h2>
        <p className="mb-3 text-sm text-muted">Blocked members can&apos;t message you or start new chats with you.</p>
        <BlockList
          blocks={((blocks as unknown as { blocked_id: string; blocked: { display_name: string } | null }[] | null) ?? []).map((b) => ({
            id: b.blocked_id,
            name: b.blocked?.display_name ?? "Former member",
          }))}
          me={viewer.id}
        />
      </section>
      <section className="card p-5 text-sm">
        <h2 className="mb-1 font-bold">Your data</h2>
        <p className="text-muted">
          Recent searches are stored only in this browser and can be cleared from the search box. See the{" "}
          <a href="/privacy" className="link">privacy notice</a> for what UniKart stores.
        </p>
      </section>
      <section className="rounded-lg border-2 border-danger bg-white p-5">
        <h2 className="mb-2 font-bold text-danger">Delete account</h2>
        <DeleteAccountForm />
      </section>
    </div>
  );
}
