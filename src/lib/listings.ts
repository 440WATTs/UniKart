import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { PAGE_SIZE } from "@/lib/constants";
import type { Category, Listing, ListingCard } from "@/lib/types";
import { toPrefixQuery } from "@/lib/search-query";

export const CARD_SELECT =
  "id, title, kind, price_paise, condition, listing_type, status, is_demo, created_at, published_at, category_id, institute_id, " +
  "seller:profiles!listings_seller_id_fkey(id, display_name, avatar_url, verified_institute_id, is_demo), " +
  "images:listing_images(storage_path, position)";

export const DETAIL_SELECT =
  "id, seller_id, title, kind, description, price_paise, condition, listing_type, negotiable, brand, model, purchase_date, " +
  "original_price_paise, status, removed_by_moderator, is_demo, created_at, published_at, sold_at, updated_at, category_id, institute_id, " +
  "seller:profiles!listings_seller_id_fkey(id, display_name, avatar_url, account_type, verified_institute_id, is_demo, created_at), " +
  "images:listing_images(id, storage_path, position)";

function sortImages<T extends { images: { position: number }[] }>(rows: T[]): T[] {
  rows.forEach((r) => r.images?.sort((a, b) => a.position - b.position));
  return rows;
}

export const getCategories = cache(async (): Promise<Category[]> => {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("categories").select("*").eq("is_active", true).order("sort_order");
  // Menus degrade to empty rather than taking down every page; the failure is still logged.
  if (error) console.error(JSON.stringify({ level: "error", scope: "categories", message: error.message }));
  return (data as Category[] | null) ?? [];
});

export { toPrefixQuery } from "@/lib/search-query";

export interface SearchParams {
  q?: string;
  category?: string;
  min?: string;
  max?: string;
  condition?: string;
  type?: string; // fixed | offers | free
  availability?: string; // available | all
  sort?: string;
  page?: string;
  kind?: string; // sale | wanted
}

export async function searchListings(instituteId: string, params: SearchParams) {
  const supabase = await createClient();
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  let query = supabase
    .from("listings")
    .select(CARD_SELECT, { count: "exact" })
    .eq("institute_id", instituteId)
    .eq("kind", params.kind === "wanted" ? "wanted" : "sale");

  if (params.availability === "all") query = query.in("status", ["active", "reserved", "sold"]);
  else query = query.eq("status", "active");

  const tsq = params.q ? toPrefixQuery(params.q) : "";
  if (tsq) query = query.textSearch("search", tsq, { config: "english" });
  if (params.category) query = query.eq("category_id", params.category);

  const min = Number(params.min);
  const max = Number(params.max);
  if (params.min && Number.isFinite(min) && min >= 0) query = query.gte("price_paise", Math.round(min * 100));
  if (params.max && Number.isFinite(max) && max >= 0) query = query.lte("price_paise", Math.round(max * 100));

  const conditions = (params.condition ?? "").split(",").filter(Boolean);
  if (conditions.length) query = query.in("condition", conditions);

  if (params.type === "free") query = query.eq("price_paise", 0);
  else if (params.type === "offers") query = query.eq("listing_type", "fixed_offers");
  else if (params.type === "fixed") query = query.eq("listing_type", "fixed").gt("price_paise", 0);

  if (params.sort === "price_asc") query = query.order("price_paise", { ascending: true }).order("created_at", { ascending: false });
  else if (params.sort === "price_desc") query = query.order("price_paise", { ascending: false }).order("created_at", { ascending: false });
  else query = query.order("created_at", { ascending: false });

  const from = (page - 1) * PAGE_SIZE;
  const { data, count, error } = await query.range(from, from + PAGE_SIZE - 1);
  // PostgREST answers 416 / PGRST103 when the offset is beyond the last row.
  if (error?.code === "PGRST103") {
    return { listings: [] as ListingCard[], total: count ?? 0, page, pages: Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE)), error: null, outOfRange: true };
  }
  return {
    outOfRange: false,
    listings: sortImages((data as unknown as ListingCard[] | null) ?? []),
    total: count ?? 0,
    page,
    pages: Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE)),
    error: error?.message ?? null,
  };
}

export async function recentListings(
  instituteId: string,
  opts: { limit?: number; kind?: "sale" | "wanted"; free?: boolean; category?: string; excludeId?: string } = {},
) {
  const supabase = await createClient();
  let q = supabase
    .from("listings")
    .select(CARD_SELECT)
    .eq("institute_id", instituteId)
    .eq("kind", opts.kind ?? "sale")
    .eq("status", "active");
  if (opts.free) q = q.eq("price_paise", 0);
  if (opts.category) q = q.eq("category_id", opts.category);
  if (opts.excludeId) q = q.neq("id", opts.excludeId);
  const { data, error } = await q.order("created_at", { ascending: false }).limit(opts.limit ?? 10);
  if (error) throw new Error(`listing query failed: ${error.code ?? ""} ${error.message}`);
  return sortImages((data as unknown as ListingCard[] | null) ?? []);
}

export async function getListing(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("listings").select(DETAIL_SELECT).eq("id", id).maybeSingle();
  // A failed query is an outage, not a missing listing: let the error boundary show it.
  if (error) throw new Error(`listing query failed: ${error.code ?? ""} ${error.message}`);
  if (!data) return null;
  return sortImages([data as unknown as Listing])[0];
}

export async function savedIdsFor(userId: string | undefined, ids: string[]) {
  if (!userId || ids.length === 0) return new Set<string>();
  const supabase = await createClient();
  const { data } = await supabase.from("saved_listings").select("listing_id").eq("user_id", userId).in("listing_id", ids);
  return new Set((data ?? []).map((r: { listing_id: string }) => r.listing_id));
}
