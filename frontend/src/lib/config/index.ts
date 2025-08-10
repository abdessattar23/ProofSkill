// Environment configuration for ProofSkill
export const config = {
    // API Configuration
    API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000',

    // Frontend Configuration
    APP_NAME: 'ProofSkill AI',
    APP_VERSION: '1.0.0',

    // Development flags
    IS_DEVELOPMENT: import.meta.env.DEV,
    IS_PRODUCTION: import.meta.env.PROD,

    // Feature flags
    FEATURES: {
        STREAMING_INTERVIEWS: true,
        VOICE_ANALYSIS: true,
        ADVANCED_MATCHING: true,
    },

    // Validation rules
    VALIDATION: {
        MIN_PASSWORD_LENGTH: 8,
        MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
        ALLOWED_FILE_TYPES: [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain'
        ],
    },

    // API Endpoints based on documentation
    ENDPOINTS: {
        // Authentication
        AUTH: {
            REGISTER: '/v1/api/auth/register',
            LOGIN: '/v1/api/auth/login',
            ME: '/v1/api/auth/me',
        },

        // CV Processing
        CV: {
            PARSE: '/v1/api/cv/parse',
        },

        // Job Management
        JOBS: {
            CREATE: '/v1/api/jobs',
            MATCH: (id: string) => `/v1/api/jobs/${id}/match`,
        },

        // Candidate Management
        CANDIDATES: {
            IMPORT: '/v1/api/candidates/import',
            GET: (id: string) => `/v1/api/candidates/${id}`,
            VALIDATED_SKILLS: (id: string) => `/v1/api/candidates/${id}/validated-skills`,
        },

        // Interview System
        INTERVIEW: {
            SESSION: '/v1/api/interview/session',
            SESSIONS: '/v1/api/interview/sessions',
            EVALUATE: '/v1/api/interview/evaluate',
            EVALUATIONS: '/v1/api/interview/evaluations',
            STREAM_EVALUATE: '/v1/api/interview/evaluate/stream',
            SESSION_GET: (id: string) => `/v1/api/interview/sessions/${id}`,
        },

        // Audio Services
        AUDIO: {
            TTS: '/v1/api/audio/tts',
            STT: '/v1/api/audio/stt',
            VOICES: '/v1/api/audio/voices',
            FILES: '/v1/api/audio/files',
            CLEANUP: '/v1/api/audio/cleanup',
        },

        // Streaming Sessions
        STREAMING: {
            SESSION: '/v1/api/streaming/session',
            UPLOAD: (id: string) => `/v1/api/streaming/upload/${id}`,
            EVENTS: (id: string) => `/v1/api/streaming/events/${id}`,
            STT: (id: string) => `/v1/api/streaming/stt/${id}`,
            DOWNLOAD: (id: string) => `/v1/api/streaming/download/${id}`,
            COMPLETE: (id: string) => `/v1/api/streaming/session/${id}/complete`,
            DELETE: (id: string) => `/v1/api/streaming/session/${id}`,
            LIST: '/v1/api/streaming/sessions',
        },

        // Skills Management
        SKILLS: {
            NORMALIZE: '/v1/skills/normalize',
            SUGGESTIONS: '/v1/skills/suggestions',
            TAXONOMY_SEED: '/v1/taxonomy/seed',
        },

        // Matching System
        MATCHING: {
            CANDIDATE_JOB: '/v1/matching/candidate-job',
            SKILLS: '/v1/matching/skills',
            BATCH: '/v1/matching/batch',
        },

        // Monitoring & Health
        MONITORING: {
            HEALTH: '/v1/health',
            METRICS: '/v1/metrics',
            HEALTHZ: '/healthz',
        },

        // Queue Management
        QUEUE: {
            STATS: '/v1/api/queue/stats',
            DLQ: '/v1/api/queue/dlq',
            REPLAY: (id: string) => `/v1/api/queue/dlq/${id}/replay`,
        },
    },
} as const;

// Export individual configurations for convenience
export const API_BASE_URL = config.API_BASE_URL;
export const ENDPOINTS = config.ENDPOINTS;
export const VALIDATION = config.VALIDATION;
export const FEATURES = config.FEATURES;
