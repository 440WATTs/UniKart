/**
 * Unit tests for pure business logic and security helpers.
 *   npm run test:unit
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCsp, sanitizeRequestId } from "../../src/lib/csp";
import { AUTH_ERRORS, DB_ERRORS, dbErrorCode, DEFAULT_ERROR, errorText } from "../../src/lib/errors";
import { formatPrice, paiseToRupeesInput, rupeesToPaise, safeNext } from "../../src/lib/format";
import { toPrefixQuery } from "../../src/lib/search-query";
import { checkServerEnv } from "../../src/lib/server-env";

describe("safeNext (audit M1)", () => {
  it("keeps same-site paths", () => {
    assert.equal(safeNext("/sell"), "/sell");
    assert.equal(safeNext("/search?q=calc&page=2#top"), "/search?q=calc&page=2#top");
  });
  for (const bad of ["//evil.com", "/\\evil.com", "/\t/evil.com", "/\n/evil.com", "/\r/evil.com", "https://evil.com", "evil.com", "javascript:alert(1)", "/%09/evil.com/../\\x", "", "/" + "a".repeat(600)]) {
    it(`rejects ${JSON.stringify(bad).slice(0, 40)}`, () => {
      const r = safeNext(bad, "/fallback");
      assert.equal(new URL(r, "https://unikart.example").host, "unikart.example");
      if (bad !== "/%09/evil.com/../\\x") assert.equal(r, "/fallback");
    });
  }
  it("handles non-strings", () => assert.equal(safeNext(null), "/marketplace"));
});

describe("money", () => {
  it("parses rupees to integer paise without floating point error", () => {
    assert.equal(rupeesToPaise("450"), 45000);
    assert.equal(rupeesToPaise("1,200"), 120000);
    assert.equal(rupeesToPaise("₹ 0.10"), 10);
    assert.equal(rupeesToPaise("19.99"), 1999);
    assert.equal(rupeesToPaise("0.29"), 29); // 0.29 * 100 = 28.999999999999996 in floats
  });
  it("rejects invalid amounts", () => {
    for (const bad of ["", "abc", "-5", "1.234", "1e3", "12..5"]) assert.equal(rupeesToPaise(bad), null, bad);
  });
  it("formats paise", () => {
    assert.equal(formatPrice(0), "FREE");
    assert.equal(formatPrice(null), "—");
    assert.match(formatPrice(120000), /1,200/);
    assert.equal(paiseToRupeesInput(45050), "450.50");
    assert.equal(paiseToRupeesInput(45000), "450");
  });
});

describe("search query", () => {
  it("builds prefix queries from letters and digits only", () => {
    assert.equal(toPrefixQuery("Sci calc"), "sci:* & calc:*");
    assert.equal(toPrefixQuery("fx-991 'or 1=1; drop"), "fx:* & 991:* & or:* & 1:* & 1:* & drop:*");
    assert.equal(toPrefixQuery("!!!"), "");
    assert.equal(toPrefixQuery("a b c d e f g h i j").split("&").length, 8);
  });
});

describe("error mapping (audit M9)", () => {
  it("maps database codes, longest match first", () => {
    assert.equal(dbErrorCode("offer_not_pending"), "offer_not_pending");
    assert.equal(dbErrorCode('ERROR: rate_limited (P0001)'), "rate_limited");
    assert.equal(dbErrorCode("something else"), null);
  });
  it("never renders arbitrary text or prototype members", () => {
    assert.equal(errorText("Call 9999 to unlock your account"), DEFAULT_ERROR);
    assert.equal(errorText("constructor"), DEFAULT_ERROR);
    assert.equal(errorText("__proto__", AUTH_ERRORS), DEFAULT_ERROR);
    assert.equal(errorText("blocked"), DB_ERRORS.blocked);
  });
});

describe("CSP (audit M6)", () => {
  const csp = buildCsp({ nonce: "abc123", supabaseUrl: "https://proj.supabase.co", dev: false });
  it("requires the nonce for scripts and forbids framing", () => {
    assert.match(csp, /script-src 'self' 'nonce-abc123' 'strict-dynamic'(;|$)/);
    assert.doesNotMatch(csp, /unsafe-eval/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.match(csp, /object-src 'none'/);
  });
  it("allows the Supabase project for data and realtime only", () => {
    assert.match(csp, /connect-src 'self' https:\/\/proj\.supabase\.co wss:\/\/proj\.supabase\.co/);
    assert.match(csp, /form-action 'self' https:\/\/proj\.supabase\.co https:\/\/accounts\.google\.com/);
  });
  it("upgrades insecure requests only on https sites", () => {
    assert.match(csp, /upgrade-insecure-requests/);
    assert.doesNotMatch(buildCsp({ nonce: "n", supabaseUrl: "", dev: false, https: false }), /upgrade-insecure-requests/);
  });
  it("is still valid when Supabase is not configured", () => {
    assert.doesNotMatch(buildCsp({ nonce: "n", supabaseUrl: "", dev: true }), /undefined|  /);
  });
  it("only keeps well-formed upstream request IDs", () => {
    assert.equal(sanitizeRequestId("abc-123_DEF.456"), "abc-123_DEF.456");
    assert.equal(sanitizeRequestId("<script>"), null);
    assert.equal(sanitizeRequestId("a\nb-injected-header"), null);
  });
});

describe("production env validation (audit M11)", () => {
  const good = {
    NEXT_PUBLIC_SUPABASE_URL: "https://p.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
    SUPABASE_SERVICE_ROLE_KEY: "service",
    NEXT_PUBLIC_SITE_URL: "https://unikart.example",
    VERIFICATION_CODE_SECRET: "x".repeat(64),
  };
  it("accepts a complete configuration", () => assert.deepEqual(checkServerEnv(good), []));
  it("allows plain http only for localhost", () => {
    assert.deepEqual(checkServerEnv({ ...good, NEXT_PUBLIC_SITE_URL: "http://localhost:3000" }), []);
    assert.equal(checkServerEnv({ ...good, NEXT_PUBLIC_SITE_URL: "http://unikart.example" }).length, 1);
  });
  it("reports missing and unsafe values", () => {
    const p = checkServerEnv({ ...good, SUPABASE_SERVICE_ROLE_KEY: "", NEXT_PUBLIC_SITE_URL: "http://x", VERIFICATION_CODE_SECRET: "short", ALLOW_DEMO_SEED: "true" });
    assert.equal(p.length, 4, p.join("\n"));
  });
});
