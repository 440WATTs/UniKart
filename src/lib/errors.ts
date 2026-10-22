/**
 * Exception codes raised by our SQL functions, mapped to user-facing text.
 * Pages receive only these codes in URLs (never free text), so a crafted link
 * can't put arbitrary words on screen.
 */
export const DB_ERRORS: Record<string, string> = {
  not_authenticated: "Please log in first.",
  not_verified: "Verify your institute membership to contact members.",
  own_listing: "This is your own listing.",
  listing_unavailable: "This listing is no longer available.",
  blocked: "You can't message this member.",
  offers_not_enabled: "The seller isn't accepting offers on this item.",
  offers_disabled: "Offers are turned off for this marketplace.",
  invalid_amount: "Enter an amount above ₹0 and no higher than the asking price.",
  offer_already_pending: "You already have an open offer on this item. Wait for a reply or withdraw it first.",
  offer_not_found: "That offer could not be found.",
  not_your_turn: "It's the other person's turn to respond to this offer.",
  offer_not_pending: "This offer has already been answered.",
  offer_expired: "This offer has expired.",
  account_suspended: "Your account is suspended.",
  participant_left: "The other member has left UniMart.",
  not_participant: "You're not part of this conversation.",
  listing_removed_by_moderator: "This listing was removed by a moderator and can't be changed.",
  too_many_images: "That's more photos than allowed.",
  invalid_image_path: "One of the photos could not be attached. Please upload it again.",
  photo_required: "Add at least one photo before publishing.",
  not_owner: "You can't edit this listing.",
  invalid_avatar: "That profile photo couldn't be used. Please upload it again.",
  report_target_required: "Choose what you're reporting.",
  rate_limited: "You're doing that too often. Please wait a little and try again.",
  forbidden: "You don't have permission to do that.",
};

export const DEFAULT_ERROR = "Something went wrong. Please try again.";

/** Returns the known code contained in a database error message, if any. */
export function dbErrorCode(message: string | undefined | null): string | null {
  if (!message) return null;
  const exact = message.trim();
  if (Object.hasOwn(DB_ERRORS, exact)) return exact;
  // Longest first so e.g. "offer_not_pending" never matches a shorter code.
  return Object.keys(DB_ERRORS).sort((a, b) => b.length - a.length).find((k) => message.includes(k)) ?? null;
}

export function errorText(code: string | null | undefined, table: Record<string, string> = DB_ERRORS) {
  return code && Object.hasOwn(table, code) ? table[code] : DEFAULT_ERROR;
}

/** Errors shown on /login, passed as ?error=<code>. */
export const AUTH_ERRORS: Record<string, string> = {
  oauth_failed: "Sign-in with Google didn't complete. Please try again.",
  oauth_cancelled: "Sign-in was cancelled.",
  google_disabled: "Google sign-in has not been set up yet. Use email for now.",
  link_invalid: "This link is invalid or has expired. Request a new one.",
  session_expired: "Your session expired. Please log in again.",
};
