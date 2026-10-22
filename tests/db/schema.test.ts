/**
 * Database authorization tests. Runs every migration in an embedded Postgres
 * (PGlite) on top of a Supabase stub and exercises the rules as real roles:
 * anon, authenticated users and the service role.
 *
 *   npm run test:db
 */
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { before, describe, it } from "node:test";
import assert from "node:assert/strict";

const root = process.cwd();
const db = new PGlite({ extensions: { pg_trgm } });

const A = "00000000-0000-4000-8000-00000000000a"; // seller, verified
const B = "00000000-0000-4000-8000-00000000000b"; // buyer, verified
const C = "00000000-0000-4000-8000-00000000000c"; // unverified
const D = "00000000-0000-4000-8000-00000000000d"; // admin
const E = "00000000-0000-4000-8000-00000000000e"; // second buyer, verified

type Who = string | "anon" | "service";

/** Run a query as a given principal, like PostgREST would. */
async function as<T = Record<string, unknown>>(who: Who, sql: string, params: unknown[] = []) {
  return db.transaction(async (tx) => {
    if (who === "anon") {
      await tx.query("select set_config('request.jwt.claim.sub', '', true)");
      await tx.query("set local role anon");
    } else if (who === "service") {
      await tx.query("select set_config('request.jwt.claim.sub', '', true)");
      await tx.query("set local role service_role");
    } else {
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [who]);
      await tx.query("set local role authenticated");
    }
    const r = await tx.query<T>(sql, params);
    return r.rows;
  });
}

async function rejects(p: Promise<unknown>, pattern: RegExp) {
  await assert.rejects(p, (e: Error) => {
    assert.match(e.message, pattern);
    return true;
  });
}

const one = async (who: Who, sql: string, params: unknown[] = []) => (await as(who, sql, params))[0];

before(async () => {
  await db.exec(readFileSync(join(root, "tests/db/supabase-stub.sql"), "utf8"));
  const dir = join(root, "supabase/migrations");
  for (const f of readdirSync(dir).sort()) {
    await db.exec(readFileSync(join(dir, f), "utf8"));
  }
  for (const [id, name] of [[A, "Asha Seller"], [B, "Bilal Buyer"], [C, "Chen Unverified"], [D, "Dev Admin"], [E, "Esha Buyer"]]) {
    await db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [
      id, `${id.slice(-1)}@example.com`, JSON.stringify({ full_name: name }),
    ]);
  }
  await db.query("insert into public.user_roles (user_id, role) values ($1, 'admin')", [D]);
});

describe("profiles", () => {
  it("are created for new auth users", async () => {
    const p = await one(A, "select display_name, full_name from profiles where id = $1", [A]);
    assert.deepEqual(p, { display_name: "Asha", full_name: "Asha Seller" });
  });

  it("let users edit their own safe fields only", async () => {
    await as(A, "update profiles set department = 'ECE', academic_year = '2nd year' where id = $1", [A]);
    assert.equal((await one(A, "select department from profiles where id = $1", [A]))!.department, "ECE");
    await rejects(as(A, "update profiles set verified_institute_id = 'nit-sikkim' where id = $1", [A]), /permission denied/);
    await rejects(as(A, "update profiles set suspended_at = null where id = $1", [A]), /permission denied/);
    const r = await as(A, "update profiles set department = 'hack' where id = $1 returning id", [B]);
    assert.equal(r.length, 0);
  });

  it("hide private columns from anonymous visitors", async () => {
    await rejects(as("anon", "select full_name from profiles"), /permission denied/);
    // Audit M3: members without a public listing are not visible to visitors.
    const r = await as("anon", "select display_name from profiles where id = $1", [A]);
    assert.equal(r.length, 0);
  });

  it("cannot self-grant roles", async () => {
    await rejects(as(A, "insert into user_roles (user_id, role) values ($1, 'admin')", [A]), /permission denied/);
    await rejects(as(A, "select set_user_role($1, 'admin', true)", [A]), /forbidden/);
  });
});

describe("institute verification", () => {
  it("refuses email verification until the domain is confirmed", async () => {
    await rejects(
      as("service", "select membership_request_email_code($1, 'nit-sikkim', 'a1@nitsikkim.ac.in', 'h')", [A]),
      /email_domain_not_accepted/,
    );
  });

  it("lets only an admin confirm the domain", async () => {
    const r = await as(A, "update institutes set email_domains_confirmed = true where id = 'nit-sikkim' returning id");
    assert.equal(r.length, 0);
    await as(D, "update institutes set email_domains_confirmed = true where id = 'nit-sikkim'");
    const audit = await one("service", "select count(*)::int n from audit_events where entity_type = 'institutes'");
    assert.ok((audit!.n as number) >= 1);
  });

  it("is not callable by end users", async () => {
    await rejects(
      as(A, "select membership_request_email_code($1, 'nit-sikkim', 'a1@nitsikkim.ac.in', 'h')", [A]),
      /permission denied/,
    );
    await rejects(as(C, "select * from membership_email_codes"), /permission denied/);
  });

  it("rejects other domains", async () => {
    await rejects(
      as("service", "select membership_request_email_code($1, 'nit-sikkim', 'c@gmail.com', 'h')", [C]),
      /email_domain_not_accepted/,
    );
  });

  it("verifies with the right code only", async () => {
    await as("service", "select membership_request_email_code($1, 'nit-sikkim', 'A1@NITSikkim.ac.in', 'good')", [A]);
    const pending = await one(A, "select status from institute_memberships where user_id = $1", [A]);
    assert.equal(pending!.status, "pending");
    assert.equal((await one("service", "select membership_confirm_email_code($1, 'nit-sikkim', 'bad') r", [A]))!.r, "invalid");
    assert.equal((await one("service", "select membership_confirm_email_code($1, 'nit-sikkim', 'good') r", [A]))!.r, "verified");
    // home_institute_id is only readable through my_context() (audit M3).
    const ctx = (await one(A, "select my_context() c"))!.c as { profile: Record<string, string> };
    assert.equal(ctx.profile.verified_institute_id, "nit-sikkim");
    assert.equal(ctx.profile.home_institute_id, "nit-sikkim");
    const n = await as(A, "select title from notifications where type = 'verification'");
    assert.equal(n.length, 1);
  });

  it("does not let one institute email verify two accounts", async () => {
    await rejects(
      as("service", "select membership_request_email_code($1, 'nit-sikkim', 'a1@nitsikkim.ac.in', 'x')", [B]),
      /email_already_used/,
    );
  });

  it("locks out after five wrong codes", async () => {
    await as("service", "select membership_request_email_code($1, 'nit-sikkim', 'e1@nitsikkim.ac.in', 'right')", [E]);
    for (let i = 0; i < 5; i++) await as("service", "select membership_confirm_email_code($1, 'nit-sikkim', 'wrong')", [E]);
    assert.equal(
      (await one("service", "select membership_confirm_email_code($1, 'nit-sikkim', 'right') r", [E]))!.r,
      "too_many_attempts",
    );
  });

  it("supports manual review by staff", async () => {
    await as(B, "select request_manual_review('nit-sikkim', 'First-year student, roll number B250099')");
    const m = await one(B, "select id, status, method from institute_memberships where user_id = $1", [B]);
    assert.equal(m!.status, "pending");
    await rejects(as(C, "select review_membership($1, 'verified', 'ok')", [m!.id]), /forbidden/);
    await as(D, "select review_membership($1, 'verified', 'Checked ID card')", [m!.id]);
    assert.equal((await one(B, "select status from institute_memberships where user_id = $1", [B]))!.status, "verified");
    // Verify E the same way for the offer tests.
    await as(E, "select request_manual_review('nit-sikkim', 'Staff member, admin office')");
    const me = await one(D, "select id from institute_memberships where user_id = $1", [E]);
    await as(D, "select review_membership($1, 'verified', 'ok')", [me!.id]);
  });

  it("cannot be bypassed for an inactive institute", async () => {
    await db.query(
      "insert into institutes (id, official_name, display_name, short_name, is_active) values ('other-inst', 'Other', 'Other', 'OI', false)",
    );
    await rejects(as(C, "select request_manual_review('other-inst', 'please let me in now')"), /institute_not_available/);
  });
});

let listing: string;

describe("listings", () => {
  const insert = `insert into listings (institute_id, title, description, category_id, price_paise, condition, listing_type, status)
                  values ($1, $2, 'A well kept item, works perfectly.', 'study', $3, 'good', $4, 'active') returning id, seller_id, is_demo`;

  it("cannot be published by unverified users", async () => {
    await rejects(as(C, insert, ["nit-sikkim", "Calculator", 45000, "fixed"]), /row-level security/);
  });

  it("are owned by the publisher regardless of client input", async () => {
    const r = await one(A, insert, ["nit-sikkim", "Scientific Calculator fx-991", 50000, "fixed_offers"]);
    assert.equal(r!.seller_id, A);
    assert.equal(r!.is_demo, false);
    listing = r!.id as string;
    await rejects(
      as(A, "insert into listings (seller_id, institute_id, title, description, category_id, price_paise, condition) values ($1, 'nit-sikkim', 'x', 'y', 'study', 1, 'good')", [B]),
      /permission denied/,
    );
  });

  it("cannot be created for another institute", async () => {
    await rejects(as(A, insert, ["other-inst", "Lamp", 30000, "fixed"]), /row-level security/);
  });

  it("cannot be edited by someone else", async () => {
    const r = await as(B, "update listings set price_paise = 1 where id = $1 returning id", [listing]);
    assert.equal(r.length, 0);
    await rejects(as(A, "update listings set is_demo = true where id = $1", [listing]), /permission denied/);
  });

  it("are visible to anonymous visitors only when published", async () => {
    assert.equal((await as("anon", "select id from listings where id = $1", [listing])).length, 1);
    const d = await one(A, `insert into listings (institute_id, title, description, category_id, price_paise, condition, status)
                            values ('nit-sikkim', 'Draft lamp', 'Desk lamp with LED bulb.', 'hostel', 30000, 'good', 'draft') returning id`);
    assert.equal((await as("anon", "select id from listings where id = $1", [d!.id])).length, 0);
    assert.equal((await as(B, "select id from listings where id = $1", [d!.id])).length, 0);
    assert.equal((await as(A, "select id from listings where id = $1", [d!.id])).length, 1);
  });

  it("are found by prefix full-text search", async () => {
    const r = await as("anon", "select title from listings where search @@ to_tsquery('english', 'calc:*')");
    assert.equal(r.length, 1);
  });

  it("only accept images from the owner's storage folder", async () => {
    await as(A, "insert into listing_images (listing_id, storage_path) values ($1, $2)", [listing, `${A}/one.jpg`]);
    await rejects(
      as(A, "insert into listing_images (listing_id, storage_path) values ($1, $2)", [listing, `${B}/x.jpg`]),
      /invalid_image_path/,
    );
    await rejects(
      as(B, "insert into listing_images (listing_id, storage_path) values ($1, $2)", [listing, `${B}/x.jpg`]),
      /row-level security|not_owner/,
    );
  });

  it("enforces storage folder ownership", async () => {
    await as(A, "insert into storage.objects (bucket_id, name) values ('listing-images', $1)", [`${A}/two.jpg`]);
    await rejects(
      as(A, "insert into storage.objects (bucket_id, name) values ('listing-images', $1)", [`${B}/two.jpg`]),
      /row-level security/,
    );
  });
});

let conv: string;

describe("saved items and messaging", () => {
  it("keeps saved items private", async () => {
    await as(B, "insert into saved_listings (user_id, listing_id) values ($1, $2)", [B, listing]);
    assert.equal((await as(C, "select * from saved_listings")).length, 0);
    await rejects(as(C, "insert into saved_listings (user_id, listing_id) values ($1, $2)", [B, listing]), /row-level security/);
  });

  it("requires verification to contact a seller", async () => {
    await rejects(as(C, "select start_conversation($1)", [listing]), /not_verified/);
    await rejects(as(A, "select start_conversation($1)", [listing]), /own_listing/);
  });

  it("lets participants talk and nobody else read", async () => {
    conv = (await one(B, "select start_conversation($1) id", [listing]))!.id as string;
    assert.equal((await one(B, "select start_conversation($1) id", [listing]))!.id, conv, "idempotent");
    await as(B, "insert into messages (conversation_id, body) values ($1, 'Is this still available?')", [conv]);
    await as(A, "insert into messages (conversation_id, body) values ($1, 'Yes!')", [conv]);
    assert.equal((await as(A, "select body from messages where conversation_id = $1", [conv])).length, 2);
    assert.equal((await as(C, "select body from messages where conversation_id = $1", [conv])).length, 0);
    assert.equal((await as(C, "select id from conversations where id = $1", [conv])).length, 0);
    await rejects(as(C, "insert into messages (conversation_id, body) values ($1, 'hi')", [conv]), /not_participant/);
    await rejects(as("anon", "select * from messages"), /permission denied/);
  });

  it("does not allow spoofing the sender or message kind", async () => {
    const r = await one(B, "insert into messages (conversation_id, body) values ($1, 'x') returning sender_id, kind", [conv]);
    assert.equal(r!.sender_id, B);
    await rejects(as(B, "insert into messages (conversation_id, body, sender_id) values ($1, 'x', $2)", [conv, A]), /permission denied/);
  });

  it("notifies and tracks unread", async () => {
    const n = await as(A, "select type from notifications where type = 'message'");
    assert.equal(n.length, 1, "collapsed into one notification per conversation");
    assert.equal((await one(A, "select unread_conversation_count() n"))!.n, 1);
    await as(A, "select mark_conversation_read($1)", [conv]);
    assert.equal((await one(A, "select unread_conversation_count() n"))!.n, 0);
  });

  it("blocks stop messages", async () => {
    await as(A, "insert into blocks (blocker_id, blocked_id) values ($1, $2)", [A, B]);
    await rejects(as(B, "insert into messages (conversation_id, body) values ($1, 'hello?')", [conv]), /blocked/);
    await as(A, "delete from blocks where blocked_id = $1", [B]);
  });

  it("only lets notifications be marked read", async () => {
    await rejects(as(A, "update notifications set title = 'x'"), /permission denied/);
    const r = await as(A, "update notifications set read_at = now() returning id");
    assert.ok(r.length >= 1);
    assert.equal((await as(C, "update notifications set read_at = now() where user_id = $1 returning id", [A])).length, 0);
  });
});

describe("offers", () => {
  it("validate amount and turn order", async () => {
    await rejects(as(B, "select make_offer($1, 60000)", [listing]), /invalid_amount/);
    await rejects(as(C, "select make_offer($1, 40000)", [listing]), /not_verified/);
    const o = (await one(B, "select make_offer($1, 40000) id", [listing]))!.id;
    await rejects(as(B, "select make_offer($1, 41000)", [listing]), /offer_already_pending/);
    await rejects(as(B, "select respond_offer($1, 'accept')", [o]), /not_your_turn/);
    await rejects(as(C, "select respond_offer($1, 'accept')", [o]), /offer_not_found/);
    assert.equal((await as(C, "select * from offers")).length, 0);
  });

  it("support counteroffers and a single acceptance", async () => {
    const first = (await one(B, "select id from offers where buyer_id = $1 and status = 'pending'", [B]))!.id;
    const counter = (await one(A, "select respond_offer($1, 'counter', 45000) id", [first]))!.id;
    const eOffer = (await one(E, "select make_offer($1, 42000) id", [listing]))!.id;
    await one(B, "select respond_offer($1, 'accept')", [counter]);
    const l = await one("anon", "select status from listings where id = $1", [listing]);
    assert.equal(l!.status, "reserved");
    assert.equal((await one(E, "select status from offers where id = $1", [eOffer]))!.status, "cancelled");
    await rejects(as(A, "select respond_offer($1, 'accept')", [eOffer]), /offer_not_pending/);
    await rejects(as(E, "select make_offer($1, 30000)", [listing]), /listing_unavailable/);
    const accepted = await as("service", "select id from offers where listing_id = $1 and status = 'accepted'", [listing]);
    assert.equal(accepted.length, 1);
    const types = (await as(B, "select type from notifications")).map((r) => r.type);
    assert.ok(types.includes("offer_countered"));
  });

  it("are rejected on fixed-price listings", async () => {
    const f = await one(A, `insert into listings (institute_id, title, description, category_id, price_paise, condition, listing_type, status)
                            values ('nit-sikkim', 'Engineering Mathematics', 'B.S. Grewal, 44th edition.', 'books', 25000, 'good', 'fixed', 'active') returning id`);
    await rejects(as(B, "select make_offer($1, 20000)", [f!.id]), /offers_not_enabled/);
  });
});

describe("selling and status", () => {
  it("notifies savers when sold", async () => {
    await as(A, "update listings set status = 'sold' where id = $1", [listing]);
    const r = await one("anon", "select status, sold_at is not null as has_sold_at from listings where id = $1", [listing]);
    assert.deepEqual(r, { status: "sold", has_sold_at: true });
    const n = await as(B, "select type from notifications where type = 'listing_sold'");
    assert.equal(n.length, 1);
  });

  it("free listings must be fixed price", async () => {
    await rejects(
      as(A, `insert into listings (institute_id, title, description, category_id, price_paise, condition, listing_type, status)
             values ('nit-sikkim', 'Free lamp', 'Old lamp, still works.', 'hostel', 0, 'fair', 'fixed_offers', 'active')`),
      /free_is_fixed/,
    );
  });

  it("wanted listings carry a budget and no condition", async () => {
    const w = await one(B, `insert into listings (institute_id, kind, title, description, category_id, price_paise, condition, status)
                            values ('nit-sikkim', 'wanted', 'Engineering Mathematics', 'Need a copy for semester 2.', 'books', 30000, 'good', 'active')
                            returning condition`);
    assert.equal(w!.condition, null);
  });
});

describe("moderation", () => {
  it("is staff-only and audited", async () => {
    await rejects(as(B, "select admin_metrics()"), /forbidden/);
    await rejects(as(B, "select moderate_listing($1, 'remove', 'spam')", [listing]), /forbidden/);
    await as(B, "insert into reports (listing_id, reason, details) values ($1, 'misleading', 'Wrong model')", [listing]);
    const rep = await one(B, "select id, reporter_id, status from reports");
    assert.equal(rep!.reporter_id, B);
    assert.equal((await as(C, "select * from reports")).length, 0);
    await as(D, "select moderate_listing($1, 'remove', 'Misleading title', $2)", [listing, rep!.id]);
    await as(D, "select resolve_report($1, 'actioned', 'Removed')", [rep!.id]);
    await rejects(as(A, "update listings set status = 'active' where id = $1", [listing]), /listing_removed_by_moderator/);
    const m = await one(D, "select admin_metrics() m");
    assert.equal((m!.m as Record<string, number>).open_reports, 0);
    assert.ok((await as(D, "select * from audit_events where event = 'listing.remove'")).length === 1);
    assert.equal((await as(B, "select * from audit_events")).length, 0);
  });

  it("suspension removes listings and stops publishing", async () => {
    await as(D, "select set_user_suspension($1, true, 'Scam reports')", [E]);
    await rejects(
      as(E, `insert into listings (institute_id, title, description, category_id, price_paise, condition, status)
             values ('nit-sikkim', 'Phone', 'A phone in fine shape.', 'electronics', 100, 'good', 'active')`),
      /row-level security/,
    );
  });
});

describe("contact form", () => {
  it("is written only by the server and read only by staff", async () => {
    // Audit H3: visitors can't write directly any more; the server inserts after rate-limiting by IP.
    await rejects(
      as("anon", "insert into contact_messages (name, email, subject, body) values ('V', 'v@example.com', 'Hi', 'Hello there team')"),
      /permission denied/,
    );
    await as("service", "insert into contact_messages (name, email, subject, body) values ('V', 'v@example.com', 'Hi', 'Hello there team')");
    assert.equal((await as(A, "select * from contact_messages")).length, 0);
    assert.equal((await as(D, "select * from contact_messages")).length, 1);
  });
});

// ---------------------------------------------------------------------------
// Regression tests for docs/AUDIT.md findings
// ---------------------------------------------------------------------------
describe("audit regressions", () => {
  const F = "00000000-0000-4000-8000-0000000000f1"; // verified seller
  const G = "00000000-0000-4000-8000-0000000000f2"; // verified buyer
  const H = "00000000-0000-4000-8000-0000000000f3"; // moderator
  const K = "00000000-0000-4000-8000-0000000000f4"; // verified member to be revoked
  const svc = (sql: string, p: unknown[] = []) => as("service", sql, p);
  const newListing = async (who: string, title: string, price = 50000, type = "fixed_offers") =>
    (await one(who, `insert into listings (institute_id, title, description, category_id, price_paise, condition, listing_type, status)
                     values ('nit-sikkim', $1, 'Regression test listing.', 'study', $2, 'good', $3, 'active') returning id`, [title, price, type]))!.id as string;

  before(async () => {
    for (const [id, name] of [[F, "Farah Seller"], [G, "Gopal Buyer"], [H, "Hari Mod"], [K, "Kiran Leaving"]]) {
      await db.query("insert into auth.users (id, raw_user_meta_data) values ($1, $2)", [id, JSON.stringify({ full_name: name })]);
    }
    for (const id of [F, G, K]) {
      await db.query("insert into institute_memberships (user_id, institute_id, status, method) values ($1, 'nit-sikkim', 'verified', 'manual_review')", [id]);
    }
    await db.query("insert into user_roles (user_id, role) values ($1, 'moderator')", [H]);
  });

  it("H2: limits verification codes per target email across accounts", async () => {
    const users = Array.from({ length: 5 }, (_, i) => `00000000-0000-4000-8000-0000000002${String(i).padStart(2, "0")}`);
    let issued = 0;
    for (const u of users) {
      await db.query("insert into auth.users (id) values ($1)", [u]);
      try {
        await svc("select membership_request_email_code($1, 'nit-sikkim', 'victim@nitsikkim.ac.in', 'h')", [u]);
        issued++;
      } catch (e) {
        assert.match((e as Error).message, /too_many_codes_for_email/);
      }
    }
    assert.equal(issued, 3);
  });

  it("H3: rate-limits messages per user", async () => {
    const l = await newListing(F, "Rate limit lamp", 10000, "fixed");
    const conv = (await one(G, "select start_conversation($1) id", [l]))!.id;
    for (let i = 0; i < 20; i++) await as(G, "insert into messages (conversation_id, body) values ($1, $2)", [conv, `msg ${i}`]);
    await rejects(as(G, "insert into messages (conversation_id, body) values ($1, 'one too many')", [conv]), /rate_limited/);
    // The limiter can't be called for someone else's key.
    await rejects(as(G, "select rate_limit_hit('u:x:message_min', 1, '1 minute')"), /permission denied/);
  });

  it("H4: an expired offer no longer blocks a new one", async () => {
    const l = await newListing(F, "Expiring calculator");
    const o = (await one(G, "select make_offer($1, 40000) id", [l]))!.id;
    await db.query("update offers set expires_at = now() - interval '1 minute' where id = $1", [o]);
    await one(G, "select make_offer($1, 41000) id", [l]);
    assert.equal((await one(G, "select status from offers where id = $1", [o]))!.status, "expired");
  });

  it("H5: relisting a sold item lets a new offer be accepted", async () => {
    const l = await newListing(F, "Relisted cycle");
    const o = (await one(G, "select make_offer($1, 45000) id", [l]))!.id;
    await as(F, "select respond_offer($1, 'accept')", [o]);
    await as(F, "update listings set status = 'sold' where id = $1", [l]);
    assert.equal((await one(G, "select status from offers where id = $1", [o]))!.status, "completed");
    await as(F, "update listings set status = 'active' where id = $1", [l]);
    const o2 = (await one(B, "select make_offer($1, 46000) id", [l]))!.id;
    await as(F, "select respond_offer($1, 'accept')", [o2]);
    assert.equal((await one(B, "select status from offers where id = $1", [o2]))!.status, "accepted");
  });

  it("H6: reports survive deletion of the reported account", async () => {
    const victim = "00000000-0000-4000-8000-0000000000f9";
    await db.query("insert into auth.users (id, raw_user_meta_data) values ($1, $2)", [victim, JSON.stringify({ full_name: "Scam Account" })]);
    await db.query("insert into institute_memberships (user_id, institute_id, status, method) values ($1, 'nit-sikkim', 'verified', 'manual_review')", [victim]);
    const l = await newListing(victim, "Too good to be true phone", 100, "fixed");
    await as(G, "insert into reports (listing_id, reported_user_id, reason, details) values ($1, $2, 'scam', 'Asked for advance UPI')", [l, victim]);
    await db.query("delete from auth.users where id = $1", [victim]);
    const r = await one(D, "select reported_user_id, subject_snapshot from reports where details = 'Asked for advance UPI'");
    assert.ok(r, "report still exists");
    assert.equal(r!.reported_user_id, null);
    assert.equal((r!.subject_snapshot as Record<string, string>).reported_display_name, "Scam");
    await rejects(as(G, "insert into reports (reason) values ('other')"), /report_target_required/);
  });

  it("M3: profiles are visible only when there's a reason", async () => {
    // F has public listings; C (unverified, no listings, no chats) does not.
    assert.equal((await as("anon", "select id from profiles where id = $1", [F])).length, 1);
    assert.equal((await as("anon", "select id from profiles where id = $1", [C])).length, 0);
    assert.equal((await as(G, "select id from profiles where id = $1", [C])).length, 0);
    await rejects(as(G, "select suspended_at from profiles"), /permission denied/);
    // The owner still gets their full record, and staff can list users.
    const ctx = (await one(C, "select my_context() c"))!.c as { profile: { id: string; suspended_at: string | null } };
    assert.equal(ctx.profile.id, C);
    assert.ok((await as(D, "select * from admin_list_users(null, 50)")).length > 5);
    await rejects(as(G, "select * from admin_list_users(null, 50)"), /forbidden/);
  });

  it("M4: helper functions don't reveal facts about other users", async () => {
    await as(F, "insert into blocks (blocker_id, blocked_id) values ($1, $2)", [F, C]);
    assert.equal((await one("anon", "select is_blocked_between($1, $2) b", [F, C]))!.b, false);
    assert.equal((await one(G, "select is_blocked_between($1, $2) b", [F, C]))!.b, false);
    assert.equal((await one(F, "select is_blocked_between($1, $2) b", [F, C]))!.b, true);
    assert.equal((await one("anon", "select is_staff($1) s", [D]))!.s, false);
    assert.equal((await one(D, "select is_staff() s"))!.s, true);
    await rejects(as(G, "select has_role($1, '{admin}')", [D]), /permission denied/);
  });

  it("M5: revoking membership takes listings down but lets the seller close them", async () => {
    const l = await newListing(K, "Leaving campus sale", 20000, "fixed");
    const m = (await one(D, "select id from institute_memberships where user_id = $1", [K]))!.id;
    await as(D, "select review_membership($1, 'revoked', 'Graduated')", [m]);
    assert.equal((await as("anon", "select id from listings where id = $1", [l])).length, 0);
    assert.equal((await one(K, "select status from listings where id = $1", [l]))!.status, "removed");
    await rejects(as(K, "update listings set status = 'active' where id = $1", [l]), /row-level security/);
    await as(K, "update listings set status = 'sold' where id = $1", [l]);
  });

  it("M7: conversation reads use the participant indexes, not a per-row function", async () => {
    const plan = await db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [G]);
      await tx.query("set local role authenticated");
      await tx.query("set local enable_seqscan = off");
      const r = await tx.query<{ "QUERY PLAN": string }>("explain select id from conversations order by last_message_at desc limit 50");
      return r.rows.map((x) => x["QUERY PLAN"]).join("\n");
    });
    assert.doesNotMatch(plan, /is_participant/);
    assert.match(plan, /conversations_(initiator|owner)/);
  });

  it("M8: save_listing is atomic, owner-checked and requires a photo to publish", async () => {
    const id = "00000000-0000-4000-8000-00000000aaa1";
    const fields = { title: "Atomic desk", description: "Saved in one transaction.", category_id: "hostel", price_paise: 90000, condition: "good", listing_type: "fixed" };
    const call = (who: string, imgs: string[], publish: boolean, f: object = fields, lid = id) =>
      as(who, "select save_listing($1, 'sale', 'nit-sikkim', $2, $3, $4) id", [lid, JSON.stringify(f), imgs, publish]);
    await rejects(call(F, [], true), /photo_required/);
    assert.equal((await as(F, "select id from listings where id = $1", [id])).length, 0, "nothing half-saved");
    // A bad image path aborts the whole save.
    await rejects(call(F, [`${G}/${id}/x.jpg`], true), /invalid_image_path/);
    await call(F, [`${F}/${id}/a.jpg`, `${F}/${id}/b.jpg`], true);
    const saved = await one("anon", "select status, (select count(*)::int from listing_images where listing_id = $1) n from listings where id = $1", [id]);
    assert.deepEqual(saved, { status: "active", n: 2 });
    // Retrying is idempotent; reordering and removing photos works.
    await call(F, [`${F}/${id}/b.jpg`], true);
    assert.equal((await one("anon", "select count(*)::int n from listing_images where listing_id = $1", [id]))!.n, 1);
    // Someone else can't hijack the id, visible or not.
    await rejects(call(G, [`${G}/${id}/c.jpg`], true), /not_owner/);
    const draftId = "00000000-0000-4000-8000-00000000aaa2";
    await call(F, [], false, fields, draftId);
    await rejects(call(G, [], false, fields, draftId), /not_owner/);
  });

  it("L2: a draft can't be published without a photo", async () => {
    const d = await one(F, `insert into listings (institute_id, title, description, category_id, price_paise, condition, status)
                            values ('nit-sikkim', 'Photo-less', 'No photo here yet.', 'other', 1000, 'good', 'draft') returning id`);
    await rejects(as(F, "update listings set status = 'active' where id = $1", [d!.id]), /photo_required/);
  });

  it("L3: moderators can't suspend other staff", async () => {
    await rejects(as(H, "select set_user_suspension($1, true, 'x')", [D]), /forbidden/);
    await as(D, "select set_user_suspension($1, true, 'test')", [H]);
    await as(D, "select set_user_suspension($1, false, null)", [H]);
  });

  it("L6: avatar paths must be in the user's own folder", async () => {
    await rejects(as(F, "update profiles set avatar_url = 'https://tracker.example/p.gif' where id = $1", [F]), /invalid_avatar/);
    await rejects(as(F, "update profiles set avatar_url = $2 where id = $1", [F, `${G}/a.jpg`]), /invalid_avatar/);
    await as(F, "update profiles set avatar_url = $2 where id = $1", [F, `${F}/avatar.jpg`]);
  });

  it("unread counts and previews come from single calls", async () => {
    const c = (await one(F, "select my_unread_counts() c"))!.c as { messages: number; notifications: number };
    assert.ok(c.messages >= 1);
    const convs = await as(F, "select id from conversations");
    const prev = await as(F, "select * from conversation_previews($1)", [convs.map((x) => x.id)]);
    assert.equal(prev.length, convs.length);
    assert.ok(prev.some((p) => p.unread === true));
    // Previews never leak other people's conversations.
    assert.equal((await as(C, "select * from conversation_previews($1)", [convs.map((x) => x.id)])).length, 0);
  });
});
