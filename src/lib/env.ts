/** Public configuration (safe to expose to the browser). */
export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  defaultInstituteId: process.env.NEXT_PUBLIC_DEFAULT_INSTITUTE_ID ?? "nit-sikkim",
  /** Set to "true" only after Google is enabled in Supabase Auth (see docs/SETUP.md). */
  googleAuthEnabled: process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true",
};

export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);

export function storageUrl(bucket: "listing-images" | "avatars", path: string) {
  return `${env.supabaseUrl}/storage/v1/object/public/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`;
}
