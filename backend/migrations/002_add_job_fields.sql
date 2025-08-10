-- Add missing fields to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS created_by uuid;

ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS salary_range text;

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS experience_level text;

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_type text;

-- Add check constraint for status field
DO $$ BEGIN
    ALTER TABLE jobs ADD CONSTRAINT jobs_status_check 
        CHECK (status IN ('active', 'inactive', 'closed', 'draft'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Add check constraint for experience_level field
DO $$ BEGIN
    ALTER TABLE jobs ADD CONSTRAINT jobs_experience_level_check 
        CHECK (experience_level IN ('entry', 'junior', 'mid', 'senior', 'lead', 'principal'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Add check constraint for job_type field
DO $$ BEGIN
    ALTER TABLE jobs ADD CONSTRAINT jobs_job_type_check 
        CHECK (job_type IN ('full-time', 'part-time', 'contract', 'freelance', 'internship'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Create index on created_by for faster queries
CREATE INDEX IF NOT EXISTS jobs_created_by_idx ON jobs (created_by);

-- Create index on status for faster filtering
CREATE INDEX IF NOT EXISTS jobs_status_idx ON jobs (status);