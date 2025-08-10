-- ========================================
-- Add first_time property to users table
-- Migration: 002_add_first_time_to_users
-- ========================================

-- Add first_time column to users table
-- Defaults to true for new candidates, false for other roles
ALTER TABLE users
ADD COLUMN IF NOT EXISTS first_time BOOLEAN DEFAULT true;

-- Update existing candidates to have first_time = true
-- Update existing non-candidates to have first_time = false
UPDATE users
SET
    first_time = CASE
        WHEN role = 'candidate' THEN true
        ELSE false
    END
WHERE
    first_time IS NULL;

-- Create index for first_time queries
CREATE INDEX IF NOT EXISTS idx_users_first_time ON users (first_time);

-- Add comment to document the column
COMMENT ON COLUMN users.first_time IS 'Indicates if this is the users first time login and needs to complete onboarding';