"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ChevronLeft, ShieldIcon } from "@/components/icons";
import { ReportButton } from "@/components/product/ProductActions";
import { Dropdown, menuItemClass } from "@/components/ui/Dropdown";
import { Modal } from "@/components/ui/Modal";
import { createClient } from "@/lib/supabase/client";
import { storageUrl } from "@/lib/env";
import { formatDateTime, formatPrice, rupeesToPaise } from "@/lib/format";
import { STATUS_LABEL } from "@/lib/constants";
import type { Message, Offer } from "@/lib/types";

const OFFER_ERRORS: Record<string, string> = {
  not_your_turn: "It's the other person's turn to respond.",
  offer_not_pending: "This offer has already been answered.",
  offer_expired: "This offer has expired.",
  listing_unavailable: "The item is no longer available.",
  invalid_amount: "Enter an amount above ₹0 and no higher than the asking price.",
  blocked: "You can't message this member.",
  not_participant: "You're not part of this conversation.",
  participant_left: "The other member has left UniKart.",
  account_suspended: "Your account is suspended.",
};
const explain = (msg: string) => OFFER_ERRORS[Object.keys(OFFER_ERRORS).find((k) => msg.includes(k)) ?? ""] ?? "Something went wrong. Please try again.";

type Pending = { tempId: string; body: string; failed?: boolean };

export function ChatThread({
  conversationId,
  me,
  other,
  listing,
  isOwner,
  initialMessages,
  offers,
  blockedByMe,
}: {
  conversationId: string;
  me: string;
  other: { id: string; display_name: string; verified_institute_id: string | null } | null;
  listing: { id: string; title: string; status: string; kind: string; price_paise: number | null; images: { storage_path: string; position: number }[] } | null;
  isOwner: boolean;
  initialMessages: Message[];
  offers: Offer[];
  blockedByMe: boolean;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [pending, setPending] = useState<Pending[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string>();
  const [blocked, setBlocked] = useState(blockedByMe);
  const listRef = useRef<HTMLOListElement>(null);
  const lastAt = useRef(initialMessages.at(-1)?.created_at ?? new Date(0).toISOString());

  const merge = useCallback(
    (incoming: Message[]) => {
      if (!incoming.length) return;
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        const add = incoming.filter((m) => !seen.has(m.id));
        if (!add.length) return prev;
        const next = [...prev, ...add].sort((a, b) => a.created_at.localeCompare(b.created_at));
        lastAt.current = next.at(-1)!.created_at;
        return next;
      });
      if (incoming.some((m) => m.kind === "offer")) router.refresh();
    },
    [router],
  );

  // Realtime when available, plus a polling fallback so nothing is missed.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`conv:${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, (payload: { new: unknown }) =>
        merge([payload.new as Message]),
      )
      .subscribe();
    const poll = setInterval(async () => {
      if (document.hidden) return;
      const { data } = await supabase.from("messages").select("*").eq("conversation_id", conversationId).gt("created_at", lastAt.current).order("created_at");
      merge((data as Message[] | null) ?? []);
    }, 15000);
    return () => {
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [conversationId, merge]);

  useEffect(() => {
    listRef.current?.lastElementChild?.scrollIntoView({ block: "end" });
    if (messages.length) createClient().rpc("mark_conversation_read", { p_conv: conversationId });
  }, [messages.length, pending.length, conversationId]);

  async function send(body: string, tempId = crypto.randomUUID()) {
    setError(undefined);
    setPending((p) => [...p.filter((x) => x.tempId !== tempId), { tempId, body }]);
    // Shown as "Sending…" until the database confirms the insert.
    const { data, error } = await createClient().from("messages").insert({ conversation_id: conversationId, body }).select().single();
    if (error) {
      setPending((p) => p.map((x) => (x.tempId === tempId ? { ...x, failed: true } : x)));
      setError(explain(error.message));
      return;
    }
    setPending((p) => p.filter((x) => x.tempId !== tempId));
    merge([data as Message]);
  }

  const cover = listing?.images?.slice().sort((a, b) => a.position - b.position)[0];
  const offersById = new Map(offers.map((o) => [o.id, o]));
  const live = offers.filter((o) => o.status === "pending" || o.status === "accepted").at(-1);

  return (
    <div className="flex min-h-[70vh] flex-1 flex-col md:min-h-0">
      <header className="flex items-center gap-3 border-b-2 border-ink bg-paper px-3 py-2">
        <Link href="/messages" className="btn-ghost px-1.5 md:hidden" aria-label="Back to conversations">
          <ChevronLeft />
        </Link>
        {listing && (
          <Link href={`/product/${listing.id}`} className="flex min-w-0 flex-1 items-center gap-3">
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded border border-line bg-white">
              {cover && <Image src={storageUrl("listing-images", cover.storage_path)} alt="" fill sizes="44px" className="object-cover" />}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{other?.display_name ?? "Former member"}</p>
              <p className="truncate text-xs text-ink-soft">
                {listing.title} · {listing.kind === "wanted" ? "Wanted" : formatPrice(listing.price_paise)} · {STATUS_LABEL[listing.status] ?? listing.status}
              </p>
            </div>
          </Link>
        )}
        {!listing && <p className="flex-1 text-sm font-semibold">{other?.display_name ?? "Former member"} · listing unavailable</p>}
        {other && (
          <Dropdown align="right" ariaLabel="Conversation options" buttonClassName="btn-ghost px-2" label={<span aria-hidden>⋯</span>}>
            <button
              type="button"
              data-close
              className={menuItemClass}
              onClick={async () => {
                const supabase = createClient();
                const { error } = blocked
                  ? await supabase.from("blocks").delete().eq("blocker_id", me).eq("blocked_id", other.id)
                  : await supabase.from("blocks").insert({ blocker_id: me, blocked_id: other.id });
                if (!error) setBlocked(!blocked);
              }}
            >
              {blocked ? "Unblock" : "Block"} {other.display_name}
            </button>
            <ReportButton conversationId={conversationId} reportedUserId={other.id} label="Report this member" className={menuItemClass} />
          </Dropdown>
        )}
      </header>

      <p className="flex items-center gap-2 border-b border-line bg-sky-soft px-3 py-1.5 text-xs">
        <ShieldIcon size={14} /> Meet in a public place on campus. Never pay in advance or share OTPs.{" "}
        <Link href="/help#safety" className="link">
          Safety tips
        </Link>
      </p>

      {live && <OfferPanel offer={live} me={me} isOwner={isOwner} listingPrice={listing?.price_paise ?? 0} onChange={() => router.refresh()} />}

      <ol ref={listRef} className="flex-1 space-y-2 overflow-y-auto bg-cream/60 p-3" aria-live="polite" aria-label="Messages">
        {messages.length === 0 && pending.length === 0 && (
          <li className="py-8 text-center text-sm text-muted">Say hello and ask about the item.</li>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === me;
          if (m.kind === "offer") {
            const o = m.offer_id ? offersById.get(m.offer_id) : undefined;
            return (
              <li key={m.id} className="flex justify-center">
                <span className="rounded-full border border-ink/30 bg-butter px-3 py-1 text-xs">
                  <strong>{mine ? "You" : (other?.display_name ?? "Member")}</strong> {m.body.charAt(0).toLowerCase() + m.body.slice(1)}
                  {o && o.status === "pending" && new Date(o.expires_at) < new Date() ? " (expired)" : ""} ·{" "}
                  <time dateTime={m.created_at}>{formatDateTime(m.created_at)}</time>
                </span>
              </li>
            );
          }
          return (
            <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-lg border px-3 py-2 text-sm ${mine ? "border-ink bg-sky" : "border-line bg-white"}`}>
                <p className="break-words whitespace-pre-wrap">{m.body}</p>
                <time className="mt-0.5 block text-right text-[10px] text-ink-soft" dateTime={m.created_at}>
                  {formatDateTime(m.created_at)}
                </time>
              </div>
            </li>
          );
        })}
        {pending.map((p) => (
          <li key={p.tempId} className="flex justify-end">
            <div className={`max-w-[80%] rounded-lg border border-dashed px-3 py-2 text-sm ${p.failed ? "border-danger bg-danger-soft" : "border-ink bg-sky/50"}`}>
              <p className="break-words whitespace-pre-wrap">{p.body}</p>
              <p className="mt-0.5 text-right text-[10px]">
                {p.failed ? (
                  <button type="button" className="font-semibold text-danger underline" onClick={() => send(p.body, p.tempId)}>
                    Not sent — retry
                  </button>
                ) : (
                  "Sending…"
                )}
              </p>
            </div>
          </li>
        ))}
      </ol>

      {error && (
        <p role="alert" className="border-t border-danger bg-danger-soft px-3 py-1.5 text-xs text-danger">
          {error}
        </p>
      )}
      {blocked ? (
        <p className="border-t-2 border-ink bg-paper p-3 text-center text-sm">You blocked this member. Unblock them to send messages.</p>
      ) : (
        <form
          className="flex items-end gap-2 border-t-2 border-ink bg-paper p-2"
          onSubmit={(e) => {
            e.preventDefault();
            const body = text.trim();
            if (!body) return;
            setText("");
            send(body.slice(0, 2000));
          }}
        >
          <label htmlFor="composer" className="sr-only">
            Message
          </label>
          <textarea
            id="composer"
            rows={1}
            maxLength={2000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Write a message…"
            className="input max-h-32 min-h-11 flex-1 resize-none"
          />
          <button type="submit" className="btn-primary" disabled={!text.trim()}>
            Send
          </button>
        </form>
      )}
    </div>
  );
}

function OfferPanel({ offer, me, isOwner, listingPrice, onChange }: { offer: Offer; me: string; isOwner: boolean; listingPrice: number; onChange: () => void }) {
  const [busy, start] = useTransition();
  const [error, setError] = useState<string>();
  const [counterOpen, setCounterOpen] = useState(false);
  const [counter, setCounter] = useState("");
  const expired = offer.status === "pending" && new Date(offer.expires_at) < new Date();
  const myOffer = offer.made_by === me;
  const canRespond = offer.status === "pending" && !expired && !myOffer;

  const call = (fn: () => PromiseLike<{ error: { message: string } | null }>) =>
    start(async () => {
      setError(undefined);
      const { error } = await fn();
      if (error) setError(explain(error.message));
      else {
        setCounterOpen(false);
        onChange();
      }
    });
  const supabase = createClient();

  return (
    <div className="border-b-2 border-ink bg-butter px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p>
          {offer.status === "accepted" ? (
            <>
              <strong>Offer accepted: {formatPrice(offer.amount_paise)}.</strong> The item is reserved. Agree on a time and a public place to meet.
            </>
          ) : expired ? (
            <>Offer of <strong>{formatPrice(offer.amount_paise)}</strong> has expired.</>
          ) : (
            <>
              {myOffer ? "You offered" : isOwner ? "Buyer offered" : "Seller countered with"} <strong>{formatPrice(offer.amount_paise)}</strong>
              {listingPrice ? <> (asking {formatPrice(listingPrice)})</> : null} · expires {formatDateTime(offer.expires_at)}
            </>
          )}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {canRespond && (
            <>
              <button type="button" disabled={busy} className="btn-primary btn-sm" onClick={() => call(() => supabase.rpc("respond_offer", { p_offer: offer.id, p_action: "accept" }))}>
                Accept
              </button>
              <button type="button" disabled={busy} className="btn-secondary btn-sm" onClick={() => setCounterOpen(true)}>
                Counter
              </button>
              <button type="button" disabled={busy} className="btn-danger btn-sm" onClick={() => call(() => supabase.rpc("respond_offer", { p_offer: offer.id, p_action: "decline" }))}>
                Decline
              </button>
            </>
          )}
          {offer.status === "pending" && !expired && myOffer && (
            <button type="button" disabled={busy} className="btn-secondary btn-sm" onClick={() => call(() => supabase.rpc("withdraw_offer", { p_offer: offer.id }))}>
              Withdraw
            </button>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
      <Modal open={counterOpen} onClose={() => setCounterOpen(false)} title="Counteroffer">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const paise = rupeesToPaise(counter);
            if (!paise) return setError("Enter an amount in rupees.");
            call(() => supabase.rpc("respond_offer", { p_offer: offer.id, p_action: "counter", p_counter_paise: paise }));
          }}
        >
          <p className="text-sm">
            Their offer: <strong>{formatPrice(offer.amount_paise)}</strong>. Asking price: <strong>{formatPrice(listingPrice)}</strong>.
          </p>
          <div>
            <label htmlFor="counter" className="field-label">
              Your counteroffer (₹)
            </label>
            <input id="counter" inputMode="decimal" className="input" value={counter} onChange={(e) => setCounter(e.target.value)} required />
          </div>
          {error && <p className="field-error">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? "Sending…" : "Send counteroffer"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
