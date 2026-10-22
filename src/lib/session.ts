import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { env, isSupabaseConfigured } from "@/lib/env";
import type { Institute, Membership, Profile } from "@/lib/types";

export interface Viewer {
  id: string;
  email: string | null;
  profile: Profile | null;
  membership: Membership | null;
  isVerified: boolean;
  isSuspended: boolean;
  roles: string[];
  isStaff: boolean;
  isAdmin: boolean;
}

/**
 * The signed-in user. getClaims() verifies the JWT signature (locally with
 * asymmetric signing keys, otherwise via the Auth server), so the cookie alone
 * is never trusted. Profile, memberships and roles come from one RPC.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data: auth, error } = await supabase.auth.getClaims();
  const claims = auth?.claims;
  if (error || !claims?.sub) return null;

  const { data } = await supabase.rpc("my_context");
  const ctx = (data as { profile: Profile | null; memberships: Membership[]; roles: string[] } | null) ?? null;
  const p = ctx?.profile ?? null;
  const ms = ctx?.memberships ?? [];
  const instituteId = p?.home_institute_id ?? env.defaultInstituteId;
  const membership = ms.find((m) => m.institute_id === instituteId) ?? ms[0] ?? null;
  const roleList = ctx?.roles ?? [];
  return {
    id: claims.sub,
    email: (claims.email as string | undefined) ?? null,
    profile: p,
    membership,
    isVerified: membership?.status === "verified" && !p?.suspended_at,
    isSuspended: Boolean(p?.suspended_at),
    roles: roleList,
    isStaff: roleList.length > 0,
    isAdmin: roleList.includes("admin"),
  };
});

export async function requireViewer(next: string) {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(next)}`);
  return viewer;
}

export const getInstitute = cache(async (id: string = env.defaultInstituteId): Promise<Institute | null> => {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("institutes").select("*").eq("id", id).maybeSingle();
  // An outage must not look like "not configured"; let the error boundary handle it.
  if (error) throw new Error(`institute query failed: ${error.code ?? ""} ${error.message}`);
  return (data as Institute | null) ?? null;
});

export const getInstitutes = cache(async (): Promise<Institute[]> => {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("institutes").select("*").order("display_name");
  if (error) throw new Error(`institutes query failed: ${error.code ?? ""} ${error.message}`);
  return (data as Institute[] | null) ?? [];
});

export function displayName(p: { display_name?: string | null; full_name?: string | null } | null | undefined) {
  return p?.display_name || p?.full_name?.split(" ")[0] || "Member";
}

export const getUnreadCounts = cache(async (userId: string | undefined) => {
  if (!userId) return { messages: 0, notifications: 0 };
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_unread_counts");
  const c = (data as { messages?: number; notifications?: number } | null) ?? {};
  return { messages: c.messages ?? 0, notifications: c.notifications ?? 0 };
});
