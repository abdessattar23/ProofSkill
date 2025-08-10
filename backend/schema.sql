-- Candidates table
create table if not exists candidates (
    id uuid primary key default gen_random_uuid (),
    name text,
    email text unique,
    phone text,
    raw_cv_text text,
    created_at timestamptz default now()
);

-- Validated skills
create table if not exists candidate_skills (
    id uuid primary key default gen_random_uuid (),
    candidate_id uuid references candidates (id) on delete cascade,
    skill text not null,
    score numeric,
    created_at timestamptz default now()
);

-- Jobs
create table if not exists jobs (
    id uuid primary key default gen_random_uuid (),
    title text not null,
    description text,
    region text,
    salary_min numeric,
    salary_max numeric,
    created_at timestamptz default now()
);

-- Job required skills
create table if not exists job_skills (
    id uuid primary key default gen_random_uuid (),
    job_id uuid references jobs (id) on delete cascade,
    skill text not null,
    weight numeric default 1,
    created_at timestamptz default now()
);

-- Embeddings (for both candidates and jobs)
-- Enable pgvector extension (idempotent)
create extension if not exists vector;

create table if not exists embeddings (
    id uuid primary key default gen_random_uuid (),
    owner_type text check (
        owner_type in ('candidate', 'job')
    ),
    owner_id uuid not null,
    vector vector (768), -- Gemini text-embedding-004 dimension
    chunk_label text,
    created_at timestamptz default now()
);

create index if not exists embeddings_owner_idx on embeddings (owner_type, owner_id);

create index if not exists embeddings_vector_idx on embeddings using ivfflat (vector vector_cosine_ops)
with (lists = 100);

-- RPC helper for inserting embeddings via Supabase client
create or replace function insert_embedding(p_owner_type text, p_owner_id uuid, p_chunk_label text, p_vector vector)
returns uuid
language plpgsql
as $$
declare
    new_id uuid;
begin
    insert into embeddings(owner_type, owner_id, chunk_label, vector)
    values (p_owner_type, p_owner_id, p_chunk_label, p_vector)
    returning id into new_id;
    return new_id;
end;$$;

-- Candidate match RPC: returns candidate id, name, similarity
create or replace function match_candidates_for_job(p_job_id uuid, p_limit int default 20)
returns table(candidate_id uuid, name text, similarity double precision)
language sql
stable
as $$
    with job_vec as (
        select vector from embeddings where owner_type='job' and owner_id=p_job_id limit 1
    ), cand as (
        select c.id, c.name, e.vector
        from candidates c
        join embeddings e on e.owner_type='candidate' and e.owner_id=c.id
    )
    select cand.id as candidate_id, cand.name, (1 - (cand.vector <=> job_vec.vector)) as similarity
    from cand, job_vec
    order by similarity desc
    limit p_limit;
$$;

-- Queue / job status tracking
create table if not exists job_status (
    id uuid primary key,
    type text not null,
    status text not null default 'queued', -- queued|running|succeeded|failed
    error text,
    attempts int default 0,
    created_at timestamptz default now(),
    started_at timestamptz,
    finished_at timestamptz
);

-- Skill taxonomy
create table if not exists skills (
    id uuid primary key default gen_random_uuid (),
    name text unique not null,
    category text,
    created_at timestamptz default now()
);

create table if not exists skill_aliases (
    id uuid primary key default gen_random_uuid (),
    skill_id uuid references skills (id) on delete cascade,
    alias text not null,
    unique (skill_id, alias)
);

-- Interview sessions
create table if not exists interview_sessions (
    id uuid primary key default gen_random_uuid (),
    candidate_id uuid references candidates (id) on delete cascade,
    status text default 'active', -- active | completed
    created_at timestamptz default now()
);

create table if not exists interview_questions (
    id uuid primary key default gen_random_uuid (),
    session_id uuid references interview_sessions (id) on delete cascade,
    skill text not null,
    question text not null,
    created_at timestamptz default now()
);

create table if not exists interview_answers (
    id uuid primary key default gen_random_uuid (),
    question_id uuid references interview_questions (id) on delete cascade,
    transcript text,
    score numeric,
    reasoning text,
    created_at timestamptz default now()
);

-- Enable vector extension if not present (Supabase pgvector)
-- create extension if not exists vector;

-- Skill similarity matching function
create or replace function match_similar_skills (
  query_embedding vector(768),
  match_threshold float default 0.7,
  match_count int default 5
)
returns table (
  skill_id uuid,
  skill_name text,
  category text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    s.id as skill_id,
    s.name as skill_name,
    s.category,
    1 - (e.vector <=> query_embedding) as similarity
  from skills s
  join embeddings e on e.owner_id = s.id and e.owner_type = 'skill'
  where 1 - (e.vector <=> query_embedding) > match_threshold
  order by e.vector <=> query_embedding
  limit match_count;
end;
$$;