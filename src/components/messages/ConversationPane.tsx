"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ImageIcon } from "@/components/icons";
import { storageUrl } from "@/lib/env";
import { timeAgo } from "@/lib/format";
import type { ConversationSummary } from "@/lib/messaging";

/** Two-pane on desktop; on phones the list and the open chat are separate screens. */
export function ConversationPane({ conversations, children }: { conversations: ConversationSummary[]; children: React.ReactNode }) {
  const path = usePathname();
  const inThread = path !== "/messages";
  return (
    <div className="grid overflow-hidden rounded-lg border-2 border-ink bg-white md:h-[calc(100vh-190px)] md:min-h-[520px] md:grid-cols-[320px_1fr]">
      <aside className={`${inThread ? "hidden md:flex" : "flex"} min-h-0 flex-col border-ink md:border-r-2`} aria-label="Conversations">
        <h1 className="border-b-2 border-ink bg-paper px-4 py-3 font-display text-lg font-bold">Messages</h1>
        {conversations.length === 0 ? (
          <p className="p-4 text-sm text-ink-soft">
            No conversations yet. Open a listing and choose <strong>Message seller</strong> to start one.
          </p>
        ) : (
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {conversations.map((c) => {
              const img = c.listing?.images?.sort((a, b) => a.position - b.position)[0];
              const active = path === `/messages/${c.id}`;
              return (
                <li key={c.id}>
                  <Link
                    href={`/messages/${c.id}`}
                    aria-current={active ? "page" : undefined}
                    className={`flex gap-3 border-b border-line px-3 py-3 ${active ? "bg-sky-soft" : "hover:bg-paper"}`}
                  >
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded border border-line bg-paper">
                      {img ? (
                        <Image src={storageUrl("listing-images", img.storage_path)} alt="" fill sizes="48px" className="object-cover" />
                      ) : (
                        <ImageIcon className="m-3 text-muted" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className={`truncate text-sm ${c.unread ? "font-bold" : "font-semibold"}`}>{c.other?.display_name ?? "Former member"}</p>
                        <time className="shrink-0 text-[11px] text-muted" dateTime={c.last_message_at}>
                          {timeAgo(c.last_message_at)}
                        </time>
                      </div>
                      <p className="truncate text-xs text-muted">{c.listing?.title ?? "Listing no longer available"}</p>
                      <p className={`truncate text-xs ${c.unread ? "font-semibold text-ink" : "text-ink-soft"}`}>
                        {c.unread && <span className="mr-1 inline-block h-2 w-2 rounded-full bg-sky-deep" aria-label="Unread" />}
                        {c.lastMessage?.body ?? "No messages yet"}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </aside>
      <section className={`${inThread ? "flex" : "hidden md:flex"} min-h-0 flex-col`}>{children}</section>
    </div>
  );
}
