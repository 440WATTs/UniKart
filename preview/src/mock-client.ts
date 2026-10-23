/**
 * PREVIEW ONLY: a tiny stand-in for the Supabase client that answers reads
 * from preview/src/data.ts and refuses every write with "preview_only".
 * Supports just the query-builder methods the app uses.
 */
import * as D from "./data";

type Row = Record<string, unknown>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Result = { data: any; error: { message: string; code?: string } | null; count: number | null };
const PREVIEW_ERROR = { message: "preview_only" };

function prefixMatch(row: Row, tsq: string) {
  const words = [row.title, row.description, row.brand, row.model, row.category_id].join(" ").toLowerCase().split(/[^\p{L}\p{N}]+/u);
  return tsq
    .split("&")
    .map((t) => t.trim().replace(/:\*$/, ""))
    .filter(Boolean)
    .every((t) => words.some((w) => w.startsWith(t)));
}

class Query implements PromiseLike<Result> {
  private rows: Row[];
  private filters: ((r: Row) => boolean)[] = [];
  private sorts: [string, boolean][] = [];
  private from = 0;
  private to = Infinity;
  private head = false;
  private wantCount = false;
  private singleMode: "one" | "maybe" | null = null;
  private write = false;

  constructor(table: string) {
    this.rows = (D.TABLES[table] as Row[] | undefined) ?? [];
  }
  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    this.wantCount = Boolean(opts?.count);
    this.head = Boolean(opts?.head);
    return this;
  }
  eq(c: string, v: unknown) {
    this.filters.push((r) => r[c] === v);
    return this;
  }
  neq(c: string, v: unknown) {
    this.filters.push((r) => r[c] !== v);
    return this;
  }
  in(c: string, vs: unknown[]) {
    this.filters.push((r) => vs.includes(r[c]));
    return this;
  }
  gt(c: string, v: number | string) {
    this.filters.push((r) => (r[c] as number | string) > v);
    return this;
  }
  gte(c: string, v: number) {
    this.filters.push((r) => r[c] != null && (r[c] as number) >= v);
    return this;
  }
  lte(c: string, v: number) {
    this.filters.push((r) => r[c] != null && (r[c] as number) <= v);
    return this;
  }
  is(c: string, v: null) {
    this.filters.push((r) => r[c] === v);
    return this;
  }
  ilike(c: string, pattern: string) {
    const needle = pattern.replace(/^%|%$/g, "").replace(/\\(.)/g, "$1").toLowerCase();
    this.filters.push((r) => String(r[c] ?? "").toLowerCase().includes(needle));
    return this;
  }
  or() {
    return this;
  }
  textSearch(_c: string, tsq: string) {
    this.filters.push((r) => prefixMatch(r, tsq));
    return this;
  }
  order(c: string, opts?: { ascending?: boolean }) {
    this.sorts.push([c, opts?.ascending ?? true]);
    return this;
  }
  range(from: number, to: number) {
    this.from = from;
    this.to = to;
    return this;
  }
  limit(n: number) {
    this.to = this.from + n - 1;
    return this;
  }
  single() {
    this.singleMode = "one";
    return this;
  }
  maybeSingle() {
    this.singleMode = "maybe";
    return this;
  }
  abortSignal() {
    return this;
  }
  insert() {
    this.write = true;
    return this;
  }
  update() {
    this.write = true;
    return this;
  }
  upsert() {
    this.write = true;
    return this;
  }
  delete() {
    this.write = true;
    return this;
  }
  run(): Result {
    if (this.write) return { data: null, error: PREVIEW_ERROR, count: null };
    let rows = this.rows.filter((r) => this.filters.every((f) => f(r)));
    for (const [c, asc] of [...this.sorts].reverse()) {
      rows = [...rows].sort((a, b) => {
        const x = a[c] as number | string;
        const y = b[c] as number | string;
        if (x == null) return 1;
        if (y == null) return -1;
        return (x < y ? -1 : x > y ? 1 : 0) * (asc ? 1 : -1);
      });
    }
    const count = rows.length;
    if (this.from > 0 && this.from >= count && count > 0) return { data: null, error: { message: "range", code: "PGRST103" }, count };
    rows = rows.slice(this.from, this.to === Infinity ? undefined : this.to + 1);
    // Deep copy: callers sort nested arrays in place.
    const data = JSON.parse(JSON.stringify(rows));
    if (this.singleMode) return { data: data[0] ?? null, error: null, count: null };
    return { data: this.head ? null : data, error: null, count: this.wantCount ? count : null };
  }
  then<A = Result, B = never>(ok?: ((v: Result) => A | PromiseLike<A>) | null, fail?: ((e: unknown) => B | PromiseLike<B>) | null) {
    return Promise.resolve(this.run()).then(ok, fail);
  }
}

const READ_RPCS: Record<string, (args: Record<string, unknown>) => unknown> = {
  my_context: () => ({
    profile: D.profiles[0],
    memberships: D.institute_memberships.filter((m) => m.user_id === D.ME),
    roles: D.user_roles.map((r) => r.role),
  }),
  my_unread_counts: () => ({ messages: 1, notifications: D.notifications.filter((n) => !n.read_at).length }),
  unread_conversation_count: () => 1,
  conversation_previews: ({ p_ids }) =>
    (p_ids as string[]).map((id) => {
      const m = D.messages.filter((x) => x.conversation_id === id).at(-1)!;
      return { conversation_id: id, body: m.body, sender_id: m.sender_id, created_at: m.created_at, unread: id === D.conversations[0].id };
    }),
  my_listing_stats: ({ p_ids }) =>
    (p_ids as string[]).map((id) => ({ listing_id: id, saves: 0, conversations: D.conversations.filter((c) => c.listing_id === id).length })),
  admin_metrics: () => ({
    users: D.profiles.length,
    verified_members: D.profiles.length,
    pending_memberships: 1,
    active_listings: 0,
    demo_listings: D.listings.length,
    sold_listings: 0,
    open_reports: D.reports.length,
    conversations: D.conversations.length,
    messages_7d: D.messages.length,
  }),
  admin_list_users: () => D.profiles.map((p) => ({ ...p, suspension_reason: null, roles: p.id === D.ME ? ["admin"] : [] })),
  mark_conversation_read: () => null,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createMockClient(): any {
  return {
    from: (table: string) => new Query(table),
    rpc: async (name: string, args: Record<string, unknown> = {}) =>
      READ_RPCS[name] ? { data: READ_RPCS[name](args), error: null } : { data: null, error: PREVIEW_ERROR },
    auth: {
      getClaims: async () => ({ data: { claims: { sub: D.ME, email: "demo.student@example.com" } }, error: null }),
      getUser: async () => ({ data: { user: { id: D.ME, email: "demo.student@example.com", app_metadata: { providers: ["email"] } } }, error: null }),
      updateUser: async () => ({ data: null, error: { message: "Preview only: account changes are disabled." } }),
      signOut: async () => ({ error: null }),
    },
    storage: {
      from: () => ({
        upload: async () => ({ data: null, error: { message: "Preview only: uploads are disabled." } }),
        remove: async () => ({ data: null, error: null }),
        list: async () => ({ data: [], error: null }),
      }),
    },
    channel() {
      const ch = { on: () => ch, subscribe: () => ch };
      return ch;
    },
    removeChannel: () => undefined,
  };
}
