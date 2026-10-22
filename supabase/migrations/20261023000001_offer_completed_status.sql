-- Audit H5: an accepted offer becomes 'completed' when the item is marked sold,
-- so relisting the item doesn't leave a stale 'accepted' offer behind.
-- (Enum values must be committed before use, hence a separate migration.)
alter type public.offer_status add value if not exists 'completed';
