"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CloseIcon, FilterIcon } from "@/components/icons";
import { CONDITIONS, SORTS } from "@/lib/constants";

type Cat = { id: string; name: string };

/** Filters live in the URL so searches survive refresh and can be shared. */
export function Filters({ categories, total }: { categories: Cat[]; total: number }) {
  const [open, setOpen] = useState(false);
  const params = useSearchParams();
  useEffect(() => setOpen(false), [params]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [open]);

  const active = ["category", "min", "max", "condition", "type", "availability"].filter((k) => params.get(k)).length;
  return (
    <>
      <button type="button" className="btn-secondary btn-sm mb-3 lg:hidden" onClick={() => setOpen(true)} aria-expanded={open}>
        <FilterIcon size={16} /> Filters{active ? ` (${active})` : ""}
      </button>
      <aside className="hidden w-60 shrink-0 lg:block" aria-label="Filters">
        <FilterForm categories={categories} />
      </aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <div className="absolute inset-0 bg-black/45" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-xl border-t-[3px] border-ink bg-paper p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Filters</h2>
              <button type="button" className="btn-ghost px-2" aria-label="Close filters" onClick={() => setOpen(false)} autoFocus>
                <CloseIcon />
              </button>
            </div>
            <FilterForm categories={categories} />
            <p className="mt-3 text-center text-xs text-muted">{total} results</p>
          </div>
        </div>
      )}
    </>
  );
}

function FilterForm({ categories }: { categories: Cat[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const conds = new Set((params.get("condition") ?? "").split(",").filter(Boolean));

  function apply(form: HTMLFormElement) {
    const fd = new FormData(form);
    const sp = new URLSearchParams();
    const q = params.get("q");
    if (q) sp.set("q", q);
    const sort = params.get("sort");
    if (sort) sp.set("sort", sort);
    for (const k of ["category", "min", "max", "type", "availability"]) {
      const v = String(fd.get(k) ?? "").trim();
      if (v) sp.set(k, v);
    }
    const c = fd.getAll("condition").map(String);
    if (c.length) sp.set("condition", c.join(","));
    router.push(`${pathname}?${sp}`);
  }

  const group = "border-b border-line pb-4 mb-4";
  const legend = "mb-2 text-sm font-bold";
  return (
    <form
      key={params.toString()}
      onSubmit={(e) => {
        e.preventDefault();
        apply(e.currentTarget);
      }}
      className="text-sm"
    >
      <fieldset className={group}>
        <legend className={legend}>Category</legend>
        <select name="category" defaultValue={params.get("category") ?? ""} className="input min-h-10 text-sm">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </fieldset>
      <fieldset className={group}>
        <legend className={legend}>Price (₹)</legend>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="f-min">Minimum price</label>
          <input id="f-min" name="min" inputMode="numeric" pattern="[0-9]*" placeholder="Min" defaultValue={params.get("min") ?? ""} className="input min-h-10 text-sm" />
          <span aria-hidden>–</span>
          <label className="sr-only" htmlFor="f-max">Maximum price</label>
          <input id="f-max" name="max" inputMode="numeric" pattern="[0-9]*" placeholder="Max" defaultValue={params.get("max") ?? ""} className="input min-h-10 text-sm" />
        </div>
      </fieldset>
      <fieldset className={group}>
        <legend className={legend}>Condition</legend>
        {CONDITIONS.map((c) => (
          <label key={c.id} className="flex min-h-9 items-center gap-2">
            <input type="checkbox" name="condition" value={c.id} defaultChecked={conds.has(c.id)} className="h-4.5 w-4.5 accent-black" />
            {c.label}
          </label>
        ))}
      </fieldset>
      <fieldset className={group}>
        <legend className={legend}>Listing type</legend>
        {[
          ["", "Any"],
          ["fixed", "Fixed price"],
          ["offers", "Accepts offers"],
          ["free", "Free"],
        ].map(([v, l]) => (
          <label key={v} className="flex min-h-9 items-center gap-2">
            <input type="radio" name="type" value={v} defaultChecked={(params.get("type") ?? "") === v} className="h-4.5 w-4.5 accent-black" />
            {l}
          </label>
        ))}
      </fieldset>
      <fieldset className={group}>
        <legend className={legend}>Availability</legend>
        {[
          ["", "Available now"],
          ["all", "Include reserved and sold"],
        ].map(([v, l]) => (
          <label key={v} className="flex min-h-9 items-center gap-2">
            <input type="radio" name="availability" value={v} defaultChecked={(params.get("availability") ?? "") === v} className="h-4.5 w-4.5 accent-black" />
            {l}
          </label>
        ))}
      </fieldset>
      <div className="flex gap-2">
        <button type="submit" className="btn-primary flex-1">
          Apply
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            const q = params.get("q");
            router.push(`${pathname}${q ? `?q=${encodeURIComponent(q)}` : ""}`);
          }}
        >
          Clear
        </button>
      </div>
    </form>
  );
}

export function SortSelect() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="hidden sm:inline">Sort by</span>
      <select
        className="input min-h-9 w-auto py-1 text-sm"
        value={params.get("sort") ?? "newest"}
        aria-label="Sort results"
        onChange={(e) => {
          const sp = new URLSearchParams(params);
          sp.delete("page");
          if (e.target.value === "newest") sp.delete("sort");
          else sp.set("sort", e.target.value);
          router.push(`${pathname}?${sp}`);
        }}
      >
        {SORTS.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
    </label>
  );
}
