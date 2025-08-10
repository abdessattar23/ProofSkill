import { browser } from '$app/environment';
import { API_BASE_URL, ENDPOINTS } from '$lib/config';

interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

interface AuthResponse {
    success: boolean;
    token?: string;
    user?: {
        id: string;
        email: string;
        name?: string;
        role?: string;
    };
    id?: string;
}

class ApiClient {
    private baseUrl: string;

    constructor(baseUrl: string = API_BASE_URL) {
        this.baseUrl = baseUrl;
    }

    private async makeRequest<T = any>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<ApiResponse<T>> {
        const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;

        const defaultHeaders: Record<string, string> = {};

        // Only set Content-Type for non-FormData requests
        if (!(options.body instanceof FormData)) {
            defaultHeaders['Content-Type'] = 'application/json';
        }

        // Add Authorization header if token exists
        if (browser) {
            const token = localStorage.getItem('token');
            if (token) {
                defaultHeaders['Authorization'] = `Bearer ${token}`;
            }
        }

        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    ...defaultHeaders,
                    ...options.headers,
                },
            });

            const contentType = response.headers.get('content-type');
            let data: any;

            if (contentType?.includes('application/json')) {
                data = await response.json();
            } else {
                data = await response.text();
            }

            if (!response.ok) {
                return {
                    success: false,
                    error: data?.message || data?.error || `HTTP ${response.status}`,
                };
            }

            return {
                success: true,
                data,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Network error',
            };
        }
    }

    // Authentication Methods
    async register(userData: {
        email: string;
        password: string;
        name?: string;
        role?: string;
    }): Promise<AuthResponse> {
        const response = await this.makeRequest<AuthResponse>(ENDPOINTS.AUTH.REGISTER, {
            method: 'POST',
            body: JSON.stringify(userData),
        });

        return response.data || response;
    }

    async login(credentials: {
        email: string;
        password: string;
    }): Promise<AuthResponse> {
        const response = await this.makeRequest<AuthResponse>(ENDPOINTS.AUTH.LOGIN, {
            method: 'POST',
            body: JSON.stringify(credentials),
        });

        return response.data || response;
    }

    async getMe(): Promise<ApiResponse<{ user: any }>> {
        return this.makeRequest(ENDPOINTS.AUTH.ME);
    }

    // CV Processing
    async parseCV(file: File): Promise<ApiResponse<{
        name?: string;
        email?: string;
        phone?: string;
        education?: string[];
        skills?: string[];
        experience?: string[];
        certifications?: string[];
    }>> {
        const formData = new FormData();
        formData.append('file', file);

        return this.makeRequest('/v1/api/cv/parse', {
            method: 'POST',
            body: formData,
        });
    }

    // Job Management
    async createJob(jobData: {
        title: string;
        description: string;
        region?: string;
        skills: string[];
        company?: string;
        location?: string;
        salary_range?: string;
    }): Promise<ApiResponse<{ id: string }>> {
        return this.makeRequest('/v1/api/jobs', {
            method: 'POST',
            body: JSON.stringify(jobData),
        });
    }

    async getJobMatches(
        jobId: string,
        params: {
            page?: number;
            pageSize?: number;
            minSimilarity?: number;
        } = {}
    ): Promise<ApiResponse<{
        page: number;
        pageSize: number;
        total: number;
        data: Array<{
            candidate_id: string;
            similarity: number;
            name: string;
            email: string;
        }>;
    }>> {
        const queryParams = new URLSearchParams();
        if (params.page) queryParams.append('page', params.page.toString());
        if (params.pageSize) queryParams.append('pageSize', params.pageSize.toString());
        if (params.minSimilarity) queryParams.append('minSimilarity', params.minSimilarity.toString());

        const query = queryParams.toString();
        const endpoint = `/v1/api/jobs/${jobId}/match${query ? `?${query}` : ''}`;

        return this.makeRequest(endpoint);
    }

    // Candidate Management
    async importCandidate(candidateData: {
        name: string;
        email: string;
        phone?: string;
        skills: string[];
        experience?: string[];
        raw_cv_text?: string;
    }): Promise<ApiResponse<{
        id: string;
        classified_skills?: Array<{
            skill: string;
            category: string;
            confidence: number;
        }>;
    }>> {
        return this.makeRequest('/v1/api/candidates/import', {
            method: 'POST',
            body: JSON.stringify(candidateData),
        });
    }

    async getCandidate(candidateId: string): Promise<ApiResponse> {
        return this.makeRequest(`/v1/api/candidates/${candidateId}`);
    }

    async storeValidatedSkills(
        candidateId: string,
        skillsData: {
            skills: Array<{ skill: string; score: number }>;
            threshold?: number;
        }
    ): Promise<ApiResponse<{ saved: number }>> {
        return this.makeRequest(`/v1/api/candidates/${candidateId}/validated-skills`, {
            method: 'POST',
            body: JSON.stringify(skillsData),
        });
    }

    // Interview System
    async createInterviewSession(sessionData: {
        candidate_id: string;
        skills: string[];
    }): Promise<ApiResponse<{
        session_id: string;
        questions: Array<{
            skill: string;
            question: string;
        }>;
    }>> {
        return this.makeRequest('/v1/api/interview/session', {
            method: 'POST',
            body: JSON.stringify(sessionData),
        });
    }

    async createAdvancedInterviewSession(sessionData: {
        candidateId: string;
        jobId?: string;
        interviewType?: 'technical' | 'behavioral' | 'mixed';
        difficulty?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
        skillsToAssess: string[];
        estimatedDuration?: number;
    }): Promise<ApiResponse<{
        sessionId: string;
        status: string;
        metadata: any;
        createdAt: string;
    }>> {
        return this.makeRequest('/v1/api/interview/sessions', {
            method: 'POST',
            body: JSON.stringify(sessionData),
        });
    }

    async getInterviewSession(sessionId: string): Promise<ApiResponse<{
        sessionId: string;
        status: string;
        questions: Array<{
            skill: string;
            question: string;
        }>;
        metadata: any;
    }>> {
        return this.makeRequest(`/v1/api/interview/sessions/${sessionId}`);
    }

    async getSessionQuestions(sessionId: string): Promise<ApiResponse<{
        questions: Array<{
            id: string;
            skill: string;
            question: string;
            created_at: string;
        }>;
    }>> {
        return this.makeRequest(`/v1/api/interview/sessions/${sessionId}/questions`);
    }

    async evaluateInterview(data: {
        sessionId: string;
        answers: Array<{
            question: string;
            answer: string;
            skill: string;
        }>;
    }): Promise<ApiResponse<{
        evaluationId: string;
        overallScore: number;
        skillScores: Array<{
            skill: string;
            score: number;
            feedback: string;
        }>;
    }>> {
        return this.makeRequest('/v1/api/interview/evaluate', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async evaluateAnswer(evaluationData: {
        skill: string;
        question: string;
        answer: string;
    }): Promise<ApiResponse<{
        score: number;
        reasoning: string;
    }>> {
        return this.makeRequest('/v1/api/interview/evaluate', {
            method: 'POST',
            body: JSON.stringify(evaluationData),
        });
    }

    async advancedEvaluateAnswer(evaluationData: {
        skill: string;
        question: string;
        answer: string;
        candidateLevel?: string;
        jobRequirement?: string;
        contextualFactors?: string[];
    }): Promise<ApiResponse<{
        evaluation: {
            score: number;
            reasoning: string;
            strengths: string[];
            improvements: string[];
        };
        evaluatedAt: string;
    }>> {
        return this.makeRequest('/v1/api/interview/evaluations', {
            method: 'POST',
            body: JSON.stringify(evaluationData),
        });
    }

    // Audio Services
    async getVoices(): Promise<ApiResponse<{
        voices: Array<{
            voice_id: string;
            name: string;
            category: string;
        }>;
    }>> {
        return this.makeRequest('/v1/api/audio/voices');
    }

    async textToSpeech(ttsData: {
        text: string;
        voiceId?: string;
        store?: boolean;
    }): Promise<ApiResponse> {
        return this.makeRequest('/v1/api/audio/tts', {
            method: 'POST',
            body: JSON.stringify(ttsData),
        });
    }

    async speechToText(audioFile: File, store: boolean = false): Promise<ApiResponse<{
        transcript: string;
        audioFile?: any;
    }>> {
        const formData = new FormData();
        formData.append('file', audioFile);

        const endpoint = `/v1/api/audio/stt${store ? '?store=true' : ''}`;

        return this.makeRequest(endpoint, {
            method: 'POST',
            body: formData,
        });
    }

    // Streaming Sessions
    async createStreamingSession(sessionData: {
        candidate_id?: string;
        metadata?: any;
    }): Promise<ApiResponse<{
        session_id: string;
        status: string;
        created_at: string;
    }>> {
        return this.makeRequest('/v1/api/streaming/session', {
            method: 'POST',
            body: JSON.stringify(sessionData),
        });
    }

    async uploadToStreamingSession(sessionId: string, audioFile: File): Promise<ApiResponse> {
        const formData = new FormData();
        formData.append('file', audioFile);

        return this.makeRequest(`/v1/api/streaming/upload/${sessionId}`, {
            method: 'POST',
            body: formData,
        });
    }

    // Skills Management
    async normalizeSkill(skill: string): Promise<ApiResponse<{
        normalized: string;
        category: string;
        confidence: number;
        alternatives: string[];
    }>> {
        return this.makeRequest('/v1/skills/normalize', {
            method: 'POST',
            body: JSON.stringify({ skill }),
        });
    }

    async getSkillSuggestions(query: string, limit: number = 10): Promise<ApiResponse<{
        suggestions: string[];
    }>> {
        return this.makeRequest(`/v1/skills/suggestions?q=${encodeURIComponent(query)}&limit=${limit}`);
    }

    // Matching System
    async matchCandidateToJob(matchData: {
        candidateId: string;
        jobId: string;
        weights?: {
            skills?: number;
            location?: number;
            experience?: number;
            salary?: number;
        };
    }): Promise<ApiResponse> {
        return this.makeRequest('/v1/matching/candidate-job', {
            method: 'POST',
            body: JSON.stringify(matchData),
        });
    }

    async matchSkills(skillsData: {
        candidateSkills: string[];
        jobSkills: string[];
        threshold?: number;
    }): Promise<ApiResponse> {
        return this.makeRequest('/v1/matching/skills', {
            method: 'POST',
            body: JSON.stringify(skillsData),
        });
    }

    // Job Management
    async getJobs(params?: { page?: number; pageSize?: number }): Promise<ApiResponse> {
        const queryString = params ? `?${new URLSearchParams(params as any).toString()}` : '';
        return this.makeRequest(`/v1/api/jobs${queryString}`);
    }

    async getJob(jobId: string): Promise<ApiResponse> {
        return this.makeRequest(`/v1/api/jobs/${jobId}`);
    }

    async updateJob(jobId: string, jobData: any): Promise<ApiResponse> {
        return this.makeRequest(`/v1/api/jobs/${jobId}`, {
            method: 'PUT',
            body: JSON.stringify(jobData),
        });
    }

    async deleteJob(jobId: string): Promise<ApiResponse> {
        return this.makeRequest(`/v1/api/jobs/${jobId}`, {
            method: 'DELETE',
        });
    }

    async applyToJob(jobId: string): Promise<ApiResponse> {
        return this.makeRequest(`/v1/api/jobs/${jobId}/apply`, {
            method: 'POST',
        });
    }

    async getMyJobs(): Promise<ApiResponse> {
        return this.makeRequest('/v1/api/jobs/my-jobs');
    }

    async getJobCandidates(jobId: string): Promise<ApiResponse> {
        return this.makeRequest(`/v1/api/jobs/${jobId}/candidates`);
    }

    // Health & Monitoring
    async getHealth(): Promise<ApiResponse> {
        return this.makeRequest('/v1/health');
    }

    async getMetrics(): Promise<string> {
        const response = await this.makeRequest('/v1/metrics');
        return response.data || '';
    }

    // Queue Management (Admin)
    async getQueueStats(): Promise<ApiResponse> {
        return this.makeRequest('/v1/api/queue/stats');
    }

    async getDLQJobs(): Promise<ApiResponse> {
        return this.makeRequest('/v1/api/queue/dlq');
    }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export types for use in components
export type { ApiResponse, AuthResponse };
