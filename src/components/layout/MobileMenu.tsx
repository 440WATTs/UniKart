"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CloseIcon, MenuIcon } from "@/components/icons";

export function MobileMenu({
  signedIn,
  isStaff,
  categories,
}: {
  signedIn: boolean;
  isStaff: boolean;
  categories: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement>(null);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLElement>("a,button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      // Keep focus inside the dialog.
      if (e.key === "Tab" && panel.current) {
        const f = panel.current.querySelectorAll<HTMLElement>("a,button");
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const openerEl = opener.current;
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
      openerEl?.focus();
    };
  }, [open]);

  const item = "block rounded-md px-3 py-3 text-base font-semibold hover:bg-ink hover:text-white";
  return (
    <>
      <button ref={opener} type="button" className="btn-ghost px-2 lg:hidden" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}>
        <MenuIcon size={24} />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-black/45" onClick={() => setOpen(false)} />
          <div ref={panel} className="absolute inset-y-0 right-0 flex w-[min(86vw,340px)] flex-col overflow-y-auto border-l-[3px] border-ink bg-paper p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-pixel text-xl font-bold">Menu</span>
              <button type="button" className="btn-ghost px-2" aria-label="Close menu" onClick={() => setOpen(false)}>
                <CloseIcon />
              </button>
            </div>
            <nav aria-label="Mobile">
              <Link href="/marketplace" className={item}>Shop</Link>
              <Link href="/sell" className={item}>Sell</Link>
              <Link href="/wanted" className={item}>Wanted</Link>
              <Link href="/categories" className={item}>Categories</Link>
              <div className="my-1 ml-3 border-l-2 border-line pl-2">
                {categories.map((c) => (
                  <Link key={c.id} href={`/search?category=${c.id}`} className="block rounded px-3 py-2 text-sm hover:bg-ink hover:text-white">
                    {c.name}
                  </Link>
                ))}
                <Link href="/search?type=free" className="block rounded px-3 py-2 text-sm hover:bg-ink hover:text-white">
                  Free Items
                </Link>
              </div>
              {signedIn ? (
                <>
                  <Link href="/messages" className={item}>Messages</Link>
                  <Link href="/saved" className={item}>Saved</Link>
                  <Link href="/account" className={item}>Account</Link>
                  {isStaff && <Link href="/admin" className={item}>Admin</Link>}
                </>
              ) : (
                <Link href="/login" className={item}>Login</Link>
              )}
              <Link href="/help" className={item}>Help &amp; Safety</Link>
              <Link href="/#contact" className={item}>About</Link>
              <Link href="/contact" className={item}>Contact</Link>
              {signedIn && (
                <form action="/auth/signout" method="post">
                  <button type="submit" className={`${item} w-full text-left`}>Log out</button>
                </form>
              )}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
