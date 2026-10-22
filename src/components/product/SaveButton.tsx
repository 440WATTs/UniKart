"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { HeartIcon } from "@/components/icons";
import { toggleSave } from "@/app/(site)/actions";

export function SaveButton({
  listingId,
  initialSaved,
  signedIn,
  variant = "icon",
}: {
  listingId: string;
  initialSaved: boolean;
  signedIn: boolean;
  variant?: "icon" | "button";
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const label = saved ? "Remove from saved" : "Save item";

  const iconClass =
    "flex h-10 w-10 items-center justify-center rounded-full border-2 border-ink bg-white/95 shadow-hard-sm hover:bg-butter";

  if (!signedIn) {
    return (
      <Link
        href={`/login?next=/product/${listingId}`}
        className={variant === "icon" ? iconClass : "btn-secondary"}
        aria-label="Log in to save this item"
        onClick={(e) => e.stopPropagation()}
      >
        <HeartIcon size={18} />
        {variant === "button" && "Save"}
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        aria-pressed={saved}
        aria-label={label}
        title={error ?? label}
        disabled={pending}
        className={variant === "icon" ? iconClass : "btn-secondary"}
        onClick={(e) => {
          // Cards are links; saving must not navigate.
          e.preventDefault();
          e.stopPropagation();
          const next = !saved;
          setSaved(next);
          setError(undefined);
          start(async () => {
            const r = await toggleSave(listingId, next);
            setSaved(r.saved);
            if (r.error) setError(r.error);
          });
        }}
      >
        <HeartIcon size={18} filled={saved} className={saved ? "text-[#d43c3c]" : undefined} />
        {variant === "button" && (saved ? "Saved" : "Save")}
      </button>
      {error && variant === "button" && (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      )}
    </>
  );
}
