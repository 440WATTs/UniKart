"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { CloseIcon } from "@/components/icons";

/**
 * Native <dialog>: the browser handles focus trapping, Escape and returning
 * focus to the opener.
 */
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="modal-title"
      className="m-auto w-[min(calc(100vw-2rem),480px)] rounded-lg border-2 border-ink bg-paper p-0 shadow-hard backdrop:bg-black/45"
    >
      <div className="flex items-center justify-between border-b-2 border-ink bg-chrome px-4 py-1.5">
        <h2 id="modal-title" className="font-mono text-sm font-bold">
          {title}
        </h2>
        <button type="button" onClick={onClose} className="rounded p-1 hover:bg-black/10" aria-label="Close">
          <CloseIcon size={18} />
        </button>
      </div>
      <div className="p-5">{open && children}</div>
    </dialog>
  );
}
