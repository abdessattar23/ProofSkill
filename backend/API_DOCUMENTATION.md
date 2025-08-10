# ProofSkill Backend API Documentation

## 🏗️ Architecture Overview

ProofSkill is a comprehensive recruitment platform backend built with:

- **Framework**: Fastify v4 with TypeScript
- **Database**: Supabase PostgreSQL with full schema
- **Authentication**: JWT + bcrypt password hashing (API keys removed)
- **Storage**: Database-backed with Redis caching
- **AI Integration**: Google Gemini for question generation and evaluation
- **Audio**: ElevenLabs for Text-to-Speech and Speech-to-Text

## 📊 Database Schema

### Core Tables

- `users` - Authentication and user management
- `candidates` - Candidate profiles and CV data
- `jobs` - Job postings and requirements
- `interview_sessions` - Interview tracking
- `interview_questions` - AI-generated questions
- `interview_answers` - Candidate responses and scoring
- `streaming_sessions` - Audio streaming sessions
- `skills` - Skills taxonomy and categories
- `skill_aliases` - Skill normalization mapping
<!-- API keys removed; authentication relies solely on JWT -->

---

## 🔐 Authentication & Users

### Base URL: `/v1/api/auth`

#### Register User

```
POST /api/auth/register
Content-Type: application/json

Body:
{
  "email": "user@example.com",
  "password": "password123",
  "role": "user" // optional, defaults to "user"
}

Response:
{
  "success": true,
  "id": "uuid"
}
```

#### Login

```
POST /api/auth/login
Content-Type: application/json

Body:
{
  "email": "user@example.com",
  "password": "password123"
}

Response:
{
  "success": true,
  "token": "jwt_token_string"
}
```

#### Get User Profile

```
GET /api/auth/me
Authorization: Bearer <jwt_token>

Response:
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "user"
  }
}
```

---

## 📄 CV Processing

### Base URL: `/v1/api/cv`

#### Parse CV

```
POST /api/cv/parse
Content-Type: multipart/form-data
Authorization: Bearer <jwt_token>

Body: FormData with 'cv' file (PDF, DOC, DOCX, TXT)

Response:
{
  "success": true,
  "data": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "education": ["University of Technology", "Computer Science"],
    "skills": ["React", "Node.js", "TypeScript"],
    "experience": ["Senior Developer at TechCorp"],
    "certifications": ["AWS Certified Developer"]
  }
}
```

---

## 💼 Job Management

### Base URL: `/v1/api/jobs`

#### Create Job

```
POST /api/jobs
Content-Type: application/json

Body:
{
  "title": "Senior Full Stack Developer",
  "description": "Job description...",
  "region": "North America",
  "skills": ["React", "Node.js", "TypeScript"]
}

Response:
{
  "success": true,
  "id": "uuid"
}
```

#### Find Matching Candidates for Job

```
GET /api/jobs/:id/match
Query Parameters:
- page: Page number (default: 1)
- pageSize: Results per page (default: 20, max: 100)
- minSimilarity: Minimum similarity score 0-1 (default: 0)

Response:
{
  "success": true,
  "page": 1,
  "pageSize": 20,
  "total": 50,
  "data": [
    {
      "candidate_id": "uuid",
      "similarity": 0.85,
      "name": "Jane Smith",
      "email": "jane@example.com"
    }
  ]
}
```

---

## 👥 Candidate Management

### Base URL: `/v1/api/candidates`

#### Import Candidate

```
POST /api/candidates/import
Content-Type: application/json

Body:
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "phone": "+1234567890",
  "skills": ["React", "Node.js", "TypeScript"],
  "experience": ["Senior Developer at TechCorp"],
  "raw_cv_text": "CV content..."
}

Response:
{
  "success": true,
  "id": "uuid",
  "classified_skills": [
    {
      "skill": "React",
      "category": "Frontend Framework",
      "confidence": 0.95
    }
  ]
}
```

#### Store Validated Skills

```
POST /api/candidates/:id/validated-skills
Content-Type: application/json

Body:
{
  "skills": [
    {
      "skill": "React",
      "score": 8.5
    },
    {
      "skill": "Node.js",
      "score": 7.2
    }
  ],
  "threshold": 7.0
}

Response:
{
  "success": true,
  "saved": 2
}
```

#### Get Candidate by ID

```
GET /api/candidates/:id

Response:
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Jane Smith",
    "email": "jane@example.com",
    "phone": "+1234567890",
    "raw_cv_text": "CV content...",
    "validated_skills": [
      {
        "skill": "React",
        "score": 8.5
      }
    ]
  }
}
```

---

## 🎤 Interview System

### Base URL: `/v1/api/interview`

#### Create Interview Session (Legacy)

```
POST /api/interview/session
Authorization: Bearer <jwt_token>
Content-Type: application/json

Body:
{
  "candidate_id": "uuid",
  "skills": ["React", "Node.js"]
}

Response:
{
  "session_id": "uuid",
  "questions": [
    {
      "skill": "React",
      "question": "Explain React hooks and their benefits..."
    },
    {
      "skill": "Node.js",
      "question": "How would you handle errors in a Node.js API..."
    }
  ]
}
```

#### Create Advanced Interview Session

```
POST /api/interview/sessions
Authorization: Bearer <jwt_token>
Content-Type: application/json

Body:
{
  "candidateId": "uuid",
  "jobId": "uuid", // optional
  "interviewType": "technical", // technical, behavioral, mixed
  "difficulty": "intermediate", // beginner, intermediate, advanced, expert
  "skillsToAssess": ["React", "Node.js", "TypeScript"],
  "estimatedDuration": 3600 // optional, in seconds
}

Response:
{
  "sessionId": "uuid",
  "status": "active",
  "metadata": { ... },
  "createdAt": "timestamp"
}
```

#### Get Interview Session

```
GET /api/interview/sessions/:sessionId
Authorization: Bearer <jwt_token>

Response:
{
  "id": "uuid",
  "candidateId": "uuid",
  "status": "active",
  "metadata": { ... },
  "questions": [
    {
      "id": "uuid",
      "skill": "React",
      "question": "Question text...",
      "difficulty": "intermediate"
    }
  ]
}
```

#### Evaluate Answer (Legacy)

```
POST /api/interview/evaluate
Authorization: Bearer <jwt_token>
Content-Type: application/json

Body:
{
  "skill": "React",
  "question": "Explain React hooks...",
  "answer": "React hooks are..."
}

Response:
{
  "score": 8.5,
  "reasoning": "Good understanding demonstrated..."
}
```

#### Advanced Answer Evaluation

```
POST /api/interview/evaluations
Authorization: Bearer <jwt_token>
Content-Type: application/json

Body:
{
  "skill": "React",
  "question": "Explain React hooks...",
  "answer": "React hooks are...",
  "candidateLevel": "intermediate", // optional
  "jobRequirement": "senior-level React experience", // optional
  "contextualFactors": ["time pressure", "first interview"] // optional
}

Response:
{
  "evaluation": {
    "score": 8.5,
    "reasoning": "Detailed evaluation...",
    "strengths": ["Clear explanation", "Good examples"],
    "improvements": ["Could mention performance benefits"]
  },
  "evaluatedAt": "timestamp"
}
```

#### Streaming Evaluation

```
GET /api/interview/evaluate/stream?skill=React&question=...&answer=...
Authorization: Bearer <jwt_token>

Response: Server-Sent Events (SSE)
data: {"type": "progress", "stage": "analyzing"}
data: {"type": "score", "value": 8.5}
data: {"type": "reasoning", "text": "Good understanding..."}
data: {"type": "complete"}
```

#### Health Check

```
GET /api/interview/health

Response:
{
  "status": "healthy",
  "service": "interview",
  "timestamp": "timestamp",
  "checks": {
    "questionGeneration": true,
    "database": true
  }
}
```

---

## 🔊 Audio Services

### Base URL: `/v1/api/audio`

#### Text-to-Speech

```
POST /api/audio/tts
Authorization: Bearer <jwt_token>
Content-Type: application/json

Body:
{
  "text": "Hello, this is a test message",
  "voiceId": "alloy", // optional ElevenLabs voice ID
  "store": false // optional, whether to store the audio file
}

Response: Audio file (audio/mpeg) or JSON if store=true
{
  "success": true,
  "audioFile": { ... },
  "message": "Audio generated and stored"
}
```

#### Speech-to-Text

```
POST /api/audio/stt
Authorization: Bearer <jwt_token>
Content-Type: multipart/form-data

Body: FormData with 'file' (MP3, WAV, M4A, etc.)
Query Parameter: ?store=true (optional, to store uploaded audio)

Response:
{
  "success": true,
  "transcript": "Transcribed text from audio...",
  "audioFile": { ... } // if store=true
}
```

#### Get Available Voices

```
GET /api/audio/voices
Authorization: Bearer <jwt_token>

Response:
{
  "success": true,
  "voices": [
    {
      "voice_id": "alloy",
      "name": "Alloy",
      "category": "neutral"
    },
    {
      "voice_id": "echo",
      "name": "Echo",
      "category": "male"
    }
  ]
}
```

#### List Audio Files (Admin)

```
GET /api/audio/files?folder=interviews
Authorization: Bearer <jwt_token>
Requires: admin or recruiter role

Response:
{
  "success": true,
  "files": [
    {
      "id": "uuid",
      "filename": "interview_audio.mp3",
      "size": 1024000,
      "mimeType": "audio/mpeg",
      "createdAt": "timestamp"
    }
  ]
}
```

#### Get Signed URL for Audio File

```
GET /api/audio/files/:filename/signed-url?expiresIn=3600
Authorization: Bearer <jwt_token>

Response:
{
  "success": true,
  "signedUrl": "https://...",
  "expiresAt": "timestamp"
}
```

#### Delete Audio File (Admin)

```
DELETE /api/audio/files/:filename
Authorization: Bearer <jwt_token>
Requires: admin or recruiter role

Response:
{
  "success": true,
  "message": "Audio file deleted"
}
```

#### Cleanup Old Audio Files (Admin)

```
POST /api/audio/cleanup
Authorization: Bearer <jwt_token>
Requires: admin role
Content-Type: application/json

Body:
{
  "olderThanHours": 24 // optional, default 24
}

Response:
{
  "success": true,
  "deletedCount": 15
}
```

---

## 📡 Streaming Sessions

### Base URL: `/v1/api/streaming`

#### Create Streaming Session

```
POST /api/streaming/session
Authorization: Bearer <jwt_token>
Content-Type: application/json

Body:
{
  "candidate_id": "uuid", // optional
  "metadata": {
    "interview_type": "technical",
    "duration": 3600
  }
}

Response:
{
  "success": true,
  "session_id": "session_uuid",
  "status": "active",
  "created_at": "timestamp"
}
```

#### Upload Audio to Session

```
POST /api/streaming/upload/:sessionId
Authorization: Bearer <jwt_token>
Content-Type: multipart/form-data

Body: FormData with audio file

Response:
{
  "success": true,
  "message": "Audio uploaded successfully",
  "chunk_id": "uuid"
}
```

#### Get Streaming Session

```
GET /api/streaming/session/:sessionId
Authorization: Bearer <jwt_token>

Response:
{
  "success": true,
  "session": {
    "id": "uuid",
    "candidate_id": "uuid",
    "status": "active",
    "metadata": { ... },
    "created_at": "timestamp"
  }
}
```

#### Complete Streaming Session

```
POST /api/streaming/session/:sessionId/complete
Authorization: Bearer <jwt_token>

Response:
{
  "success": true,
  "session": {
    "id": "uuid",
    "status": "completed",
    "completed_at": "timestamp"
  }
}
```

#### Download Session Audio

```
GET /api/streaming/download/:sessionId
Authorization: Bearer <jwt_token>

Response: Combined audio file or JSON with download URL
```

#### Get Session Events (SSE)

```
GET /api/streaming/events/:sessionId
Authorization: Bearer <jwt_token>

Response: Server-Sent Events stream
data: {"type": "audio_chunk", "timestamp": "...", "size": 1024}
data: {"type": "session_update", "status": "recording"}
```

#### Delete Streaming Session

```
DELETE /api/streaming/session/:sessionId
Authorization: Bearer <jwt_token>

Response:
{
  "success": true,
  "message": "Session deleted successfully"
}
```

#### List All Streaming Sessions

```
GET /api/streaming/sessions
Authorization: Bearer <jwt_token>
Query Parameters:
- status: active/completed/deleted
- candidate_id: filter by candidate
- limit: number of results
- offset: pagination

Response:
{
  "success": true,
  "sessions": [
    {
      "id": "uuid",
      "candidate_id": "uuid",
      "status": "active",
      "created_at": "timestamp"
    }
  ],
  "total": 25
}
```

---

## 🧠 Skills Management

### Base URL: `/v1`

#### Seed Skills Taxonomy (Admin)

```
POST /v1/taxonomy/seed
Authorization: Bearer <jwt_token>
Requires: admin role

Response:
{
  "success": true,
  "data": {
    "skills": 500,
    "aliases": 1200
  }
}
```

#### Normalize Skills

```
POST /v1/skills/normalize
Content-Type: application/json

Body:
{
  "skill": "javascript"
}

Response:
{
  "success": true,
  "data": {
    "normalized": "JavaScript",
    "category": "Programming Language",
    "confidence": 0.95,
    "alternatives": ["ECMAScript", "JS"]
  }
}
```

#### Get Skill Suggestions

```
GET /v1/skills/suggestions?q=java&limit=10

Response:
{
  "success": true,
  "data": {
    "suggestions": [
      "JavaScript",
      "Java",
      "TypeScript"
    ]
  }
}
```

---

## 🎯 Matching System

### Base URL: `/v1/matching`

#### Candidate-Job Matching

```
POST /candidate-job
Content-Type: application/json
Optional: Authorization: Bearer <jwt_token>

Body:
{
  "candidateId": "uuid",
  "jobId": "uuid",
  "weights": {
    "skills": 0.5,      // optional, default 0.5
    "location": 0.2,    // optional, default 0.2
    "experience": 0.2,  // optional, default 0.2
    "salary": 0.1       // optional, default 0.1
  }
}

Response:
{
  "success": true,
  "data": {
    "candidateId": "uuid",
    "jobId": "uuid",
    "totalScore": 0.85,
    "skillScore": 0.90,
    "locationScore": 0.75,
    "experienceScore": 1.0,
    "salaryScore": 0.80,
    "breakdown": {
      "matchedSkills": [
        {
          "skill": "React",
          "score": 0.95
        }
      ],
      "locationMatch": true,
      "experienceMatch": true,
      "salaryMatch": true
    }
  }
}
```

#### Skill Matching Only

```
POST /skills
Content-Type: application/json

Body:
{
  "candidateSkills": ["React", "Node.js", "TypeScript"],
  "jobSkills": ["React", "Node.js", "JavaScript"],
  "threshold": 0.75 // optional, default 0.75
}

Response:
{
  "success": true,
  "data": {
    "score": 0.67,
    "matches": [
      {
        "skill": "React",
        "score": 1.0
      },
      {
        "skill": "Node.js",
        "score": 1.0
      }
    ]
  }
}
```

#### Batch Matching

```
POST /batch
Authorization: Bearer <jwt_token>
Content-Type: application/json

Body:
{
  "candidateIds": ["uuid1", "uuid2"],
  "jobIds": ["uuid3", "uuid4"],
  "minScore": 0.3,    // optional, default 0.3
  "limit": 100        // optional, default 100
}

Response:
{
  "success": true,
  "data": {
    "matches": [
      {
        "candidateId": "uuid1",
        "jobId": "uuid3",
        "totalScore": 0.85,
        "skillScore": 0.90,
        "locationScore": 0.75,
        "experienceScore": 1.0,
        "salaryScore": 0.80
      }
    ],
    "total": 15,
    "processed": 4
  }
}
```

---

## 📊 Monitoring & Analytics

### Base URL: `/v1`

#### Get Prometheus Metrics

```
GET /v1/metrics

Response: Prometheus formatted metrics (text/plain)
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",status="200"} 1234
...
```

#### Get Detailed Health Check

```
GET /v1/health

Response:
{
  "status": "healthy", // healthy, degraded, unhealthy
  "timestamp": "timestamp",
  "uptime": 3600,
  "version": "1.0.0",
  "components": {
    "database": {
      "status": "healthy",
      "responseTime": 25
    },
    "redis": {
      "status": "healthy",
      "responseTime": 5
    },
    "gemini": {
      "status": "healthy",
      "circuitBreakerState": "closed"
    },
    "elevenlabs": {
      "status": "healthy",
      "circuitBreakerState": "closed"
    }
  }
}
```

---

## 📋 Queue Management

### Base URL: `/v1/api/queue`

#### Get Dead Letter Queue Jobs (Admin)

```
GET /api/queue/dlq
Authorization: Bearer <jwt_token>
Requires: admin role

Response:
{
  "success": true,
  "jobs": [
    {
      "id": "uuid",
      "type": "evaluation",
      "payload": { ... },
      "attempts": 3,
      "error": "Timeout error",
      "created": 1234567890
    }
  ]
}
```

#### Replay Failed Job (Admin)

```
POST /api/queue/dlq/:jobId/replay
Authorization: Bearer <jwt_token>
Requires: admin role

Response:
{
  "success": true,
  "replayed": true
}
```

#### Get Queue Statistics (Admin)

```
GET /api/queue/stats
Authorization: Bearer <jwt_token>
Requires: admin role

Response:
{
  "success": true,
  "stats": {
    "queued": 5,
    "running": 2,
    "succeeded": 1250,
    "failed": 3,
    "retry": 1
  }
}
```

---

## 🔑 Authentication & Authorization

### JWT Token Authentication

Include in headers:

```
Authorization: Bearer your_jwt_token_here
```

### Default Admin User

- Email: `admin@proofskill.com`
- Password: `admin123`

---

## 🏥 Health & Status

### Health Check

```
GET /healthz

Response:
{
  "ok": true,
  "version": "v1"
}
```

### API Documentation

```
GET /openapi.json

Response: OpenAPI 3.0 specification JSON
```

---

## 🔧 Environment Configuration

### Required Environment Variables

```bash
# Database
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# JWT
JWT_SECRET=your_jwt_secret_key

# Google AI
GEMINI_API_KEY=your_gemini_api_key

# ElevenLabs Audio
ELEVENLABS_API_KEY=your_elevenlabs_api_key

# Redis (optional)
REDIS_URL=redis://localhost:6379

# Server
PORT=4000
NODE_ENV=development
```

---

## 📁 Project Structure

```
src/
├── routes/           # API route handlers
│   ├── auth.ts      # Authentication endpoints
│   ├── cv.ts        # CV processing endpoints
│   ├── jobs.ts      # Job management endpoints
│   ├── candidates.ts # Candidate management
│   ├── interview.ts # Interview system
│   ├── audio.ts     # Audio services
│   ├── streaming.ts # Real-time streaming
│   ├── skills.ts    # Skills management
│   ├── matching.ts  # Matching algorithms
│   ├── monitoring.ts # Health & metrics
│   └── queue.ts     # Queue management
├── services/         # Business logic services
│   ├── authService.ts
│   ├── cvService.ts
│   ├── aiService.ts
│   ├── audioService.ts
│   ├── streamingSessionService.ts
│   └── advancedMatching.ts
├── middleware/       # Custom middleware
│   └── auth.ts      # Authentication middleware
├── lib/             # Shared utilities
│   ├── supabase.ts  # Database client
│   ├── redis.ts     # Caching client
│   └── swagger.ts   # API documentation
└── types/           # TypeScript type definitions
```

---

## 🚀 Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Environment

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Setup Database

```bash
npm run setup    # Configure environment
npm run migrate  # Create database schema
```

### 4. Start Development Server

```bash
npm run dev
```

### 5. Access API Documentation

- Health Check: http://localhost:4000/healthz
- OpenAPI Docs: http://localhost:4000/openapi.json
- Swagger UI: Available via Fastify Swagger plugin

---

## 📝 Sample Data

The database includes sample data for testing:

- Admin user: `admin@proofskill.com` / `admin123`
- Test user: `test@example.com` / `password123`
- Sample candidate: Jane Smith with React/Node.js skills
- Sample job: Senior Full Stack Developer position
- 30+ skills in taxonomy with aliases
- Skills categories: Programming Languages, Frameworks, Databases, etc.

---

## 🔗 Integration Notes

### For Frontend Development:

1. All endpoints return consistent JSON responses with `success` field
2. Errors include detailed `error` messages and appropriate HTTP status codes
3. File uploads use `multipart/form-data` format
4. WebSocket connections available for real-time audio streaming
5. Pagination supported with `limit` and `offset` parameters
6. Authentication via JWT tokens only
7. CORS enabled for cross-origin requests

### Performance Considerations:

- Database indexes on all searchable fields
- Redis caching for expensive operations
- Streaming responses for large datasets
- Background job processing for heavy operations
- Rate limiting on public endpoints

---

This documentation covers all available endpoints and services in the ProofSkill backend. Use this as your complete reference when building the frontend! 🎯
