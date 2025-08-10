-- Add first_time column to users table
-- This tracks whether the user needs to complete their initial profile setup

ALTER TABLE users
ADD COLUMN IF NOT EXISTS first_time BOOLEAN NOT NULL DEFAULT TRUE;

-- Update existing users: set first_time to false for users who already exist
-- since they've presumably already completed their setup
UPDATE users SET first_time = FALSE WHERE created_at < NOW();

-- Create index for first_time queries
CREATE INDEX IF NOT EXISTS idx_users_first_time ON users (first_time);

-- For existing candidates, check if they have profile data and set first_time accordingly
UPDATE users
SET
    first_time = CASE
        WHEN role = 'candidate'
        AND EXISTS (
            SELECT 1
            FROM candidates c
            WHERE
                c.email = users.email
                AND c.raw_cv_text IS NOT NULL
                AND length(c.raw_cv_text) > 0
        ) THEN FALSE
        ELSE TRUE
    END
WHERE
    role = 'candidate';