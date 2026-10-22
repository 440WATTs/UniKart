import Link from "next/link";
import { EmptyState, PageTitle } from "@/components/ui/EmptyState";
import { SubmitButton } from "@/components/ui/form";
import { timeAgo } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/session";
import type { Notification } from "@/lib/types";
import { markAllNotificationsRead } from "../actions";

export const metadata = { title: "Notifications" };

const ICON: Record<string, string> = {
  message: "💬",
  wanted_response: "📣",
  offer_received: "🏷️",
  offer_accepted: "✅",
  offer_declined: "✖️",
  offer_countered: "↔️",
  offer_cancelled: "⏹️",
  listing_sold: "🔖",
  verification: "🎓",
  moderation: "🛡️",
};

export default async function NotificationsPage() {
  const viewer = await requireViewer("/account/notifications");
  const supabase = await createClient();
  const { data } = await supabase.from("notifications").select("*").eq("user_id", viewer.id).order("created_at", { ascending: false }).limit(100);
  const items = (data as Notification[] | null) ?? [];
  const unread = items.some((n) => !n.read_at);
  return (
    <div>
      <PageTitle
        title="Notifications"
        actions={
          unread ? (
            <form action={markAllNotificationsRead}>
              <SubmitButton className="btn-secondary btn-sm" pendingText="Marking…">
                Mark all as read
              </SubmitButton>
            </form>
          ) : undefined
        }
      />
      {items.length === 0 ? (
        <EmptyState icon="🔔" title="No notifications yet">
          You&apos;ll be notified about new messages, offers and verification updates.
        </EmptyState>
      ) : (
        <ul className="card divide-y divide-line">
          {items.map((n) => {
            const body = (
              <div className="flex gap-3 p-4">
                <span className="text-xl" aria-hidden>
                  {ICON[n.type] ?? "🔔"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${n.read_at ? "" : "font-bold"}`}>
                    {!n.read_at && <span className="sr-only">Unread: </span>}
                    {n.title}
                  </p>
                  {n.body && <p className="truncate text-sm text-ink-soft">{n.body}</p>}
                  <time className="text-xs text-muted" dateTime={n.created_at}>
                    {timeAgo(n.created_at)}
                  </time>
                </div>
                {!n.read_at && <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-sky-deep" aria-hidden />}
              </div>
            );
            return <li key={n.id}>{n.link ? <Link href={n.link} className="block hover:bg-paper">{body}</Link> : body}</li>;
          })}
        </ul>
      )}
    </div>
  );
}
