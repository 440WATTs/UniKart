"use client";
import { useActionState, useState } from "react";
import { FlagIcon, TagIcon } from "@/components/icons";
import { Modal } from "@/components/ui/Modal";
import { FormMessage, SubmitButton } from "@/components/ui/form";
import { makeOffer, submitReport } from "@/app/(site)/actions";
import { REPORT_REASONS } from "@/lib/constants";
import { formatPrice } from "@/lib/format";

export function OfferButton({ listingId, pricePaise, title }: { listingId: string; pricePaise: number; title: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(makeOffer, null);
  return (
    <>
      <button type="button" className="btn-secondary w-full" onClick={() => setOpen(true)}>
        <TagIcon size={18} /> Make an offer
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Make an offer">
        <form action={action} className="space-y-4">
          <input type="hidden" name="listingId" value={listingId} />
          <p className="text-sm">
            <strong>{title}</strong> is listed at <strong>{formatPrice(pricePaise)}</strong>.
          </p>
          <FormMessage state={state} />
          <div>
            <label htmlFor="amount" className="field-label">
              Your offer (₹)
            </label>
            <input id="amount" name="amount" inputMode="decimal" required className="input" placeholder={String(Math.round((pricePaise * 0.85) / 100))} />
          </div>
          <p className="rounded-md bg-butter p-3 text-xs leading-relaxed">
            Offers are a way to negotiate. Nothing is paid through UniKart and an accepted offer is not a binding purchase:
            it reserves the item while you both agree the final price and a safe place to meet on campus. Offers expire after 48 hours.
          </p>
          <SubmitButton className="btn-primary w-full" pendingText="Sending offer…">
            Send offer
          </SubmitButton>
        </form>
      </Modal>
    </>
  );
}

export function ReportButton({
  listingId,
  reportedUserId,
  conversationId,
  label = "Report listing",
  className = "btn-ghost text-sm text-muted",
}: {
  listingId?: string;
  reportedUserId?: string;
  conversationId?: string;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(submitReport, null);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        <FlagIcon size={16} /> {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={label}>
        {state?.ok ? (
          <div className="space-y-4">
            <FormMessage state={state} />
            <button type="button" className="btn-secondary w-full" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
        ) : (
          <form action={action} className="space-y-4">
            {listingId && <input type="hidden" name="listingId" value={listingId} />}
            {reportedUserId && <input type="hidden" name="reportedUserId" value={reportedUserId} />}
            {conversationId && <input type="hidden" name="conversationId" value={conversationId} />}
            <FormMessage state={state} />
            <fieldset>
              <legend className="field-label">What&apos;s wrong?</legend>
              {REPORT_REASONS.map((r) => (
                <label key={r.id} className="flex min-h-10 items-center gap-2 text-sm">
                  <input type="radio" name="reason" value={r.id} required className="h-4.5 w-4.5 accent-black" />
                  {r.label}
                </label>
              ))}
            </fieldset>
            <div>
              <label htmlFor="details" className="field-label">
                Details (optional)
              </label>
              <textarea id="details" name="details" rows={3} maxLength={2000} className="input" />
            </div>
            <p className="text-xs text-muted">
              If you feel unsafe, contact campus security or local authorities first. Reports are reviewed by UniKart moderators.
            </p>
            <SubmitButton className="btn-dark w-full" pendingText="Sending…">
              Send report
            </SubmitButton>
          </form>
        )}
      </Modal>
    </>
  );
}
