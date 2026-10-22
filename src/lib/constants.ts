export const CONDITIONS = [
  { id: "new", label: "New" },
  { id: "like_new", label: "Like new" },
  { id: "good", label: "Good" },
  { id: "fair", label: "Fair" },
  { id: "for_parts", label: "For parts / not working" },
] as const;

export type ConditionId = (typeof CONDITIONS)[number]["id"];

export function conditionLabel(id: string | null | undefined) {
  return CONDITIONS.find((c) => c.id === id)?.label ?? "";
}

export const ACCOUNT_TYPES = [
  { id: "student", label: "Student" },
  { id: "faculty", label: "Faculty" },
  { id: "staff", label: "Staff" },
  { id: "other", label: "Other institute member" },
] as const;

export function accountTypeLabel(id: string | null | undefined) {
  return ACCOUNT_TYPES.find((c) => c.id === id)?.label ?? "Member";
}

export const REPORT_REASONS = [
  { id: "scam", label: "Suspected scam" },
  { id: "misleading", label: "Misleading information" },
  { id: "prohibited", label: "Prohibited item" },
  { id: "stolen_counterfeit", label: "Stolen or counterfeit goods" },
  { id: "harassment", label: "Harassment" },
  { id: "other", label: "Other" },
] as const;

export const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  active: "Available",
  reserved: "Reserved",
  sold: "Sold",
  removed: "Removed",
  expired: "Expired",
};

export const SORTS = [
  { id: "newest", label: "Newest first" },
  { id: "price_asc", label: "Price: Low to High" },
  { id: "price_desc", label: "Price: High to Low" },
] as const;

export const PAGE_SIZE = 24;

export const IMAGE_RULES = {
  maxFiles: 8,
  maxBytes: 5 * 1024 * 1024,
  types: ["image/jpeg", "image/png", "image/webp"],
};

/** Category icons (emoji keep the bundle small and render everywhere). */
export const CATEGORY_ICON: Record<string, string> = {
  books: "📚",
  electronics: "💻",
  hostel: "🛏️",
  cycles: "🚲",
  fashion: "👕",
  gaming: "🎮",
  study: "🧮",
  other: "📦",
  free: "🎁",
};
