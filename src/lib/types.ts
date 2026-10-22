export type ListingStatus = "draft" | "active" | "reserved" | "sold" | "removed" | "expired";
export type ListingKind = "sale" | "wanted";
export type ListingType = "fixed" | "fixed_offers";
export type MembershipStatus = "pending" | "verified" | "rejected" | "revoked";
export type OfferStatus = "pending" | "accepted" | "completed" | "declined" | "countered" | "withdrawn" | "expired" | "cancelled";

export interface Institute {
  id: string;
  official_name: string;
  display_name: string;
  short_name: string;
  logo_url: string | null;
  email_domains: string[];
  email_domains_confirmed: boolean;
  allow_manual_review: boolean;
  city: string | null;
  state: string | null;
  is_active: boolean;
  settings: { public_browse?: boolean; offers_enabled?: boolean; max_images?: number; offer_expiry_hours?: number };
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface Profile {
  id: string;
  full_name: string;
  display_name: string;
  avatar_url: string | null;
  account_type: "student" | "faculty" | "staff" | "other" | null;
  department: string | null;
  academic_year: string | null;
  designation: string | null;
  bio: string | null;
  home_institute_id: string | null;
  verified_institute_id: string | null;
  is_demo: boolean;
  suspended_at: string | null;
  created_at: string;
}

export interface Membership {
  id: string;
  user_id: string;
  institute_id: string;
  status: MembershipStatus;
  method: "institute_email" | "manual_review";
  institute_email: string | null;
  applicant_note: string | null;
  review_note: string | null;
  verified_at: string | null;
  created_at: string;
}

export interface SellerPreview {
  id: string;
  display_name: string;
  avatar_url?: string | null;
  account_type?: string | null;
  verified_institute_id: string | null;
  is_demo: boolean;
  created_at?: string;
}

export interface ListingImage {
  id?: string;
  storage_path: string;
  position: number;
}

export interface ListingCard {
  id: string;
  title: string;
  kind: ListingKind;
  price_paise: number | null;
  condition: string | null;
  listing_type: ListingType;
  status: ListingStatus;
  is_demo: boolean;
  created_at: string;
  published_at: string | null;
  category_id: string;
  institute_id: string;
  seller: SellerPreview | null;
  images: ListingImage[];
}

export interface Listing extends ListingCard {
  seller_id: string | null;
  description: string;
  negotiable: boolean;
  brand: string | null;
  model: string | null;
  purchase_date: string | null;
  original_price_paise: number | null;
  removed_by_moderator: boolean;
  sold_at: string | null;
  updated_at: string;
}

export interface Offer {
  id: string;
  listing_id: string;
  conversation_id: string;
  buyer_id: string | null;
  seller_id: string | null;
  made_by: string | null;
  parent_offer_id: string | null;
  amount_paise: number;
  status: OfferStatus;
  expires_at: string;
  responded_at: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  kind: "text" | "offer" | "system";
  body: string;
  offer_id: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

/** Result shape returned by server actions to forms. */
export type ActionState = { ok?: boolean; error?: string; message?: string; fieldErrors?: Record<string, string> } | null;
