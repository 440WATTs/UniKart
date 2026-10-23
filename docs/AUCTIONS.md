# Auction-style listings (not implemented, disabled)

UniKart v1 has fixed-price listings and optional offers only. There is no bidding, winner selection, deposit,
bid fee, paid entry, prize, or automated payment, and `app_settings.auctions_enabled` is `false`.

Before any auction feature is built, obtain qualified Indian legal advice covering consumer protection, contract,
payments, tax, privacy and platform obligations. Meeting the technical safeguards below does not by itself make the
feature legally compliant.

If approved, implement it separately from offers:

- New `auctions` and `bids` tables in their own migration; add `'auction'` to `listing_type` only then.
- Clear starting price, start/end time and rules shown before bidding.
- Bids placed only through a `SECURITY DEFINER` function that locks the auction row, rejects bids after the
  deadline, rejects seller self-bidding, and enforces a minimum increment.
- Transparent bid history; no seller edits once bidding starts; cancellation and dispute process; retained records.
- No paid participation or chance-based outcomes.
