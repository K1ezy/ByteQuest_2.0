-- Profile enrichment: user-editable presentation fields.
--
-- Adds an optional avatar image URL and a short free-text bio so every role can
-- maintain a richer profile. Both are nullable and have no backfill; existing
-- rows simply start empty.

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS avatar_url text,
    ADD COLUMN IF NOT EXISTS bio varchar(500);
