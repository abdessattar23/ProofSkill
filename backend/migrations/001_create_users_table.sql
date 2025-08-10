-- ========================================
-- ProofSkill Database Schema Migration
-- ========================================

-- Create users table for authentication
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Create jobs table
CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    company VARCHAR(255),
    location VARCHAR(255),
    salary_range VARCHAR(100),
    requirements TEXT[],
    region VARCHAR(100),
    status VARCHAR(50) DEFAULT 'active',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create candidates table
CREATE TABLE IF NOT EXISTS candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    skills TEXT[],
    experience TEXT[],
    raw_cv_text TEXT,
    parsed_data JSONB,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create interview_sessions table
CREATE TABLE IF NOT EXISTS interview_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID REFERENCES candidates(id),
    skills TEXT[],
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Create interview_questions table
CREATE TABLE IF NOT EXISTS interview_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES interview_sessions(id) ON DELETE CASCADE,
    skill VARCHAR(255) NOT NULL,
    question TEXT NOT NULL,
    difficulty VARCHAR(50),
    category VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create interview_answers table
CREATE TABLE IF NOT EXISTS interview_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID REFERENCES interview_questions(id) ON DELETE CASCADE,
    transcript TEXT,
    score DECIMAL(3,1),
    reasoning TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create streaming_sessions table for audio streaming
CREATE TABLE IF NOT EXISTS streaming_sessions (
    id VARCHAR(255) PRIMARY KEY,
    candidate_id UUID REFERENCES candidates(id),
    status VARCHAR(50) DEFAULT 'active',
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create skills table for skills taxonomy
CREATE TABLE IF NOT EXISTS skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) UNIQUE NOT NULL,
    category VARCHAR(100),
    description TEXT,
    aliases TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create skill_aliases table for skill normalization
CREATE TABLE IF NOT EXISTS skill_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,
    alias VARCHAR(255) NOT NULL,
    confidence DECIMAL(3,2) DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create api_keys table for API key management
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_hash VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    user_id UUID REFERENCES users(id),
    permissions TEXT[],
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used TIMESTAMP WITH TIME ZONE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_candidates_email ON candidates(email);
CREATE INDEX IF NOT EXISTS idx_candidates_status ON candidates(status);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_candidate_id ON interview_sessions(candidate_id);
CREATE INDEX IF NOT EXISTS idx_interview_questions_session_id ON interview_questions(session_id);
CREATE INDEX IF NOT EXISTS idx_interview_answers_question_id ON interview_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_streaming_sessions_candidate_id ON streaming_sessions(candidate_id);
CREATE INDEX IF NOT EXISTS idx_streaming_sessions_last_activity ON streaming_sessions(last_activity);
CREATE INDEX IF NOT EXISTS idx_skills_name ON skills(name);
CREATE INDEX IF NOT EXISTS idx_skill_aliases_alias ON skill_aliases(alias);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);

-- Function to automatically update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to auto-update updated_at
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_jobs_updated_at 
    BEFORE UPDATE ON jobs 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_candidates_updated_at 
    BEFORE UPDATE ON candidates 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default admin user (password: 'admin123')
-- Password hash for 'admin123' using bcrypt with salt rounds 12
INSERT INTO users (id, email, password_hash, role) VALUES 
    ('00000000-0000-0000-0000-000000000001', 'admin@proofskill.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LvYT7jOtm3Kz8/tW6', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Insert test user (password: 'password123')  
-- Password hash for 'password123' using bcrypt with salt rounds 12
INSERT INTO users (id, email, password_hash, role) VALUES 
    ('00000000-0000-0000-0000-000000000002', 'test@example.com', '$2b$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user')
ON CONFLICT (email) DO NOTHING;

-- Insert sample candidate for testing
INSERT INTO candidates (id, name, email, skills, experience, raw_cv_text) VALUES 
    ('550e8400-e29b-41d4-a716-446655440000', 'Jane Smith', 'jane.smith@example.com', 
     ARRAY['React', 'Node.js', 'TypeScript', 'Python'], 
     ARRAY['Senior Developer at TechCorp', 'Software Engineer at StartupInc'], 
     'Sample CV content for Jane Smith...')
ON CONFLICT (email) DO NOTHING;

-- Insert sample job for testing
INSERT INTO jobs (id, title, description, company, location, requirements) VALUES 
    ('550e8400-e29b-41d4-a716-446655440001', 'Senior Full Stack Developer', 
     'Looking for an experienced developer with React and Node.js expertise',
     'ProofSkill Inc', 'Remote', 
     ARRAY['React', 'Node.js', 'TypeScript', '5+ years experience'])
ON CONFLICT (id) DO NOTHING;

-- Insert core skills for taxonomy
INSERT INTO skills (name, category, description) VALUES 
    ('JavaScript', 'Programming Language', 'Dynamic programming language'),
    ('TypeScript', 'Programming Language', 'Typed superset of JavaScript'),
    ('Python', 'Programming Language', 'High-level programming language'),
    ('React', 'Frontend Framework', 'JavaScript library for building UIs'),
    ('Node.js', 'Backend Technology', 'JavaScript runtime for server-side development'),
    ('PostgreSQL', 'Database', 'Object-relational database system'),
    ('MongoDB', 'Database', 'Document-oriented NoSQL database'),
    ('Docker', 'DevOps', 'Containerization platform'),
    ('Kubernetes', 'DevOps', 'Container orchestration system'),
    ('AWS', 'Cloud Platform', 'Amazon Web Services cloud platform')
ON CONFLICT (name) DO NOTHING;
