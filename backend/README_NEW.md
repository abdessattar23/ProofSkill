# ProofSkill Backend

AI-driven recruitment platform backend built with Fastify, TypeScript, and Gemini AI.

## 🚀 Features

### ✅ Implemented

- **CV Parsing**: PDF/DOCX parsing with Gemini AI extraction
- **AI Interviews**: Question generation and answer evaluation
- **Vector Matching**: Job-candidate matching using pgvector similarity
- **Audio Integration**: ElevenLabs TTS and Whisper STT
- **Queue System**: Redis-based async job processing with DLQ
- **Authentication**: API key + JWT with role-based access
- **Circuit Breakers**: Resilience for external AI services
- **OpenAPI Docs**: Auto-generated Swagger documentation
- **Real-time**: SSE streaming for evaluation progress
- **Caching**: Redis-based caching for performance
- **Testing**: Unit, integration, and load testing
- **Containerization**: Docker setup with multi-stage builds

### 🔄 Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Client    │    │   Fastify   │    │  Supabase   │
│             │◄──►│   Server    │◄──►│ PostgreSQL  │
│             │    │             │    │   +pgvector │
└─────────────┘    └─────────────┘    └─────────────┘
                          │
                   ┌─────────────┐    ┌─────────────┐
                   │    Redis    │    │  External   │
                   │  Queue/Cache│    │   AI APIs   │
                   │             │    │Gemini/11Labs│
                   └─────────────┘    └─────────────┘
```

## 🛠 Quick Start

### Prerequisites

- Node.js 18+
- Redis
- Supabase account
- Gemini API key

### Environment Setup

```bash
# Copy and configure environment
cp .env.example .env

# Required variables:
GEMINI_API_KEY=your_gemini_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key
API_KEY=your_api_key
```

### Installation & Development

```bash
# Install dependencies
npm install

# Run database migrations
psql -h your-host -d your-db < schema.sql

# Development server
npm run dev

# Build and start production
npm run build
npm start

# Run tests
npm test

# Load testing
npm run load-test
```

### Docker Deployment

```bash
# Single container
docker build -t proofskill-backend .
docker run -p 4000:4000 --env-file .env proofskill-backend

# Full stack with docker-compose
docker-compose up -d

# With nginx proxy
docker-compose --profile with-proxy up -d
```

## 📚 API Endpoints

### Core Features

- `POST /api/cv/parse` - Parse CV files (PDF/DOCX)
- `POST /api/candidates/import` - Import candidate profiles
- `POST /api/jobs` - Create job postings
- `GET /api/jobs/:id/match` - Find candidate matches

### AI Interview

- `POST /api/interview/session` - Start interview session
- `POST /api/interview/questions` - Generate questions
- `POST /api/interview/evaluate` - Evaluate answers (sync)
- `POST /api/interview/answer/async` - Queue evaluation (async)
- `POST /api/interview/answer/stream` - Stream evaluation (SSE)

### Audio Processing

- `POST /api/audio/tts` - Text-to-speech synthesis
- `POST /api/audio/stt` - Speech-to-text transcription
- `GET /api/audio/voices` - Available TTS voices

### Queue Management (Admin)

- `GET /api/queue/dlq` - Dead letter queue jobs
- `POST /api/queue/dlq/:id/replay` - Replay failed job
- `GET /api/queue/stats` - Queue statistics

### System

- `GET /healthz` - Health check
- `GET /docs` - Swagger UI
- `GET /openapi.json` - OpenAPI spec

## 🔧 Configuration

### Authentication

- **API Key**: Header `x-api-key` for service auth
- **JWT**: Optional user authentication with roles
- **Role Guards**: Route-level role requirements

### Rate Limiting

- 100 requests per minute per IP
- Configurable via environment

### Circuit Breakers

- **Gemini**: 5 failures, 60s timeout
- **ElevenLabs**: 3 failures, 30s timeout
- **Whisper**: 3 failures, 30s timeout

### Queue Configuration

- **Retry**: Max 3 attempts with exponential backoff
- **DLQ**: Failed jobs moved to dead letter queue
- **Timeouts**: Configurable per job type

## 🧪 Testing

### Test Suites

```bash
npm test                 # All tests
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests
npm run load-test        # Performance testing
```

### Test Coverage

- Circuit breaker resilience
- Queue retry mechanisms
- CV parsing validation
- API endpoint validation
- Embeddings consistency

## 📊 Monitoring & Observability

### Logging

- Structured JSON logging with pino
- Request correlation IDs
- Error tracking with stack traces

### Health Checks

- Database connectivity
- Redis availability
- External API status

### Load Testing

Built-in load testing with:

- Concurrent request simulation
- Latency percentiles (P95, P99)
- Throughput measurement
- Error rate tracking

## 🔐 Security

### Implemented

- Input validation with Zod schemas
- File type and size restrictions
- Rate limiting per IP/user
- Non-root Docker containers
- Environment variable validation

### Best Practices

- API keys in headers (not query params)
- JWT with expiration
- CORS configuration
- Security headers

## 🚧 Roadmap

### High Priority

- [ ] Metrics integration (Prometheus/OpenTelemetry)
- [ ] CI/CD pipeline setup
- [ ] Advanced matching algorithms
- [ ] Audio storage with signed URLs

### Future Enhancements

- [ ] Multi-language support
- [ ] Bias detection pipeline
- [ ] Real-time notifications
- [ ] Advanced analytics

## 📁 Project Structure

```
backend/
├── src/
│   ├── routes/          # API route handlers
│   ├── services/        # Business logic
│   ├── lib/            # Shared utilities
│   └── workers/        # Background job processors
├── tests/              # Test suites
├── scripts/            # Utility scripts
├── schema.sql          # Database schema
├── Dockerfile          # Container configuration
└── docker-compose.yml  # Multi-service setup
```

## 🤝 Contributing

1. Review the [copilot checklist](.github/copilot.md)
2. Check [open issues](.github/ISSUE_TEMPLATE/)
3. Follow the [PR template](.github/PULL_REQUEST_TEMPLATE.md)
4. Ensure tests pass: `npm test`
5. Update documentation as needed

## 📄 License

MIT License - see LICENSE file for details.

---

**ProofSkill** - Revolutionizing technical recruitment with AI-driven skill validation.
