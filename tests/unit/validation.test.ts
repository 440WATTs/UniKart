/** Form validation under zod 4 (upgraded from 3 for GHSA-mrhx-c7xc-m3w5). */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { contactSchema, emailField, fieldErrors, loginSchema, passwordSchema, signupSchema } from "../../src/lib/validation";

describe("emailField", () => {
  it("trims and lower-cases valid addresses", () => {
    assert.equal(emailField().parse("  Asha.K@NITSikkim.ac.in "), "asha.k@nitsikkim.ac.in");
  });
  it("rejects invalid or oversized addresses with the given message", () => {
    for (const bad of ["", "not-an-email", "a@b", "a b@c.de", `${"x".repeat(250)}@ex.com`]) {
      const r = emailField("Bad email").safeParse(bad);
      assert.equal(r.success, false, bad);
      assert.equal(r.error!.issues[0].message, "Bad email");
    }
  });
  it("rejects non-strings such as a missing form field", () => {
    assert.equal(emailField().safeParse(null).success, false);
  });
});

describe("passwordSchema", () => {
  it("requires length, a letter and a number", () => {
    assert.equal(passwordSchema.safeParse("abc12345").success, true);
    assert.equal(passwordSchema.safeParse("short1").error!.issues[0].message, "Use at least 8 characters.");
    assert.equal(passwordSchema.safeParse("12345678").error!.issues[0].message, "Include at least one letter.");
    assert.equal(passwordSchema.safeParse("abcdefgh").error!.issues[0].message, "Include at least one number.");
    assert.equal(passwordSchema.safeParse("a1".repeat(40)).success, false);
  });
});

describe("signupSchema", () => {
  const ok = { fullName: " Asha K ", email: "Asha@Example.com", password: "abc12345", terms: "on" };
  it("accepts a complete form", () => {
    assert.deepEqual(signupSchema.parse(ok), { fullName: "Asha K", email: "asha@example.com", password: "abc12345", terms: "on" });
  });
  it("requires the terms checkbox with a readable message", () => {
    const r = signupSchema.safeParse({ ...ok, terms: null });
    assert.equal(r.success, false);
    assert.equal(fieldErrors(r.error!).terms, "Please accept the terms to continue.");
  });
  it("reports the first error per field", () => {
    const r = signupSchema.safeParse({ fullName: "A", email: "x", password: "1", terms: "on" });
    const fe = fieldErrors(r.error!);
    assert.deepEqual(Object.keys(fe).sort(), ["email", "fullName", "password"]);
    assert.equal(fe.password, "Use at least 8 characters.");
  });
});

describe("loginSchema and contactSchema", () => {
  it("validate their fields", () => {
    assert.equal(loginSchema.safeParse({ email: "a@b.co", password: "" }).error!.issues[0].message, "Enter your password.");
    assert.equal(contactSchema.safeParse({ name: "V", email: "v@example.com", subject: "Hi", body: "Hello there team" }).success, true);
    assert.equal(fieldErrors(contactSchema.safeParse({ name: "V", email: "v@", subject: "Hi", body: "short" }).error!).body, "Write at least 10 characters.");
  });
  it("bounds oversized input instead of processing it", () => {
    assert.equal(contactSchema.safeParse({ name: "V", email: "v@example.com", subject: "Hi", body: "x".repeat(50_000) }).success, false);
  });
});
