/**
 * Grants the first administrator role (later admins can be managed in /admin/users).
 *
 *   npm run make-admin -- someone@example.com [moderator]
 *
 * Roles live in the user_roles table, which users cannot write to, so this
 * needs the service-role key and must be run by whoever operates the project.
 */
import { createClient } from "@supabase/supabase-js";

const [email, role = "admin"] = process.argv.slice(2);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!email || !["admin", "moderator"].includes(role)) {
  console.error("Usage: npm run make-admin -- <email> [admin|moderator]");
  process.exit(1);
}
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

(async () => {
  const { data, error } = await db.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) throw new Error(`No user with email ${email}. Sign up first.`);
  const { error: e2 } = await db.from("user_roles").upsert({ user_id: user.id, role });
  if (e2) throw e2;
  await db.from("audit_events").insert({ actor_id: null, event: "role.grant", entity_type: "user", entity_id: user.id, data: { role, via: "make-admin script" } });
  console.log(`Granted ${role} to ${email}.`);
})().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
