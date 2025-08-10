-- Job Applications table
CREATE TABLE IF NOT EXISTS job_applications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    candidate_id uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'accepted', 'rejected')),
    applied_at timestamptz DEFAULT now(),
    reviewed_at timestamptz,
    notes text,

-- Prevent duplicate applications
UNIQUE(job_id, candidate_id) );

-- Matching results table (stores calculated matches)
CREATE TABLE IF NOT EXISTS job_matches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    candidate_id uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    similarity_score numeric NOT NULL CHECK (similarity_score >= 0 AND similarity_score <= 1),
    skill_matches jsonb, -- Store detailed skill matching results
    calculated_at timestamptz DEFAULT now(),

-- Prevent duplicate match calculations
UNIQUE(job_id, candidate_id) );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS job_applications_job_id_idx ON job_applications (job_id);

CREATE INDEX IF NOT EXISTS job_applications_candidate_id_idx ON job_applications (candidate_id);

CREATE INDEX IF NOT EXISTS job_applications_status_idx ON job_applications (status);

CREATE INDEX IF NOT EXISTS job_applications_applied_at_idx ON job_applications (applied_at);

CREATE INDEX IF NOT EXISTS job_matches_job_id_idx ON job_matches (job_id);

CREATE INDEX IF NOT EXISTS job_matches_candidate_id_idx ON job_matches (candidate_id);

CREATE INDEX IF NOT EXISTS job_matches_similarity_idx ON job_matches (similarity_score DESC);

-- Function to trigger matching when a candidate applies
CREATE OR REPLACE FUNCTION trigger_job_matching()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert a job into the matching queue (you can implement this as needed)
    INSERT INTO job_status (id, type, status)
    VALUES (gen_random_uuid(), 'job_matching', 'queued')
    ON CONFLICT DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically start matching when someone applies
CREATE TRIGGER after_job_application_insert
    AFTER INSERT ON job_applications
    FOR EACH ROW
    EXECUTE FUNCTION trigger_job_matching();