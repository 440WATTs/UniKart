/**
 * PREVIEW ONLY: in-memory demo data for the static GitHub Pages preview
 * (built by scripts/build-preview.py). Nothing here is real inventory or real people.
 */
export const BASE_PATH = "/UniKart/preview";
export const ME = "00000000-0000-4000-8000-0000000000aa";
const S1 = "00000000-0000-4000-8000-0000000000b1";
const S2 = "00000000-0000-4000-8000-0000000000b2";
const S3 = "00000000-0000-4000-8000-0000000000b3";

// Relative to build time so cards read "2 hours ago", not a date in the future.
const BUILT = Date.now();
const ago = (h: number) => new Date(BUILT - h * 3600_000).toISOString();
const lid = (n: number) => `00000000-0000-4000-8000-1000000000${String(n).padStart(2, "0")}`;
const cid = (n: number) => `00000000-0000-4000-8000-2000000000${String(n).padStart(2, "0")}`;

export const institutes = [
  {
    id: "nit-sikkim",
    official_name: "National Institute of Technology Sikkim",
    display_name: "NIT Sikkim",
    short_name: "NITS",
    logo_url: null,
    email_domains: ["nitsikkim.ac.in"],
    email_domains_confirmed: false,
    allow_manual_review: true,
    city: "Ravangla",
    state: "Sikkim",
    is_active: true,
    settings: { public_browse: true, offers_enabled: true, max_images: 8, offer_expiry_hours: 48 },
  },
];

export const categories: { id: string; name: string; description: null; icon: null; sort_order: number; is_active: boolean }[] = (
  [
    ["books", "Books & Academics", 10],
    ["electronics", "Electronics", 20],
    ["hostel", "Hostel Essentials", 30],
    ["cycles", "Cycles", 40],
    ["fashion", "Fashion", 50],
    ["gaming", "Gaming", 60],
    ["study", "Study Essentials", 70],
    ["other", "Other", 90],
  ] as [string, string, number][]
).map(([id, name, sort_order]) => ({ id, name, description: null, icon: null, sort_order, is_active: true }));

const profile = (id: string, full: string, type: string, extra: object = {}) => ({
  id,
  full_name: full,
  display_name: full.split(" ")[0],
  avatar_url: null,
  account_type: type,
  department: null,
  academic_year: null,
  designation: null,
  bio: null,
  home_institute_id: "nit-sikkim",
  verified_institute_id: "nit-sikkim",
  is_demo: true,
  suspended_at: null,
  created_at: ago(24 * 60),
  ...extra,
});

export const profiles = [
  profile(ME, "Demo Student", "student", { department: "Electronics & Communication", academic_year: "2nd year B.Tech" }),
  profile(S1, "Aarav Demo", "student", { department: "Computer Science" }),
  profile(S2, "Diya Demo", "student", { department: "Civil Engineering" }),
  profile(S3, "Prof. Demo", "faculty", { designation: "Assistant Professor" }),
];
const card = (id: string) => {
  const p = profiles.find((x) => x.id === id)!;
  return { id: p.id, display_name: p.display_name, avatar_url: null, account_type: p.account_type, verified_institute_id: p.verified_institute_id, is_demo: true, created_at: p.created_at };
};

type L = [n: number, seller: string, title: string, cat: string, rupees: number | null, cond: string | null, type: string, status: string, hours: number, desc: string, kind?: string];
const L_ROWS: L[] = [
  [1, S1, "Scientific Calculator (Casio fx-991EX)", "study", 450, "good", "fixed_offers", "active", 2, "Used for two semesters. All functions work, cover included."],
  [2, S2, "Engineering Mathematics textbook", "books", 250, "fair", "fixed", "active", 5, "B.S. Grewal. Some highlighting in early chapters, no missing pages."],
  [3, S1, "Used Study Table", "hostel", 1200, "good", "fixed_offers", "active", 9, "Wooden study table, fits a hostel room. Pick up from campus."],
  [4, S3, "Bicycle (26 inch)", "cycles", 3500, "good", "fixed_offers", "active", 20, "Recently serviced, new brake pads. Lock included."],
  [5, S2, "LED Desk Lamp", "hostel", 300, "like_new", "fixed", "active", 26, "Three brightness levels, USB powered."],
  [6, S1, "Wired Headphones", "electronics", 800, "good", "fixed", "active", 30, "Over-ear, good sound, minor wear on the headband."],
  [7, S3, "Drafting kit and set squares", "study", 0, "fair", "fixed", "active", 40, "Free to a first-year student. Complete set."],
  [8, S2, "Laptop backpack", "fashion", 600, "like_new", "fixed", "active", 50, 'Fits a 15.6" laptop, water resistant.'],
  [9, S1, "Gaming mouse", "gaming", 700, "good", "fixed_offers", "reserved", 60, "RGB, 6 buttons, works perfectly."],
  [10, S3, "Data Structures in C (textbook)", "books", 200, "good", "fixed", "sold", 80, "Clean copy, no writing."],
  [11, ME, "Mini fridge", "hostel", 4500, "good", "fixed_offers", "active", 12, "Works well, moving out of hostel."],
  [12, ME, "Old calculator manual", "study", 50, "fair", "fixed", "draft", 3, "Draft listing only you can see."],
  [13, S2, "Basic Electrical Engineering textbook", "books", 300, null, "fixed", "active", 7, "Any recent edition for semester 2. Can meet near the library.", "wanted"],
  [14, S3, "Cycle lock", "cycles", 150, null, "fixed", "active", 15, "Looking for a sturdy U-lock.", "wanted"],
];

export const COLORS: Record<string, string> = { study: "#7ad1fe", books: "#fdfab9", hostel: "#ffd23f", cycles: "#7ad1fe", electronics: "#fdfab9", fashion: "#faf6eb", gaming: "#ffd23f", other: "#faf6eb" };

export const listings = L_ROWS.map(([n, seller, title, cat, rupees, cond, type, status, hours, desc, kind = "sale"]) => ({
  id: lid(n),
  seller_id: seller,
  institute_id: "nit-sikkim",
  kind,
  title,
  description: `${desc}\n\n(Demo listing for the UI preview. Not a real item.)`,
  category_id: cat,
  price_paise: rupees == null ? null : rupees * 100,
  currency: "INR",
  condition: kind === "wanted" ? null : cond,
  listing_type: type,
  negotiable: false,
  brand: null,
  model: null,
  purchase_date: null,
  original_price_paise: null,
  status,
  removed_by_moderator: false,
  is_demo: true,
  published_at: status === "draft" ? null : ago(hours),
  sold_at: status === "sold" ? ago(hours - 10) : null,
  created_at: ago(hours),
  updated_at: ago(hours),
  seller: card(seller),
  images: kind === "wanted" ? [] : [{ id: `img-${n}`, storage_path: `demo/${n}.png`, position: 0 }],
}));

export const listingCardById = (id: string) => listings.find((l) => l.id === id);

const slim = (id: string) => {
  const l = listingCardById(id)!;
  return { id: l.id, title: l.title, status: l.status, kind: l.kind, price_paise: l.price_paise, listing_type: l.listing_type, seller_id: l.seller_id, images: l.images };
};

export const saved_listings = [lid(4), lid(2)].map((id, i) => ({ user_id: ME, listing_id: id, created_at: ago(i + 1), listing: listingCardById(id) }));

const pc = (id: string) => ({ id, display_name: profiles.find((p) => p.id === id)!.display_name, verified_institute_id: "nit-sikkim" });
export const conversations = [
  { id: cid(1), listing_id: lid(1), institute_id: "nit-sikkim", initiator_id: ME, owner_id: S1, created_at: ago(3), last_message_at: ago(1) },
  { id: cid(2), listing_id: lid(11), institute_id: "nit-sikkim", initiator_id: S2, owner_id: ME, created_at: ago(8), last_message_at: ago(6) },
].map((c) => ({ ...c, listing: slim(c.listing_id), initiator: pc(c.initiator_id), owner: pc(c.owner_id) }));

export const conversation_participants = conversations.flatMap((c) => [
  { conversation_id: c.id, user_id: c.initiator_id, last_read_at: ago(2) },
  { conversation_id: c.id, user_id: c.owner_id, last_read_at: ago(2) },
]);

export const offers = [
  { id: "00000000-0000-4000-8000-300000000001", listing_id: lid(1), conversation_id: cid(1), buyer_id: ME, seller_id: S1, made_by: S1, parent_offer_id: null, amount_paise: 42000, currency: "INR", status: "pending", expires_at: "2099-01-01T00:00:00Z", responded_at: null, created_at: ago(1.5) },
  { id: "00000000-0000-4000-8000-300000000002", listing_id: lid(11), conversation_id: cid(2), buyer_id: S2, seller_id: ME, made_by: S2, parent_offer_id: null, amount_paise: 400000, currency: "INR", status: "declined", expires_at: ago(-40), responded_at: ago(6), created_at: ago(7) },
].map((o) => ({ ...o, listing: { id: o.listing_id, title: listingCardById(o.listing_id)!.title, price_paise: listingCardById(o.listing_id)!.price_paise, status: listingCardById(o.listing_id)!.status } }));

const msg = (id: number, conv: string, sender: string, body: string, hours: number, kind = "text", offer_id: string | null = null) => ({ id: `00000000-0000-4000-8000-40000000000${id}`, conversation_id: conv, sender_id: sender, kind, body, offer_id, created_at: ago(hours) });
export const messages = [
  msg(1, cid(1), ME, "Hi! Is the calculator still available?", 3),
  msg(2, cid(1), S1, "Yes it is. I can meet near the library after 4 pm.", 2.5),
  msg(3, cid(1), S1, "Countered with ₹420", 1.5, "offer", offers[0].id),
  msg(4, cid(2), S2, "Would you take ₹4,000 for the fridge?", 7),
  msg(5, cid(2), S2, "Offered ₹4,000", 7, "offer", offers[1].id),
  msg(6, cid(2), ME, "Sorry, ₹4,500 is already a fair price.", 6),
];

export const notifications = [
  { id: "n1", user_id: ME, type: "offer_countered", title: "Counteroffer: ₹420", body: 'For "Scientific Calculator (Casio fx-991EX)"', link: `/messages/${cid(1)}`, read_at: null, created_at: ago(1.5), group_key: null },
  { id: "n2", user_id: ME, type: "message", title: "New message from Aarav", body: "Yes it is. I can meet near the library after 4 pm.", link: `/messages/${cid(1)}`, read_at: null, created_at: ago(2.5), group_key: null },
  { id: "n3", user_id: ME, type: "verification", title: "You are now a verified NIT Sikkim member", body: null, link: "/account/institute", read_at: ago(100), created_at: ago(200), group_key: null },
];

export const institute_memberships = [
  { id: "m1", user_id: ME, institute_id: "nit-sikkim", status: "verified", method: "manual_review", institute_email: null, applicant_note: null, review_note: "Demo", verified_at: ago(200), created_at: ago(210), user: profiles[0] },
  { id: "m2", user_id: "00000000-0000-4000-8000-0000000000c1", institute_id: "nit-sikkim", status: "pending", method: "manual_review", institute_email: null, applicant_note: "First-year student, ECE (demo request)", review_note: null, verified_at: null, created_at: ago(4), user: { full_name: "Pending Demo", display_name: "Pending", account_type: "student", department: "ECE", academic_year: "1st year", designation: null } },
];

export const user_roles = [{ user_id: ME, role: "admin" }];
export const reports = [
  { id: "r1", reporter_id: ME, listing_id: lid(6), reported_user_id: null, conversation_id: null, reason: "misleading", details: "Photo doesn't match the description (demo report)", status: "open", resolution_note: null, created_at: ago(10), listing: { id: lid(6), title: "Wired Headphones", status: "active", removed_by_moderator: false }, reporter: { display_name: "Demo" }, reported: null },
];
export const contact_messages = [{ id: "c1", name: "Visitor (demo)", email: "visitor@example.com", subject: "Question about selling", body: "Can staff members sell too? (demo message)", handled: false, created_at: ago(30) }];
export const audit_events = [
  { id: 2, actor_id: ME, event: "membership.verified", entity_type: "institute_membership", entity_id: "m1", created_at: ago(200) },
  { id: 1, actor_id: null, event: "institutes.update", entity_type: "institutes", entity_id: "nit-sikkim", created_at: ago(300) },
];
export const moderation_actions = [{ id: "a1", moderator_id: ME, action: "membership.verified", target_type: "institute_membership", target_id: "m1", reason: "Demo", created_at: ago(200) }];

export const TABLES: Record<string, object[]> = {
  institutes,
  categories,
  profiles,
  listings,
  listing_images: listings.flatMap((l) => l.images.map((i) => ({ ...i, listing_id: l.id }))),
  saved_listings,
  conversations,
  conversation_participants,
  offers,
  messages,
  notifications,
  institute_memberships,
  user_roles,
  blocks: [],
  reports,
  contact_messages,
  audit_events,
  moderation_actions,
  app_settings: [],
};

export const STATIC_IDS = {
  listings: listings.map((l) => l.id),
  myListings: listings.filter((l) => l.seller_id === ME).map((l) => l.id),
  conversations: conversations.map((c) => c.id),
};
