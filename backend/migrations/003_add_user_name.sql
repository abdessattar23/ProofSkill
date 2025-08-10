-- 003_add_user_name.sql
-- Adds a "name" column to users if it does not already exist.
-- Safe to run multiple times (uses IF NOT EXISTS) and within existing deployments.

BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS name text;

-- Optional: backfill logic placeholder (currently no deterministic source). Uncomment and adjust if you later
-- choose to derive names from email prefixes.
-- UPDATE users SET name = split_part(email,'@',1)
-- WHERE name IS NULL OR name = '';

COMMIT;