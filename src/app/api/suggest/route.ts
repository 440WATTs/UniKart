import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { env, isSupabaseConfigured } from "@/lib/env";
import { getCategories } from "@/lib/listings";

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 60);
  if (!isSupabaseConfigured || q.length < 2) return NextResponse.json({ suggestions: [] });

  // Escape LIKE wildcards so user input is matched literally.
  const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const supabase = await createClient();
  const [{ data }, categories] = await Promise.all([
    supabase
      .from("listings")
      .select("title")
      .eq("institute_id", env.defaultInstituteId)
      .eq("status", "active")
      .ilike("title", pattern)
      .order("created_at", { ascending: false })
      .limit(12),
    getCategories(),
  ]);

  const seen = new Set<string>();
  const titles = (data ?? [])
    .map((r: { title: string }) => r.title)
    .filter((t) => {
      const k = t.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 6)
    .map((t) => ({ type: "listing", label: t, href: `/search?q=${encodeURIComponent(t)}` }));
  const cats = categories
    .filter((c) => c.name.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 2)
    .map((c) => ({ type: "category", label: c.name, href: `/search?category=${c.id}` }));

  return NextResponse.json({ suggestions: [...cats, ...titles] }, { headers: { "Cache-Control": "private, max-age=30" } });
}
