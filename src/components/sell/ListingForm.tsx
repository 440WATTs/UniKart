"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import { CloseIcon, ImageIcon } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";
import { conditionLabel, CONDITIONS, IMAGE_RULES } from "@/lib/constants";
import { storageUrl } from "@/lib/env";
import { formatPrice, rupeesToPaise } from "@/lib/format";
import { saveListing, type ListingInput } from "@/app/(site)/sell/actions";
import { reencodeImage } from "@/lib/image";

type Photo = { key: string; path?: string; preview: string; status: "uploading" | "done" | "error"; error?: string; isNew: boolean };

export function ListingForm({
  userId,
  listingId: initialListingId,
  kind,
  categories,
  offersEnabled,
  maxImages = IMAGE_RULES.maxFiles,
  initial,
  initialPhotos = [],
  isEdit,
  instituteName,
}: {
  userId: string;
  listingId: string;
  kind: "sale" | "wanted";
  categories: { id: string; name: string }[];
  offersEnabled: boolean;
  maxImages?: number;
  initial: Partial<ListingInput>;
  initialPhotos?: string[];
  isEdit: boolean;
  instituteName: string;
}) {
  const router = useRouter();
  const formId = useId();
  // Fixed for the life of the form so a re-render can't move uploads to a new folder.
  const [listingId] = useState(initialListingId);
  const fileInput = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<Photo[]>(
    initialPhotos.map((p) => ({ key: p, path: p, preview: storageUrl("listing-images", p), status: "done", isNew: false })),
  );
  const [v, setV] = useState({
    title: initial.title ?? "",
    category_id: initial.category_id ?? "",
    price: initial.price ?? "",
    is_free: initial.is_free ?? false,
    condition: (initial.condition as string | null) ?? "",
    listing_type: initial.listing_type ?? "fixed",
    negotiable: initial.negotiable ?? false,
    description: initial.description ?? "",
    brand: initial.brand ?? "",
    model: initial.model ?? "",
    purchase_date: initial.purchase_date ?? "",
    original_price: initial.original_price ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [step, setStep] = useState<"edit" | "preview">("edit");
  const [pending, start] = useTransition();
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((s) => ({ ...s, [k]: val }));
  const wanted = kind === "wanted";
  const uploading = photos.some((p) => p.status === "uploading");

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const supabase = createClient();
    const room = maxImages - photos.length;
    const list = Array.from(files).slice(0, Math.max(0, room));
    if (files.length > room) setFormError(`You can add up to ${maxImages} photos.`);
    for (const file of list) {
      const key = crypto.randomUUID();
      if (!IMAGE_RULES.types.includes(file.type)) {
        setFormError(`${file.name}: use a JPG, PNG or WebP photo.`);
        continue;
      }
      if (file.size > 15 * 1024 * 1024) {
        setFormError(`${file.name} is too large (max 15 MB before compression).`);
        continue;
      }
      const preview = URL.createObjectURL(file);
      setPhotos((p) => [...p, { key, preview, status: "uploading", isNew: true }]);
      try {
        // Always re-encoded: strips EXIF/GPS metadata and normalises to JPEG.
        const blob = await reencodeImage(file);
        if (blob.size > IMAGE_RULES.maxBytes) throw new Error("Photo is larger than 5 MB even after compression.");
        const path = `${userId}/${listingId}/${key}.jpg`;
        const { error } = await supabase.storage.from("listing-images").upload(path, blob, { contentType: "image/jpeg", upsert: false });
        if (error) throw error;
        setPhotos((p) => p.map((x) => (x.key === key ? { ...x, path, status: "done" } : x)));
      } catch (e) {
        setPhotos((p) => p.map((x) => (x.key === key ? { ...x, status: "error", error: (e as Error).message || "Upload failed" } : x)));
      }
    }
    if (fileInput.current) fileInput.current.value = "";
  }

  async function removePhoto(ph: Photo) {
    setPhotos((p) => p.filter((x) => x.key !== ph.key));
    // Saved photos are deleted on save; unsaved uploads are cleaned up now.
    if (ph.isNew && ph.path) await createClient().storage.from("listing-images").remove([ph.path]);
  }

  function payload(publish: boolean): ListingInput {
    return {
      id: listingId,
      kind,
      ...v,
      condition: wanted ? null : (v.condition as ListingInput["condition"]) || null,
      images: photos.filter((p) => p.status === "done" && p.path).map((p) => p.path!),
      publish,
    };
  }

  function validateLocal() {
    const e: Record<string, string> = {};
    if (!wanted && photos.filter((p) => p.status === "done").length === 0) e.images = "Add at least one photo.";
    if (v.title.trim().length < 3) e.title = "Title must be at least 3 characters.";
    if (!v.category_id) e.category_id = "Choose a category.";
    if (!wanted && !v.is_free && !rupeesToPaise(v.price)) e.price = "Enter a price in rupees, or mark the item as free.";
    if (!wanted && !v.condition) e.condition = "Choose the item's condition.";
    if (v.description.trim().length < 10) e.description = "Describe the item in at least 10 characters.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function submit(publish: boolean) {
    setFormError(undefined);
    start(async () => {
      const r = await saveListing(payload(publish));
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        setFormError(r.error);
        setStep("edit");
        return;
      }
      router.push(publish || isEdit ? `/product/${r.id}` : "/account/listings?tab=drafts");
      router.refresh();
    });
  }

  const priceText = wanted
    ? v.price
      ? `Budget ${formatPrice(rupeesToPaise(v.price))}`
      : "Budget open"
    : v.is_free
      ? "FREE"
      : formatPrice(rupeesToPaise(v.price));

  if (step === "preview") {
    const cover = photos.find((p) => p.status === "done");
    return (
      <div className="space-y-6">
        <div className="rounded-md border-2 border-ink bg-butter px-4 py-3 text-sm">
          <strong>Preview.</strong> This is how your listing will look to other {instituteName} members.
        </div>
        <div className="card grid gap-6 p-4 sm:grid-cols-2">
          <div className="relative aspect-square overflow-hidden rounded-md bg-paper">
            {cover ? (
              // Blob/object URLs are not supported by next/image optimisation.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cover.preview} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-muted">
                <ImageIcon size={48} />
              </div>
            )}
          </div>
          <div>
            {wanted && <span className="rounded bg-ink px-2 py-0.5 text-xs font-bold text-white">WANTED</span>}
            <h2 className="mt-1 font-display text-2xl font-extrabold">{v.title}</h2>
            <p className="mt-2 text-3xl font-black">{priceText}</p>
            <p className="mt-1 text-sm text-ink-soft">
              {!wanted && conditionLabel(v.condition)}
              {!wanted && !v.is_free && v.listing_type === "fixed_offers" ? " · offers accepted" : ""}
              {!wanted && !v.is_free && v.negotiable ? " · negotiable" : ""}
            </p>
            <p className="mt-1 text-sm text-ink-soft">{categories.find((c) => c.id === v.category_id)?.name}</p>
            <p className="mt-4 text-sm whitespace-pre-line">{v.description}</p>
            <p className="mt-4 text-xs text-muted">{photos.filter((p) => p.status === "done").length} photo(s)</p>
          </div>
        </div>
        {formError && (
          <p role="alert" className="rounded-md border-2 border-danger bg-danger-soft px-3 py-2 text-sm text-danger">
            {formError}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={() => setStep("edit")} disabled={pending}>
            ← Back to editing
          </button>
          <button type="button" className="btn-primary px-8" onClick={() => submit(true)} disabled={pending}>
            {pending ? "Publishing…" : isEdit ? "Save changes" : "Publish listing"}
          </button>
        </div>
      </div>
    );
  }

  const sectionH = "flex items-center gap-2 font-display text-lg font-bold";
  const num = "flex h-7 w-7 items-center justify-center rounded-full border-2 border-ink bg-sun text-sm";
  let n = 0;
  return (
    <form
      id={formId}
      noValidate
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (validateLocal()) {
          setStep("preview");
          window.scrollTo({ top: 0 });
        }
      }}
    >
      {formError && (
        <p role="alert" className="rounded-md border-2 border-danger bg-danger-soft px-3 py-2 text-sm text-danger">
          {formError}
        </p>
      )}

      <section className="card space-y-3 p-4 sm:p-5" aria-labelledby="s-photos">
        <h2 id="s-photos" className={sectionH}>
          <span className={num}>{++n}</span> Photos {wanted && <span className="text-sm font-normal text-muted">(optional)</span>}
        </h2>
        <p className="text-sm text-ink-soft">
          Up to {maxImages} clear photos, JPG/PNG/WebP. The first photo is the cover. Show any marks or damage honestly.
        </p>
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {photos.map((ph, i) => (
            <li key={ph.key} className="relative aspect-square overflow-hidden rounded-md border-2 border-ink bg-paper">
              {ph.isNew ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ph.preview} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
              ) : (
                <Image src={ph.preview} alt={`Photo ${i + 1}`} fill sizes="160px" className="object-cover" />
              )}
              {ph.status === "uploading" && <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-xs font-semibold">Uploading…</div>}
              {ph.status === "error" && (
                <div className="absolute inset-0 flex items-center justify-center bg-danger-soft/95 p-1 text-center text-[11px] text-danger">{ph.error}</div>
              )}
              {i === 0 && ph.status === "done" && <span className="absolute bottom-1 left-1 rounded bg-ink px-1.5 text-[10px] font-bold text-white">COVER</span>}
              <button type="button" onClick={() => removePhoto(ph)} className="absolute top-1 right-1 rounded-full border-2 border-ink bg-white p-0.5" aria-label={`Remove photo ${i + 1}`}>
                <CloseIcon size={14} />
              </button>
              {i > 0 && ph.status === "done" && (
                <button
                  type="button"
                  onClick={() => setPhotos((p) => [ph, ...p.filter((x) => x.key !== ph.key)])}
                  className="absolute bottom-1 left-1 rounded bg-white/90 px-1.5 text-[10px] font-semibold"
                >
                  Make cover
                </button>
              )}
            </li>
          ))}
          {photos.length < maxImages && (
            <li>
              <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-ink/60 bg-white text-center text-xs font-semibold hover:bg-butter focus-within:outline-3 focus-within:outline-sky">
                <ImageIcon size={26} />
                Add photos
                <input
                  ref={fileInput}
                  type="file"
                  accept={IMAGE_RULES.types.join(",")}
                  multiple
                  className="sr-only"
                  onChange={(e) => addFiles(e.target.files)}
                  aria-describedby={errors.images ? "images-error" : undefined}
                />
              </label>
            </li>
          )}
        </ul>
        {errors.images && (
          <p id="images-error" className="field-error">
            {errors.images}
          </p>
        )}
      </section>

      <section className="card space-y-4 p-4 sm:p-5" aria-labelledby="s-what">
        <h2 id="s-what" className={sectionH}>
          <span className={num}>{++n}</span> {wanted ? "What are you looking for?" : "What are you selling?"}
        </h2>
        <div>
          <label htmlFor="title" className="field-label">Title</label>
          <input id="title" className="input" maxLength={120} value={v.title} onChange={(e) => set("title", e.target.value)} placeholder={wanted ? "e.g. Engineering Mathematics by B.S. Grewal" : "e.g. Casio fx-991EX scientific calculator"} aria-invalid={Boolean(errors.title)} />
          {errors.title && <p className="field-error">{errors.title}</p>}
        </div>
        <div>
          <label htmlFor="category" className="field-label">Category</label>
          <select id="category" className="input" value={v.category_id} onChange={(e) => set("category_id", e.target.value)} aria-invalid={Boolean(errors.category_id)}>
            <option value="">Choose a category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {errors.category_id && <p className="field-error">{errors.category_id}</p>}
        </div>
      </section>

      <section className="card space-y-4 p-4 sm:p-5" aria-labelledby="s-price">
        <h2 id="s-price" className={sectionH}>
          <span className={num}>{++n}</span> {wanted ? "Budget" : "Price"}
        </h2>
        {!wanted && (
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={v.is_free} onChange={(e) => set("is_free", e.target.checked)} className="h-5 w-5 accent-black" />
            Give it away for free (₹0)
          </label>
        )}
        {!v.is_free && (
          <div>
            <label htmlFor="price" className="field-label">
              {wanted ? "Your budget (₹, optional)" : "Price (₹)"}
            </label>
            <div className="flex max-w-xs items-center rounded-md border-2 border-ink/75 bg-white focus-within:border-ink focus-within:outline-3 focus-within:outline-sky">
              <span className="pl-3 font-semibold" aria-hidden>₹</span>
              <input id="price" inputMode="decimal" className="min-h-11 w-full bg-transparent px-2 text-base outline-none" value={v.price} onChange={(e) => set("price", e.target.value)} placeholder="450" aria-invalid={Boolean(errors.price)} />
            </div>
            {errors.price && <p className="field-error">{errors.price}</p>}
          </div>
        )}
        {!wanted && !v.is_free && (
          <fieldset className="space-y-2">
            <legend className="field-label">How do you want to sell?</legend>
            <label className="flex items-start gap-2 text-sm">
              <input type="radio" name="lt" checked={v.listing_type === "fixed"} onChange={() => set("listing_type", "fixed")} className="mt-0.5 h-5 w-5 accent-black" />
              <span><strong>Fixed price</strong> — buyers message you to buy at this price.</span>
            </label>
            <label className={`flex items-start gap-2 text-sm ${offersEnabled ? "" : "opacity-50"}`}>
              <input type="radio" name="lt" disabled={!offersEnabled} checked={v.listing_type === "fixed_offers"} onChange={() => set("listing_type", "fixed_offers")} className="mt-0.5 h-5 w-5 accent-black" />
              <span><strong>Fixed price, offers welcome</strong> — buyers can send you a lower offer to accept, decline or counter.</span>
            </label>
            {v.listing_type === "fixed" && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={v.negotiable} onChange={(e) => set("negotiable", e.target.checked)} className="h-5 w-5 accent-black" />
                Show “price negotiable”
              </label>
            )}
          </fieldset>
        )}
      </section>

      {!wanted && (
        <section className="card space-y-3 p-4 sm:p-5" aria-labelledby="s-cond">
          <h2 id="s-cond" className={sectionH}>
            <span className={num}>{++n}</span> Condition
          </h2>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="s-cond">
            {CONDITIONS.map((c) => (
              <label key={c.id} className={`cursor-pointer rounded-md border-2 px-3 py-2 text-sm font-medium ${v.condition === c.id ? "border-ink bg-sun" : "border-ink/30 bg-white"} has-focus-visible:outline-3 has-focus-visible:outline-sky`}>
                <input type="radio" name="condition" value={c.id} checked={v.condition === c.id} onChange={() => set("condition", c.id)} className="sr-only" />
                {c.label}
              </label>
            ))}
          </div>
          {errors.condition && <p className="field-error">{errors.condition}</p>}
        </section>
      )}

      <section className="card space-y-4 p-4 sm:p-5" aria-labelledby="s-desc">
        <h2 id="s-desc" className={sectionH}>
          <span className={num}>{++n}</span> Description
        </h2>
        <div>
          <label htmlFor="description" className="field-label">Description</label>
          <textarea id="description" rows={5} maxLength={4000} className="input" value={v.description} onChange={(e) => set("description", e.target.value)} placeholder={wanted ? "Edition, condition you'd accept, when you need it…" : "What's included, how long you've used it, any defects…"} aria-invalid={Boolean(errors.description)} />
          <p className="field-hint">Don&apos;t include your phone number, email or room number. Buyers contact you through UniMart Messages.</p>
          {errors.description && <p className="field-error">{errors.description}</p>}
        </div>
        <details className="rounded-md border border-line bg-paper p-3">
          <summary className="cursor-pointer text-sm font-semibold">More details (optional)</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="brand" className="field-label">Brand</label>
              <input id="brand" className="input" maxLength={80} value={v.brand} onChange={(e) => set("brand", e.target.value)} />
            </div>
            <div>
              <label htmlFor="model" className="field-label">Model</label>
              <input id="model" className="input" maxLength={80} value={v.model} onChange={(e) => set("model", e.target.value)} />
            </div>
            {!wanted && (
              <>
                <div>
                  <label htmlFor="pdate" className="field-label">Purchase date</label>
                  <input id="pdate" type="date" className="input" value={v.purchase_date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => set("purchase_date", e.target.value)} />
                </div>
                <div>
                  <label htmlFor="oprice" className="field-label">Original price (₹)</label>
                  <input id="oprice" inputMode="decimal" className="input" value={v.original_price} onChange={(e) => set("original_price", e.target.value)} aria-invalid={Boolean(errors.original_price)} />
                  {errors.original_price && <p className="field-error">{errors.original_price}</p>}
                </div>
              </>
            )}
          </div>
        </details>
      </section>

      <div className="sticky bottom-16 z-10 flex flex-wrap justify-end gap-2 rounded-lg border-2 border-ink bg-paper p-3 shadow-hard md:bottom-3">
        {!isEdit && (
          <button type="button" className="btn-secondary" disabled={pending || uploading} onClick={() => submit(false)}>
            {pending ? "Saving…" : "Save draft"}
          </button>
        )}
        <button type="submit" className="btn-primary px-8" disabled={pending || uploading}>
          {uploading ? "Uploading photos…" : "Preview →"}
        </button>
      </div>
    </form>
  );
}
