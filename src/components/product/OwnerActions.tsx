"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/Modal";
import { deleteDraft, setListingStatus } from "@/app/(site)/sell/actions";
import type { ListingStatus } from "@/lib/types";

type Change = { status: "active" | "reserved" | "sold" | "draft" | "removed"; label: string; confirm?: string; danger?: boolean };

function changesFor(status: ListingStatus, wanted: boolean): Change[] {
  const sold = wanted ? "Mark as found" : "Mark as sold";
  switch (status) {
    case "active":
      return [
        { status: "sold", label: sold, confirm: wanted ? "Close this request as found?" : "Mark this item as sold? Buyers will see it is no longer available and open offers will be closed." },
        ...(!wanted ? [{ status: "reserved" as const, label: "Mark as reserved" }] : []),
        { status: "draft", label: "Unpublish" },
        { status: "removed", label: "Remove listing", danger: true, confirm: "Remove this listing? It will disappear from the marketplace. Conversations are kept." },
      ];
    case "reserved":
      return [
        { status: "sold", label: sold, confirm: "Mark this item as sold?" },
        { status: "active", label: "Make available again", confirm: "Make the item available again? Any accepted offer will be released." },
        { status: "removed", label: "Remove listing", danger: true, confirm: "Remove this listing?" },
      ];
    case "sold":
      return [{ status: "active", label: "Relist", confirm: "Relist this item as available?" }];
    case "draft":
      return [{ status: "active", label: "Publish" }];
    case "removed":
      return [{ status: "active", label: "Relist", confirm: "Put this listing back on the marketplace?" }];
    default:
      return [];
  }
}

export function OwnerActions({
  id,
  status,
  wanted,
  lockedByModerator,
  compact,
}: {
  id: string;
  status: ListingStatus;
  wanted: boolean;
  lockedByModerator: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState<Change | "delete" | null>(null);
  const [error, setError] = useState<string>();

  if (lockedByModerator) {
    return <p className="text-sm text-danger">A moderator removed this listing. Contact support if you think this is a mistake.</p>;
  }
  const run = (c: Change) =>
    start(async () => {
      setError(undefined);
      const r = await setListingStatus(id, c.status);
      setConfirm(null);
      if (!r.ok) setError(r.error);
      else router.refresh();
    });

  const btn = compact ? "btn-secondary btn-sm" : "btn-secondary w-full";
  return (
    <div className={compact ? "flex flex-wrap gap-1.5" : "grid gap-2"}>
      {status !== "removed" && (
        <Link href={`/sell/${id}/edit`} className={compact ? "btn-secondary btn-sm" : "btn-primary w-full"}>
          Edit
        </Link>
      )}
      {changesFor(status, wanted).map((c) => (
        <button
          key={c.status}
          type="button"
          disabled={pending}
          className={c.danger ? (compact ? "btn-danger btn-sm" : "btn-danger w-full") : btn}
          onClick={() => (c.confirm ? setConfirm(c) : run(c))}
        >
          {c.label}
        </button>
      ))}
      {status === "draft" && (
        <button type="button" className={compact ? "btn-danger btn-sm" : "btn-danger w-full"} onClick={() => setConfirm("delete")}>
          Delete draft
        </button>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <Modal open={confirm !== null} onClose={() => setConfirm(null)} title="Please confirm">
        <p className="text-sm">{confirm === "delete" ? "Delete this draft permanently? Its photos will be deleted too." : confirm?.confirm}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={() => setConfirm(null)}>
            Cancel
          </button>
          <button
            type="button"
            disabled={pending}
            className={confirm === "delete" || (confirm && confirm.danger) ? "btn-danger" : "btn-primary"}
            onClick={() => {
              if (confirm === "delete")
                start(async () => {
                  const r = await deleteDraft(id);
                  setConfirm(null);
                  if (!r.ok) setError(r.error);
                  else router.push("/account/listings?tab=drafts");
                });
              else if (confirm) run(confirm);
            }}
          >
            {pending ? "Saving…" : confirm === "delete" ? "Delete" : (confirm?.label ?? "Confirm")}
          </button>
        </div>
      </Modal>
    </div>
  );
}
