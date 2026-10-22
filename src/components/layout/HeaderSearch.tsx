"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { SearchIcon } from "@/components/icons";

const RECENT_KEY = "unimart:recent-searches";

function readRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]").slice(0, 6);
  } catch {
    return [];
  }
}

/** Search terms only (no personal data) are kept on this device; users can clear them. */
export function rememberSearch(q: string) {
  try {
    const next = [q, ...readRecent().filter((r) => r.toLowerCase() !== q.toLowerCase())].slice(0, 6);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {}
}

type Suggestion = { type: "listing" | "category"; label: string; href: string };

export function HeaderSearch({ className = "" }: { className?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [active, setActive] = useState(-1);
  const box = useRef<HTMLFormElement>(null);
  const listId = useId();

  useEffect(() => setQ(params.get("q") ?? ""), [params]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setSuggestions([]);
      return;
    }
    const ctl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/suggest?q=${encodeURIComponent(term)}`, { signal: ctl.signal })
        .then((r) => (r.ok ? r.json() : { suggestions: [] }))
        .then((d) => setSuggestions(d.suggestions ?? []))
        .catch(() => {});
    }, 180);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q]);

  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  const items: Suggestion[] =
    q.trim().length < 2 ? recent.map((r) => ({ type: "listing", label: r, href: `/search?q=${encodeURIComponent(r)}` })) : suggestions;

  function submit(term: string) {
    const t = term.trim();
    setOpen(false);
    if (t) rememberSearch(t);
    const sp = new URLSearchParams();
    if (t) sp.set("q", t);
    router.push(`/search${sp.size ? `?${sp}` : ""}`);
  }

  return (
    <form
      ref={box}
      role="search"
      className={`relative ${className}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (active >= 0 && items[active]) {
          setOpen(false);
          if (items[active].type === "listing" && q.trim().length < 2) rememberSearch(items[active].label);
          router.push(items[active].href);
        } else submit(q);
      }}
    >
      <label htmlFor={`${listId}-input`} className="sr-only">
        Search UniMart
      </label>
      <div className="flex h-11 overflow-hidden rounded-md border-2 border-ink bg-white focus-within:outline-3 focus-within:outline-sky">
        <input
          id={`${listId}-input`}
          type="search"
          value={q}
          autoComplete="off"
          enterKeyHint="search"
          placeholder="Search books, calculators, laptops, cycles, hostel items..."
          className="min-w-0 flex-1 bg-transparent px-3 text-[15px] outline-none placeholder:text-muted"
          role="combobox"
          aria-expanded={open && items.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          onFocus={() => {
            setRecent(readRecent());
            setOpen(true);
          }}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(-1);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, items.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, -1));
            } else if (e.key === "Escape") setOpen(false);
          }}
        />
        <button type="submit" className="flex w-12 items-center justify-center border-l-2 border-ink bg-sun hover:bg-gold" aria-label="Search">
          <SearchIcon />
        </button>
      </div>
      {open && items.length > 0 && (
        <div className="absolute inset-x-0 top-[calc(100%+6px)] z-50 rounded-md border-2 border-ink bg-white py-1 shadow-hard">
          {q.trim().length < 2 && (
            <div className="flex items-center justify-between px-3 pt-1 pb-1.5 text-xs text-muted">
              <span>Recent searches (this device only)</span>
              <button
                type="button"
                className="link"
                onClick={() => {
                  try {
                    localStorage.removeItem(RECENT_KEY);
                  } catch {}
                  setRecent([]);
                }}
              >
                Clear
              </button>
            </div>
          )}
          <ul id={listId} role="listbox" aria-label="Suggestions">
            {items.map((s, i) => (
              <li
                key={s.href + i}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm ${i === active ? "bg-sky-soft" : "hover:bg-paper"}`}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => {
                  setOpen(false);
                  router.push(s.href);
                }}
              >
                <SearchIcon size={14} className="shrink-0 text-muted" />
                <span className="truncate">{s.label}</span>
                {s.type === "category" && <span className="ml-auto text-xs text-muted">Category</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}
