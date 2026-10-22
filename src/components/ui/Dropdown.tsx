"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/**
 * Accessible disclosure menu: click/tap or keyboard to open, Escape or an
 * outside click to close. No hover-only behaviour.
 */
export function Dropdown({
  label,
  children,
  align = "left",
  buttonClassName = "btn-ghost",
  ariaLabel,
}: {
  label: ReactNode;
  children: ReactNode;
  align?: "left" | "right";
  buttonClassName?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btn.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        ref={btn}
        type="button"
        className={buttonClassName}
        aria-expanded={open}
        aria-controls={id}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
      >
        {label}
      </button>
      <div
        id={id}
        hidden={!open}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a,button[data-close]")) setOpen(false);
        }}
        className={`absolute top-[calc(100%+8px)] z-50 min-w-56 rounded-md border-2 border-ink bg-paper py-1 shadow-hard ${align === "right" ? "right-0" : "left-0"}`}
      >
        {children}
      </div>
    </div>
  );
}

export const menuItemClass =
  "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium hover:bg-ink hover:text-white focus-visible:bg-ink focus-visible:text-white focus-visible:outline-none";
