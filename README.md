# ProofSkill AI

**AI-Powered Interview Platform for Technical Hiring**

ProofSkill AI is a production-ready platform that revolutionizes technical hiring through voice-based AI interviews and intelligent candidate-job matching.

## ✨ Features

### 🎤 Voice Interview System

- **Real-time voice interviews** with ElevenLabs speech-to-text
- **Automatic progression** - stop recording triggers transcription and evaluation
- **AI-generated questions** tailored to candidate skills and job requirements
- **Professional floating orb UI** with status indicators

### 👤 Complete Candidate Workflow

- **CV upload & AI parsing** - extract skills and experience automatically
- **Mandatory profile completion** for first-time users
- **Skills-based interview generation** from parsed CV data
- **Detailed interview summaries** with scoring and feedback

### 🏢 Business Management

- **Job posting & management** with comprehensive forms
- **Candidate review system** with application tracking
- **Real-time analytics** for job performance and applications
- **Professional business dashboard**

### 🎯 Intelligent Matching

- **Semantic skill matching** between candidates and jobs
- **Advanced scoring algorithms** using Google Gemini AI
- **Location and experience filtering**
- **Customizable matching weights**

## 🚀 Tech Stack

### Backend

- **Fastify** - High-performance Node.js framework
- **TypeScript** - Type-safe development
- **Supabase** - PostgreSQL database with real-time features
- **Google Gemini** - AI evaluation and question generation
- **ElevenLabs** - Speech-to-text transcription
- **Redis** - Caching and session management
- **JWT** - Secure authentication

### Frontend

- **SvelteKit** - Modern full-stack framework
- **TypeScript** - End-to-end type safety
- **Tailwind CSS** - Professional dark theme design
- **Vite** - Fast development and building

## 📋 Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (or Supabase account)
- Redis instance
- API keys for Google Gemini and ElevenLabs

### Environment Setup

1. **Backend Configuration** (`backend/.env`):

```bash
# Database
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key

# AI Services
GEMINI_API_KEY=your_gemini_key
ELEVENLABS_API_KEY=your_elevenlabs_key

# Authentication
JWT_SECRET=your_jwt_secret_32_chars_min

# Optional
PORT=4000
REDIS_URL=redis://localhost:6379
```

2. **Install Dependencies**:

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

3. **Database Setup**:

```bash
cd backend
npm run db:migrate
```

4. **Start Development Servers**:

```bash
# Backend (Terminal 1)
cd backend
npm run dev

# Frontend (Terminal 2)
cd frontend
npm run dev
```

5. **Access the Platform**:

- Frontend: http://localhost:5173
- Backend API: http://localhost:4000

## 🔄 User Workflows

### Candidate Journey

1. **Register** as candidate
2. **Upload CV** (mandatory for first-time users)
3. **AI parses** skills and experience
4. **Voice interview** with automatic progression
5. **View results** and browse jobs
6. **Apply** to relevant positions

### Business Journey

1. **Register** as business
2. **Post jobs** with detailed requirements
3. **Review applications** and candidate profiles
4. **Manage job listings** with analytics
5. **Match candidates** to open positions

## 📝 API Documentation

Key endpoints:

- `POST /v1/api/auth/login` - User authentication
- `POST /v1/api/cv/upload` - CV upload and parsing
- `POST /v1/api/interview/sessions` - Create interview session
- `GET /v1/api/interview/sessions/:id/summary` - Interview results
- `POST /v1/api/jobs` - Create job posting
- `GET /v1/api/jobs` - List all jobs

## 🔒 Security Features

- **JWT authentication** with role-based access
- **Rate limiting** to prevent abuse
- **Input validation** with Zod schemas
- **SQL injection protection** via Supabase
- **CORS configuration** for secure cross-origin requests

## 🏗️ Architecture

- **Microservices approach** with separated concerns
- **Circuit breaker pattern** for external API resilience
- **Redis caching** for performance optimization
- **Modular routing** with TypeScript interfaces
- **Professional error handling** throughout

## 📊 Production Ready

- **No hardcoded values** - all configuration via environment
- **Comprehensive error handling** with proper HTTP status codes
- **Professional logging** with structured output
- **Health checks** and monitoring endpoints
- **Database migrations** for schema management

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Follow TypeScript and ESLint standards
4. Add proper error handling
5. Test thoroughly before submitting

## 📄 License

This project is licensed under the MIT License.
