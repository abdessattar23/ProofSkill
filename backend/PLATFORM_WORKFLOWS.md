# ProofSkill Platform Workflows: Backend ↔ Frontend Integration

## 🎯 **Platform Overview**

ProofSkill is a comprehensive recruitment platform with two main user types:

- **👤 Candidates**: Job seekers looking for opportunities
- **🏢 Businesses**: Recruiters and companies hiring talent

---

## 👤 **CANDIDATE WORKFLOW**

### 📝 **1. Registration & Onboarding**

```mermaid
sequenceDiagram
    participant C as Candidate Frontend
    participant B as Backend API
    participant DB as Database
    participant EL as ElevenLabs

    C->>B: POST /api/auth/register
    Note over C,B: {email, password}
    B->>DB: Create user record
    B->>C: {success: true, id: uuid}

    C->>B: POST /api/auth/login
    Note over C,B: {email, password}
    B->>C: {success: true, token: jwt}

    C->>B: GET /api/auth/me
    Note over C,B: Authorization: Bearer <token>
    B->>C: {user: {id, email, role}}
```

### 📄 **2. CV Upload & Processing**

```mermaid
sequenceDiagram
    participant C as Candidate Frontend
    participant B as Backend API
    participant AI as Gemini AI
    participant DB as Database

    C->>B: POST /api/cv/parse
    Note over C,B: FormData: cv file (PDF/DOCX)
    B->>AI: Extract skills & experience
    AI->>B: Parsed CV data
    B->>DB: Store candidate profile
    B->>C: {success: true, data: {skills, experience}}

    C->>B: POST /api/candidates/import
    Note over C,B: {name, email, skills, experience}
    B->>C: {success: true, id: uuid, classified_skills}

    C->>B: POST /api/candidates/:id/validated-skills
    Note over C,B: {skills: [{skill, score}]}
    B->>DB: Store validated skills
    B->>C: {success: true, saved: count}
```

### 🎤 **3. Interview Process**

```mermaid
sequenceDiagram
    participant C as Candidate Frontend
    participant B as Backend API
    participant AI as Gemini AI
    participant EL as ElevenLabs
    participant DB as Database

    Note over C,B: Interview Session Creation
    C->>B: POST /api/interview/session
    Note over C,B: {candidate_id, skills: ["React", "Node.js"]}
    B->>AI: Generate questions for skills
    AI->>B: Technical questions
    B->>DB: Store session & questions
    B->>C: {session_id, questions}

    Note over C,B: Audio Question Playback
    C->>B: POST /api/audio/tts
    Note over C,B: {text: "question text", voiceId: "aria"}
    B->>EL: Text-to-Speech conversion
    EL->>B: Audio file (MP3)
    B->>C: Audio stream

    Note over C,B: Answer Recording & Transcription
    C->>B: POST /api/audio/stt
    Note over C,B: FormData: audio file
    B->>EL: Speech-to-Text conversion
    EL->>B: Transcript text
    B->>AI: Evaluate answer quality
    AI->>B: Score & feedback
    B->>DB: Store answer & evaluation
    B->>C: {success: true, transcript, score, reasoning}

    Note over C,B: Real-time Streaming
    C->>B: WebSocket /api/streaming/session
    B->>C: Real-time audio processing
    C->>B: POST /api/streaming/upload/:sessionId
    B->>C: Live transcription updates
```

### 📊 **4. Results & Matching**

```mermaid
sequenceDiagram
    participant C as Candidate Frontend
    participant B as Backend API
    participant DB as Database

    C->>B: GET /api/candidates/:id
    B->>DB: Fetch candidate profile
    B->>C: {data: {name, skills, validated_skills}}

    C->>B: POST /v1/matching/candidate-job
    Note over C,B: {candidateId, jobId, weights}
    B->>DB: Calculate compatibility score
    B->>C: {totalScore, skillScore, breakdown}

    C->>B: GET /api/jobs/:id/match
    Note over C,B: Find matching jobs
    B->>C: {data: [{job_id, similarity, title}]}
```

---

## 🏢 **BUSINESS WORKFLOW**

### 👨‍💼 **1. Recruiter Registration & Setup**

```mermaid
sequenceDiagram
    participant R as Recruiter Frontend
    participant B as Backend API
    participant DB as Database

    R->>B: POST /api/auth/register
    Note over R,B: {email, password, role: "admin"}
    B->>DB: Create business user
    B->>R: {success: true, id: uuid}

    R->>B: POST /api/auth/login
    B->>R: {success: true, token: jwt}

    R->>B: GET /api/auth/me
    B->>R: {user: {id, email, role: "admin"}}
```

### 💼 **2. Job Management**

```mermaid
sequenceDiagram
    participant R as Recruiter Frontend
    participant B as Backend API
    participant AI as Gemini AI
    participant DB as Database

    R->>B: POST /api/jobs
    Note over R,B: {title, description, skills, region}
    B->>AI: Generate job embeddings
    AI->>B: Vector embeddings
    B->>DB: Store job with embeddings
    B->>R: {success: true, id: uuid}

    R->>B: GET /api/jobs/:id/match
    Note over R,B: Find matching candidates
    B->>DB: Vector similarity search
    B->>R: {data: [{candidate_id, similarity, name}]}
```

### 👥 **3. Candidate Management**

```mermaid
sequenceDiagram
    participant R as Recruiter Frontend
    participant B as Backend API
    participant DB as Database

    R->>B: POST /api/candidates/import
    Note over R,B: CSV file upload
    B->>DB: Bulk import candidates
    B->>R: {success: true, imported: 150, errors: 2}

    R->>B: GET /api/candidates/:id
    B->>DB: Fetch candidate details
    B->>R: {data: {profile, skills, experience}}

    R->>B: POST /v1/matching/batch
    Note over R,B: {candidateIds, jobIds, criteria}
    B->>DB: Batch matching algorithm
    B->>R: {matches: [{candidateId, jobId, totalScore}]}
```

### 🎯 **4. Advanced Matching & Analytics**

```mermaid
sequenceDiagram
    participant R as Recruiter Frontend
    participant B as Backend API
    participant DB as Database

    R->>B: POST /v1/matching/candidate-job
    Note over R,B: {candidateId, jobId, weights}
    B->>DB: Advanced scoring algorithm
    B->>R: {totalScore, breakdown, matchedSkills}

    R->>B: POST /v1/skills/normalize
    Note over R,B: {skill: "javascript"}
    B->>DB: Skill taxonomy lookup
    B->>R: {normalized: "JavaScript", category, confidence}

    R->>B: GET /v1/skills/suggestions?q=java
    B->>DB: Autocomplete search
    B->>R: {suggestions: ["JavaScript", "Java"]}
```

### 📊 **5. Monitoring & Administration**

```mermaid
sequenceDiagram
    participant R as Recruiter Frontend
    participant B as Backend API
    participant DB as Database
    participant Q as Queue System

    R->>B: GET /v1/health
    B->>DB: Check database status
    B->>R: {status: "healthy", components: {...}}

    R->>B: GET /v1/metrics
    B->>R: Prometheus metrics data

    R->>B: GET /api/queue/stats
    Note over R,B: Admin only
    B->>Q: Get queue statistics
    B->>R: {stats: {queued, running, succeeded}}

    R->>B: GET /api/audio/files
    Note over R,B: Admin/Recruiter only
    B->>DB: List stored audio files
    B->>R: {files: [{id, filename, size}]}
```

---

## 🔄 **REAL-TIME FEATURES**

### 🎙️ **Live Interview Streaming**

```mermaid
sequenceDiagram
    participant C as Candidate Frontend
    participant R as Recruiter Frontend
    participant B as Backend API
    participant EL as ElevenLabs

    Note over C,R: Real-time Interview Session
    C->>B: WebSocket /api/streaming/session/:id
    R->>B: WebSocket /api/streaming/session/:id

    C->>B: Audio chunk upload
    B->>EL: Real-time transcription
    EL->>B: Live transcript
    B->>R: Live transcript update
    B->>C: Transcription confirmation

    R->>B: POST /api/interview/evaluations
    B->>C: Real-time feedback
    B->>R: Evaluation stored
```

### 📡 **Server-Sent Events (SSE)**

```mermaid
sequenceDiagram
    participant F as Frontend
    participant B as Backend API
    participant AI as Gemini AI

    F->>B: GET /api/interview/evaluate/stream
    Note over F,B: SSE connection established

    B->>AI: Stream evaluation request
    AI->>B: Chunk 1: Analysis progress
    B->>F: data: {"type": "progress", "stage": "analyzing"}

    AI->>B: Chunk 2: Score calculation
    B->>F: data: {"type": "score", "value": 8.5}

    AI->>B: Chunk 3: Reasoning
    B->>F: data: {"type": "reasoning", "text": "Good understanding..."}

    AI->>B: Final chunk
    B->>F: data: {"type": "complete"}
```

---

## 🎨 **FRONTEND ARCHITECTURE RECOMMENDATIONS**

### 📱 **Candidate App Structure**

```
candidate-app/
├── pages/
│   ├── auth/
│   │   ├── register.tsx
│   │   └── login.tsx
│   ├── dashboard/
│   │   ├── index.tsx
│   │   └── profile.tsx
│   ├── cv/
│   │   ├── upload.tsx
│   │   └── results.tsx
│   ├── interview/
│   │   ├── session.tsx
│   │   ├── questions.tsx
│   │   └── results.tsx
│   └── jobs/
│       ├── search.tsx
│       └── matches.tsx
├── components/
│   ├── AudioRecorder.tsx
│   ├── AudioPlayer.tsx
│   ├── SkillsDisplay.tsx
│   ├── MatchingScore.tsx
│   └── InterviewProgress.tsx
└── hooks/
    ├── useAuth.ts
    ├── useAudio.ts
    ├── useWebSocket.ts
    └── useInterview.ts
```

### 🏢 **Business Dashboard Structure**

```
business-app/
├── pages/
│   ├── auth/
│   ├── dashboard/
│   │   ├── index.tsx
│   │   └── analytics.tsx
│   ├── jobs/
│   │   ├── create.tsx
│   │   ├── list.tsx
│   │   └── [id]/candidates.tsx
│   ├── candidates/
│   │   ├── import.tsx
│   │   ├── search.tsx
│   │   └── [id]/profile.tsx
│   ├── matching/
│   │   ├── algorithm.tsx
│   │   └── results.tsx
│   └── admin/
│       ├── monitoring.tsx
│       └── queue.tsx
├── components/
│   ├── CandidateCard.tsx
│   ├── JobCard.tsx
│   ├── MatchingVisual.tsx
│   ├── AudioManager.tsx
│   └── AnalyticsDashboard.tsx
└── hooks/
    ├── useAdmin.ts
    ├── useMatching.ts
    ├── useCandidates.ts
    └── useJobs.ts
```

---

## 🔗 **KEY INTEGRATION POINTS**

### 🔐 **Authentication Flow**

- JWT tokens for session management
- Role-based access control (user/admin)
- API key authentication for admin features

### 📁 **File Handling**

- Multipart uploads for CV and audio files
- Real-time file processing with progress updates
- Secure file storage with signed URLs

### 🎵 **Audio Integration**

- ElevenLabs TTS for question narration
- ElevenLabs STT for answer transcription
- Real-time audio streaming with WebSockets

### 🧠 **AI Integration**

- Gemini AI for question generation
- Automated answer evaluation with scoring
- Skills normalization and matching

### 📊 **Real-time Features**

- WebSocket connections for live interviews
- Server-Sent Events for streaming evaluations
- Live transcription and feedback

This comprehensive workflow shows exactly how the frontend and backend will interact for both user types, providing a complete roadmap for building the ProofSkill platform! 🚀
