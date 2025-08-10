-- ========================================
-- ProofSkill Database Complete Reset & Setup
-- WARNING: This will DELETE ALL DATA!
-- ========================================

-- Drop all tables in reverse dependency order to avoid foreign key conflicts
DROP TABLE IF EXISTS interview_answers CASCADE;

DROP TABLE IF EXISTS interview_questions CASCADE;

DROP TABLE IF EXISTS interview_sessions CASCADE;

DROP TABLE IF EXISTS streaming_sessions CASCADE;

DROP TABLE IF EXISTS skill_aliases CASCADE;

DROP TABLE IF EXISTS skills CASCADE;

DROP TABLE IF EXISTS api_keys CASCADE;

DROP TABLE IF EXISTS candidates CASCADE;

DROP TABLE IF EXISTS jobs CASCADE;

DROP TABLE IF EXISTS users CASCADE;

-- Drop the update function if it exists
DROP FUNCTION IF EXISTS update_updated_at_column () CASCADE;

-- ========================================
-- CREATE ALL TABLES FROM SCRATCH
-- ========================================

-- Create users table for authentication
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW()
);

-- Create candidates table
CREATE TABLE candidates (
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

-- Create jobs table
CREATE TABLE jobs (
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

-- Create interview_sessions table
CREATE TABLE interview_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID REFERENCES candidates(id),
    skills TEXT[],
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Create interview_questions table
CREATE TABLE interview_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    session_id UUID REFERENCES interview_sessions (id) ON DELETE CASCADE,
    skill VARCHAR(255) NOT NULL,
    question TEXT NOT NULL,
    difficulty VARCHAR(50),
    category VARCHAR(100),
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW()
);

-- Create interview_answers table
CREATE TABLE interview_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    question_id UUID REFERENCES interview_questions (id) ON DELETE CASCADE,
    transcript TEXT,
    score DECIMAL(3, 1),
    reasoning TEXT,
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW()
);

-- Create streaming_sessions table for audio streaming
CREATE TABLE streaming_sessions (
    id VARCHAR(255) PRIMARY KEY,
    candidate_id UUID REFERENCES candidates (id),
    status VARCHAR(50) DEFAULT 'active',
    metadata JSONB,
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW(),
        last_activity TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW()
);

-- Create skills table for skills taxonomy
CREATE TABLE skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) UNIQUE NOT NULL,
    category VARCHAR(100),
    description TEXT,
    aliases TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create skill_aliases table for skill normalization
CREATE TABLE skill_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    skill_id UUID REFERENCES skills (id) ON DELETE CASCADE,
    alias VARCHAR(255) NOT NULL,
    confidence DECIMAL(3, 2) DEFAULT 1.0,
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW()
);

-- Create api_keys table for API key management
CREATE TABLE api_keys (
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

-- ========================================
-- CREATE INDEXES FOR PERFORMANCE
-- ========================================

-- Users table indexes
CREATE INDEX idx_users_email ON users (email);

CREATE INDEX idx_users_role ON users (role);

-- Candidates table indexes
CREATE INDEX idx_candidates_email ON candidates (email);

CREATE INDEX idx_candidates_status ON candidates (status);

-- Jobs table indexes
CREATE INDEX idx_jobs_status ON jobs (status);

CREATE INDEX idx_jobs_created_at ON jobs (created_at);

CREATE INDEX idx_jobs_created_by ON jobs (created_by);

-- Interview tables indexes
CREATE INDEX idx_interview_sessions_candidate_id ON interview_sessions (candidate_id);

CREATE INDEX idx_interview_sessions_status ON interview_sessions (status);

CREATE INDEX idx_interview_questions_session_id ON interview_questions (session_id);

CREATE INDEX idx_interview_questions_skill ON interview_questions (skill);

CREATE INDEX idx_interview_answers_question_id ON interview_answers (question_id);

-- Streaming sessions indexes
CREATE INDEX idx_streaming_sessions_candidate_id ON streaming_sessions (candidate_id);

CREATE INDEX idx_streaming_sessions_status ON streaming_sessions (status);

CREATE INDEX idx_streaming_sessions_last_activity ON streaming_sessions (last_activity);

-- Skills indexes
CREATE INDEX idx_skills_name ON skills (name);

CREATE INDEX idx_skills_category ON skills (category);

CREATE INDEX idx_skill_aliases_alias ON skill_aliases (alias);

CREATE INDEX idx_skill_aliases_skill_id ON skill_aliases (skill_id);

-- API keys indexes
CREATE INDEX idx_api_keys_hash ON api_keys (key_hash);

CREATE INDEX idx_api_keys_user_id ON api_keys (user_id);

CREATE INDEX idx_api_keys_is_active ON api_keys (is_active);

-- ========================================
-- CREATE TRIGGERS AND FUNCTIONS
-- ========================================

-- Function to automatically update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_candidates_updated_at 
    BEFORE UPDATE ON candidates 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_jobs_updated_at 
    BEFORE UPDATE ON jobs 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- INSERT INITIAL DATA
-- ========================================

-- Insert default admin user (password: 'admin123')
-- Password hash for 'admin123' using bcrypt with salt rounds 12
INSERT INTO
    users (
        id,
        email,
        password_hash,
        role
    )
VALUES (
        '00000000-0000-0000-0000-000000000001',
        'admin@proofskill.com',
        '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LvYT7jOtm3Kz8/tW6',
        'admin'
    );

-- Insert test user (password: 'password123')
-- Password hash for 'password123' using bcrypt with salt rounds 12
INSERT INTO
    users (
        id,
        email,
        password_hash,
        role
    )
VALUES (
        '00000000-0000-0000-0000-000000000002',
        'test@example.com',
        '$2b$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
        'user'
    );

-- Insert sample candidate for testing
INSERT INTO candidates (id, name, email, skills, experience, raw_cv_text, status) VALUES 
    ('550e8400-e29b-41d4-a716-446655440000', 'Jane Smith', 'jane.smith@example.com', 
     ARRAY['React', 'Node.js', 'TypeScript', 'Python'], 
     ARRAY['Senior Developer at TechCorp', 'Software Engineer at StartupInc'], 
     'Sample CV content for Jane Smith...', 'active');

-- Insert sample job for testing
INSERT INTO jobs (id, title, description, company, location, requirements, created_by) VALUES 
    ('550e8400-e29b-41d4-a716-446655440001', 'Senior Full Stack Developer', 
     'Looking for an experienced developer with React and Node.js expertise',
     'ProofSkill Inc', 'Remote', 
     ARRAY['React', 'Node.js', 'TypeScript', '5+ years experience'],
     '00000000-0000-0000-0000-000000000001');

-- Insert core skills for taxonomy
INSERT INTO
    skills (name, category, description)
VALUES (
        'JavaScript',
        'Programming Language',
        'Dynamic programming language'
    ),
    (
        'TypeScript',
        'Programming Language',
        'Typed superset of JavaScript'
    ),
    (
        'Python',
        'Programming Language',
        'High-level programming language'
    ),
    (
        'Java',
        'Programming Language',
        'Object-oriented programming language'
    ),
    (
        'C++',
        'Programming Language',
        'System programming language'
    ),
    (
        'React',
        'Frontend Framework',
        'JavaScript library for building UIs'
    ),
    (
        'Vue.js',
        'Frontend Framework',
        'Progressive JavaScript framework'
    ),
    (
        'Angular',
        'Frontend Framework',
        'TypeScript-based web framework'
    ),
    (
        'Node.js',
        'Backend Technology',
        'JavaScript runtime for server-side development'
    ),
    (
        'Express.js',
        'Backend Framework',
        'Web framework for Node.js'
    ),
    (
        'Django',
        'Backend Framework',
        'Python web framework'
    ),
    (
        'Flask',
        'Backend Framework',
        'Lightweight Python web framework'
    ),
    (
        'Spring Boot',
        'Backend Framework',
        'Java framework for microservices'
    ),
    (
        'PostgreSQL',
        'Database',
        'Object-relational database system'
    ),
    (
        'MongoDB',
        'Database',
        'Document-oriented NoSQL database'
    ),
    (
        'Redis',
        'Database',
        'In-memory data structure store'
    ),
    (
        'MySQL',
        'Database',
        'Relational database management system'
    ),
    (
        'Docker',
        'DevOps',
        'Containerization platform'
    ),
    (
        'Kubernetes',
        'DevOps',
        'Container orchestration system'
    ),
    (
        'AWS',
        'Cloud Platform',
        'Amazon Web Services cloud platform'
    ),
    (
        'Azure',
        'Cloud Platform',
        'Microsoft cloud platform'
    ),
    (
        'Google Cloud',
        'Cloud Platform',
        'Google cloud platform'
    ),
    (
        'Git',
        'Version Control',
        'Distributed version control system'
    ),
    (
        'Jenkins',
        'CI/CD',
        'Automation server for CI/CD'
    ),
    (
        'Jest',
        'Testing',
        'JavaScript testing framework'
    ),
    (
        'Cypress',
        'Testing',
        'End-to-end testing framework'
    ),
    (
        'HTML5',
        'Frontend',
        'Markup language for web pages'
    ),
    (
        'CSS3',
        'Frontend',
        'Styling language for web pages'
    ),
    (
        'SASS',
        'Frontend',
        'CSS preprocessor'
    ),
    (
        'Webpack',
        'Build Tool',
        'Module bundler for JavaScript'
    );

-- Insert some skill aliases for better matching
INSERT INTO
    skill_aliases (skill_id, alias, confidence)
VALUES (
        (
            SELECT id
            FROM skills
            WHERE
                name = 'JavaScript'
        ),
        'JS',
        0.95
    ),
    (
        (
            SELECT id
            FROM skills
            WHERE
                name = 'JavaScript'
        ),
        'ECMAScript',
        0.90
    ),
    (
        (
            SELECT id
            FROM skills
            WHERE
                name = 'TypeScript'
        ),
        'TS',
        0.95
    ),
    (
        (
            SELECT id
            FROM skills
            WHERE
                name = 'React'
        ),
        'ReactJS',
        0.95
    ),
    (
        (
            SELECT id
            FROM skills
            WHERE
                name = 'React'
        ),
        'React.js',
        0.95
    ),
    (
        (
            SELECT id
            FROM skills
            WHERE
                name = 'Vue.js'
        ),
        'Vue',
        0.95
    ),
    (
        (
            SELECT id
            FROM skills
            WHERE
                name = 'Vue.js'
        ),
        'VueJS',
        0.90
    ),
    (
        (
            SELECT id
            FROM skills
            WHERE
                name = 'Node.js'
        ),
        'Node',
        0.95
    ),
    (
        (
            SELECT id
            FROM skills
            WHERE
                name = 'Node.js'
        ),
        'NodeJS',
        0.95
    ),
    (
        (
            SELECT id
            FROM skills
            WHERE
                name = 'PostgreSQL'
        ),
        'Postgres',
        0.95
    ),
    (
        (
            SELECT id
            FROM skills
            WHERE
                name = 'PostgreSQL'
        ),
        'psql',
        0.85
    ),
    (
        (
            SELECT id
            FROM skills
            WHERE
                name = 'MongoDB'
        ),
        'Mongo',
        0.90
    ),
    (
        (
            SELECT id
            FROM skills
            WHERE
                name = 'Amazon Web Services'
        ),
        'AWS',
        1.00
    ),
    (
        (
            SELECT id
            FROM skills
            WHERE
                name = 'Google Cloud'
        ),
        'GCP',
        0.95
    ),
    (
        (
            SELECT id
            FROM skills
            WHERE
                name = 'Google Cloud'
        ),
        'Google Cloud Platform',
        1.00
    );

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- Verify table creation
SELECT 'users' as table_name, COUNT(*) as record_count
FROM users
UNION ALL
SELECT 'candidates', COUNT(*)
FROM candidates
UNION ALL
SELECT 'jobs', COUNT(*)
FROM jobs
UNION ALL
SELECT 'skills', COUNT(*)
FROM skills
UNION ALL
SELECT 'skill_aliases', COUNT(*)
FROM skill_aliases
UNION ALL
SELECT 'interview_sessions', COUNT(*)
FROM interview_sessions
UNION ALL
SELECT 'interview_questions', COUNT(*)
FROM interview_questions
UNION ALL
SELECT 'interview_answers', COUNT(*)
FROM interview_answers
UNION ALL
SELECT 'streaming_sessions', COUNT(*)
FROM streaming_sessions
UNION ALL
SELECT 'api_keys', COUNT(*)
FROM api_keys
ORDER BY table_name;

-- Show created users
SELECT 'Created Users:' as info, email, role FROM users;

-- Show created candidates
SELECT 'Created Candidates:' as info, name, email, status
FROM candidates;

-- Show created jobs
SELECT 'Created Jobs:' as info, title, company, status FROM jobs;

-- Show skills count by category
SELECT 'Skills by Category:' as info, category, COUNT(*) as count
FROM skills
GROUP BY
    category
ORDER BY count DESC;