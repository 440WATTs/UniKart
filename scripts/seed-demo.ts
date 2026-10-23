/**
 * Development-only demo data for the NIT Sikkim marketplace.
 *
 *   npm run seed          # create demo sellers + listings (idempotent)
 *   npm run seed:reset    # delete every demo listing, photo and demo user
 *
 * Demo users use the reserved ".invalid" domain, are flagged is_demo, and get
 * NO institute membership, so they are never shown as verified members.
 * Every demo listing is flagged is_demo and labelled "Demo" in the UI.
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import sharp from "sharp";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const institute = process.env.NEXT_PUBLIC_DEFAULT_INSTITUTE_ID ?? "nit-sikkim";

if (process.env.NODE_ENV === "production" || process.env.ALLOW_DEMO_SEED !== "true") {
  console.error("Refusing to run: set ALLOW_DEMO_SEED=true in .env.local (never in production).");
  process.exit(1);
}
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });
const DEMO_DOMAIN = "demo.unikart.invalid";

const SELLERS = [
  { email: `seller-one@${DEMO_DOMAIN}`, name: "Demo Seller One", type: "student" },
  { email: `seller-two@${DEMO_DOMAIN}`, name: "Demo Seller Two", type: "student" },
];

const LISTINGS = [
  { title: "Scientific Calculator (Casio fx-991EX)", cat: "study", price: 450, cond: "good", type: "fixed_offers", color: "#7ad1fe", desc: "Used for two semesters. All functions work, cover included." },
  { title: "Engineering Mathematics textbook", cat: "books", price: 250, cond: "fair", type: "fixed", color: "#fdfab9", desc: "B.S. Grewal. Some highlighting in early chapters, no missing pages." },
  { title: "Used Study Table", cat: "hostel", price: 1200, cond: "good", type: "fixed_offers", color: "#ffd23f", desc: "Wooden study table, fits a hostel room. Pick up from campus." },
  { title: "Bicycle (26 inch)", cat: "cycles", price: 3500, cond: "good", type: "fixed_offers", color: "#7ad1fe", desc: "Recently serviced, new brake pads. Lock included." },
  { title: "LED Desk Lamp", cat: "hostel", price: 300, cond: "like_new", type: "fixed", color: "#faf6eb", desc: "Three brightness levels, USB powered." },
  { title: "Wired Headphones", cat: "electronics", price: 800, cond: "good", type: "fixed", color: "#fdfab9", desc: "Over-ear, good sound, minor wear on the headband." },
  { title: "Drafting kit and set squares", cat: "study", price: 0, cond: "fair", type: "fixed", color: "#ffd23f", desc: "Free to a first-year student. Complete set." },
];

const WANTED = { title: "Wanted: Basic Electrical Engineering textbook", cat: "books", budget: 300, desc: "Any recent edition for semester 2. Can meet near the library." };

function escapeXml(s: string) {
  return s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);
}

/** A plain placeholder image that is obviously not a real product photo. */
async function placeholder(title: string, color: string) {
  const words = title.split(" ");
  const lines: string[] = [];
  for (const w of words) {
    const last = lines.at(-1);
    if (last && (last + " " + w).length <= 18) lines[lines.length - 1] = last + " " + w;
    else lines.push(w);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800">
    <rect width="800" height="800" fill="${color}"/>
    <rect x="40" y="40" width="720" height="720" fill="none" stroke="#000" stroke-width="8"/>
    <text x="400" y="150" font-family="monospace" font-size="44" font-weight="700" text-anchor="middle">DEMO PHOTO</text>
    ${lines.map((l, i) => `<text x="400" y="${360 + i * 64}" font-family="sans-serif" font-size="54" font-weight="700" text-anchor="middle">${escapeXml(l)}</text>`).join("")}
    <text x="400" y="700" font-family="monospace" font-size="30" text-anchor="middle">development sample — not for sale</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function demoUsers() {
  const { data, error } = await db.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  return data.users.filter((u) => u.email?.endsWith(`@${DEMO_DOMAIN}`));
}

async function reset() {
  const users = await demoUsers();
  const { data: listings } = await db.from("listings").select("id, images:listing_images(storage_path)").eq("is_demo", true);
  const paths = (listings ?? []).flatMap((l: { images: { storage_path: string }[] }) => l.images.map((i) => i.storage_path));
  if (paths.length) await db.storage.from("listing-images").remove(paths);
  await db.from("listings").delete().eq("is_demo", true);
  for (const u of users) await db.auth.admin.deleteUser(u.id);
  console.log(`Removed ${listings?.length ?? 0} demo listings, ${paths.length} photos and ${users.length} demo users.`);
}

async function seed() {
  const { data: inst } = await db.from("institutes").select("id").eq("id", institute).maybeSingle();
  if (!inst) throw new Error(`Institute ${institute} not found. Apply the migrations first.`);

  const existing = await demoUsers();
  const ids: string[] = [];
  for (const s of SELLERS) {
    let user = existing.find((u) => u.email === s.email);
    if (!user) {
      const { data, error } = await db.auth.admin.createUser({
        email: s.email,
        password: randomBytes(24).toString("base64url"), // never used; demo accounts can't sign in meaningfully
        email_confirm: true,
        user_metadata: { full_name: s.name },
      });
      if (error) throw error;
      user = data.user;
    }
    await db.from("profiles").update({ is_demo: true, display_name: s.name, account_type: s.type }).eq("id", user.id);
    ids.push(user.id);
  }

  const { count } = await db.from("listings").select("id", { count: "exact", head: true }).eq("is_demo", true);
  if (count) {
    console.log(`Demo listings already exist (${count}). Run "npm run seed:reset" first to recreate them.`);
    return;
  }

  let n = 0;
  for (const [i, l] of LISTINGS.entries()) {
    const seller = ids[i % ids.length];
    const id = randomUUID();
    const { error } = await db.from("listings").insert({
      id,
      seller_id: seller,
      institute_id: institute,
      kind: "sale",
      title: l.title,
      description: `${l.desc}\n\n(Demo listing for development. Not a real item.)`,
      category_id: l.cat,
      price_paise: l.price * 100,
      condition: l.cond,
      listing_type: l.price === 0 ? "fixed" : l.type,
      status: "active",
      is_demo: true,
    });
    if (error) throw error;
    const path = `${seller}/${id}/demo.png`;
    const up = await db.storage.from("listing-images").upload(path, await placeholder(l.title, l.color), { contentType: "image/png", upsert: true });
    if (up.error) throw up.error;
    await db.from("listing_images").insert({ listing_id: id, storage_path: path, position: 0 });
    n++;
  }
  await db.from("listings").insert({
    seller_id: ids[1],
    institute_id: institute,
    kind: "wanted",
    title: WANTED.title,
    description: `${WANTED.desc}\n\n(Demo request for development.)`,
    category_id: WANTED.cat,
    price_paise: WANTED.budget * 100,
    status: "active",
    is_demo: true,
  });
  console.log(`Created ${SELLERS.length} demo users, ${n} demo listings and 1 wanted request for ${institute}.`);
}

(process.argv.includes("--reset") ? reset() : seed()).catch((e) => {
  console.error(e);
  process.exit(1);
});
