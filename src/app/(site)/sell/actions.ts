"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/session";
import { CONDITIONS, IMAGE_RULES } from "@/lib/constants";
import { rupeesToPaise } from "@/lib/format";
import { friendlyDbError } from "@/app/(site)/actions";
import { logError } from "@/lib/log";

const listingSchema = z
  .object({
    id: z.string().uuid(),
    kind: z.enum(["sale", "wanted"]),
    title: z.string().trim().min(3, "Title must be at least 3 characters.").max(120),
    category_id: z.string().min(1, "Choose a category."),
    price: z.string().trim(),
    is_free: z.boolean(),
    condition: z.enum(CONDITIONS.map((c) => c.id) as [string, ...string[]]).nullable(),
    listing_type: z.enum(["fixed", "fixed_offers"]),
    negotiable: z.boolean(),
    description: z.string().trim().min(10, "Describe the item in at least 10 characters.").max(4000),
    brand: z.string().trim().max(80).optional(),
    model: z.string().trim().max(80).optional(),
    purchase_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
    original_price: z.string().trim().optional(),
    images: z.array(z.string()).max(IMAGE_RULES.maxFiles),
    publish: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "sale") {
      if (!v.condition) ctx.addIssue({ code: "custom", path: ["condition"], message: "Choose the item's condition." });
      if (!v.is_free && rupeesToPaise(v.price) == null)
        ctx.addIssue({ code: "custom", path: ["price"], message: "Enter a price in rupees, or mark the item as free." });
      if (!v.is_free && rupeesToPaise(v.price) === 0)
        ctx.addIssue({ code: "custom", path: ["price"], message: "For ₹0, tick “Give it away for free”." });
      if (v.publish && v.images.length === 0) ctx.addIssue({ code: "custom", path: ["images"], message: "Add at least one photo." });
    } else if (v.price && rupeesToPaise(v.price) == null) {
      ctx.addIssue({ code: "custom", path: ["price"], message: "Enter a budget in rupees or leave it empty." });
    }
    if (v.original_price && rupeesToPaise(v.original_price) == null)
      ctx.addIssue({ code: "custom", path: ["original_price"], message: "Enter a number in rupees." });
  });

export type ListingInput = z.input<typeof listingSchema>;
export type SaveResult = { ok: boolean; id?: string; error?: string; fieldErrors?: Record<string, string> };

/**
 * Creates or updates a listing. The seller, institute and timestamps are set
 * server-side (and again by database triggers); client values for them are ignored.
 */
export async function saveListing(input: ListingInput): Promise<SaveResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Please log in again." };
  if (!viewer.isVerified || !viewer.membership) return { ok: false, error: "Only verified institute members can publish listings." };

  const parsed = listingSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const v = parsed.data;
  // Photos must have been uploaded by this user into this listing's folder.
  const prefix = `${viewer.id}/${v.id}/`;
  if (v.images.some((p) => !p.startsWith(prefix) || p.includes(".."))) return { ok: false, error: "One of the photos is invalid. Please re-upload it." };

  const supabase = await createClient();
  const { data: before } = await supabase.from("listing_images").select("storage_path").eq("listing_id", v.id);

  const pricePaise = v.kind === "sale" ? (v.is_free ? 0 : rupeesToPaise(v.price)) : v.price ? rupeesToPaise(v.price) : null;
  const fields = {
    title: v.title,
    description: v.description,
    category_id: v.category_id,
    price_paise: pricePaise,
    condition: v.kind === "sale" ? v.condition : null,
    listing_type: v.kind === "sale" && !v.is_free ? v.listing_type : "fixed",
    negotiable: v.kind === "sale" && !v.is_free && v.negotiable,
    brand: v.brand || null,
    model: v.model || null,
    purchase_date: v.purchase_date || null,
    original_price_paise: v.original_price ? rupeesToPaise(v.original_price) : null,
  };
  // One transaction: listing, photos and publishing succeed or fail together.
  // Retries with the same id update the same listing (idempotent).
  const { error } = await supabase.rpc("save_listing", {
    p_id: v.id,
    p_kind: v.kind,
    p_institute: viewer.membership.institute_id,
    p_fields: fields,
    p_images: v.images,
    p_publish: v.publish,
  });
  if (error) return { ok: false, error: await friendlyDbError(error.message) };

  // Best effort: delete files for photos the seller removed. A failure only leaves an orphaned file.
  const removed = (before ?? []).map((r: { storage_path: string }) => r.storage_path).filter((path) => !v.images.includes(path));
  if (removed.length) {
    const { error: rmError } = await supabase.storage.from("listing-images").remove(removed);
    if (rmError) await logError("listing.images.remove", rmError.message, { listingId: v.id });
  }

  revalidatePath("/marketplace");
  revalidatePath(`/product/${v.id}`);
  revalidatePath("/account/listings");
  return { ok: true, id: v.id };
}

const STATUS_CHANGES = ["active", "reserved", "sold", "draft", "removed"] as const;

export async function setListingStatus(id: string, status: (typeof STATUS_CHANGES)[number]): Promise<{ ok: boolean; error?: string }> {
  if (!z.string().uuid().safeParse(id).success || !STATUS_CHANGES.includes(status)) return { ok: false, error: "Invalid request." };
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Please log in again." };
  const supabase = await createClient();
  // RLS limits this to the caller's own listings; triggers enforce allowed transitions.
  const { data, error } = await supabase.from("listings").update({ status }).eq("id", id).eq("seller_id", viewer.id).select("id");
  if (error) return { ok: false, error: await friendlyDbError(error.message) };
  if (!data?.length) return { ok: false, error: "Listing not found." };
  revalidatePath(`/product/${id}`);
  revalidatePath("/account/listings");
  revalidatePath("/marketplace");
  revalidatePath("/saved");
  return { ok: true };
}

export async function deleteDraft(id: string): Promise<{ ok: boolean; error?: string }> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Please log in again." };
  const supabase = await createClient();
  const { data: imgs } = await supabase.from("listing_images").select("storage_path").eq("listing_id", id);
  const { data, error } = await supabase.from("listings").delete().eq("id", id).eq("seller_id", viewer.id).eq("status", "draft").select("id");
  if (error) return { ok: false, error: await friendlyDbError(error.message) };
  if (!data?.length) return { ok: false, error: "Only drafts can be deleted. Remove the listing instead." };
  if (imgs?.length) await supabase.storage.from("listing-images").remove(imgs.map((i: { storage_path: string }) => i.storage_path));
  revalidatePath("/account/listings");
  return { ok: true };
}
