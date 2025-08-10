-- Add missing columns to interview_sessions table
-- First, remove the foreign key constraint temporarily
ALTER TABLE interview_sessions
DROP CONSTRAINT IF EXISTS interview_sessions_candidate_id_fkey;

-- Add the missing columns
ALTER TABLE interview_sessions
ADD COLUMN IF NOT EXISTS job_id UUID,
ADD COLUMN IF NOT EXISTS current_question_index INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_questions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS total_duration INTEGER,
ADD COLUMN IF NOT EXISTS average_score NUMERIC,
ADD COLUMN IF NOT EXISTS estimated_duration INTEGER DEFAULT 1800,
ADD COLUMN IF NOT EXISTS voice_id TEXT,
ADD COLUMN IF NOT EXISTS speaking_time_ms INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Note: Temporarily removing foreign key constraint to allow testing
-- The candidate_id will just be a UUID without constraint for now

-- Update status column to match expected values
ALTER TABLE interview_sessions
ALTER COLUMN status
SET DEFAULT 'created';

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_interview_sessions_candidate_id ON interview_sessions (candidate_id);

CREATE INDEX IF NOT EXISTS idx_interview_sessions_status ON interview_sessions (status);

CREATE INDEX IF NOT EXISTS idx_interview_sessions_job_id ON interview_sessions (job_id);

-- Add missing columns to interview_answers table
ALTER TABLE interview_answers
ADD COLUMN IF NOT EXISTS transcript_full TEXT,
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS duration_ms INTEGER;