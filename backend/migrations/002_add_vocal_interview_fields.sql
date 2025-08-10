-- 002_add_vocal_interview_fields.sql
-- Add columns to support fully vocal interview flow.
ALTER TABLE interview_sessions
ADD COLUMN IF NOT EXISTS speaking_time_ms integer,
ADD COLUMN IF NOT EXISTS voice_id text;

ALTER TABLE interview_questions
ADD COLUMN IF NOT EXISTS audio_filename text,
ADD COLUMN IF NOT EXISTS audio_duration_seconds integer;

ALTER TABLE interview_answers
ADD COLUMN IF NOT EXISTS started_at timestamptz,
ADD COLUMN IF NOT EXISTS ended_at timestamptz,
ADD COLUMN IF NOT EXISTS duration_ms integer,
ADD COLUMN IF NOT EXISTS transcript_full text;