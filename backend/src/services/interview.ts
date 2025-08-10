import { GoogleGenerativeAI } from '@google/generative-ai';
import { getSupabase } from '../lib/supabase';
import { CircuitBreaker } from '../lib/circuitBreaker';
import { v4 as uuidv4 } from 'uuid';
import { redis } from '../lib/redis';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const qaModel = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
    }
});

// Circuit breakers for external API calls
const geminiCircuitBreaker = new CircuitBreaker(
    async (prompt: string) => {
        const response = await qaModel.generateContent(prompt);
        return response.response.text();
    },
    {
        failureThreshold: 5,
        resetTimeout: 30000,
        monitoringPeriod: 60000
    }
);

// Simple logger for production
const logger = {
    info: (message: string, meta?: any) => {
        console.log(`[INFO] ${new Date().toISOString()} - ${message}`, meta ? JSON.stringify(meta) : '');
    },
    error: (message: string, meta?: any) => {
        console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, meta ? JSON.stringify(meta) : '');
    },
    warn: (message: string, meta?: any) => {
        console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, meta ? JSON.stringify(meta) : '');
    }
};

// Enhanced interfaces for production
export interface SkillQuestion {
    id?: string;
    skill: string;
    question: string;
    difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    category: string;
    expectedDuration: number; // seconds
    keywords: string[];
    createdAt?: Date;
}

export interface AnswerEvaluation {
    id?: string;
    skill: string;
    score: number;
    reasoning: string;
    strengths: string[];
    weaknesses: string[];
    suggestions: string[];
    confidence: number;
    technicalAccuracy: number;
    communicationClarity: number;
    problemSolvingApproach: number;
    createdAt?: Date;
}

export interface InterviewSession {
    id: string;
    candidateId: string;
    jobId?: string;
    status: 'created' | 'in_progress' | 'paused' | 'completed' | 'cancelled' | 'failed';
    currentQuestionIndex: number;
    totalQuestions: number;
    startedAt?: Date;
    completedAt?: Date;
    totalDuration?: number;
    averageScore?: number;
    metadata: {
        skillsAssessed: string[];
        questionsGenerated: number;
        answersEvaluated: number;
        interviewType: 'technical' | 'behavioral' | 'mixed';
        difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    };
}

export interface StreamingEvaluationChunk {
    progress: number;
    partialScore?: number;
    partialReasoning?: string;
    final?: AnswerEvaluation;
    error?: string;
    timestamp: Date;
}

// Production-ready question generation with caching and error handling
export async function generateQuestions(
    skills: string[],
    candidateContext: string = '',
    options: {
        difficulty?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
        questionCount?: number;
        interviewType?: 'technical' | 'behavioral' | 'mixed';
        jobContext?: string;
    } = {}
): Promise<SkillQuestion[]> {
    const {
        difficulty = 'intermediate',
        questionCount = 1,
        interviewType = 'technical',
        jobContext = ''
    } = options;

    // Check cache first
    const cacheKey = `questions:${Buffer.from(JSON.stringify({ skills, candidateContext, options })).toString('base64')}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
        logger.info('Using cached questions', { skills, difficulty });
        return JSON.parse(cached);
    }

    try {
        const prompt = buildQuestionPrompt(skills, candidateContext, difficulty, questionCount, interviewType, jobContext);

        const result = await geminiCircuitBreaker.execute(prompt);

        const questions = parseQuestionsResponse(result as string, skills, difficulty);

        // Cache for 1 hour
        await redis.setex(cacheKey, 3600, JSON.stringify(questions));

        logger.info('Generated questions successfully', {
            skillCount: skills.length,
            questionCount: questions.length,
            difficulty
        });

        return questions;
    } catch (error) {
        logger.error('Error generating questions', { error, skills, difficulty });
        // Return fallback questions
        return generateFallbackQuestions(skills, difficulty);
    }
}

// Enhanced answer evaluation with detailed analysis
export async function evaluateAnswer(
    skill: string,
    question: string,
    answer: string,
    options: {
        candidateLevel?: string;
        jobRequirement?: string;
        contextualFactors?: string[];
    } = {}
): Promise<AnswerEvaluation> {
    if (!answer?.trim()) {
        return {
            skill,
            score: 0,
            reasoning: 'No answer provided',
            strengths: [],
            weaknesses: ['No response given'],
            suggestions: ['Please provide an answer to demonstrate your knowledge'],
            confidence: 1.0,
            technicalAccuracy: 0,
            communicationClarity: 0,
            problemSolvingApproach: 0,
            createdAt: new Date()
        };
    }

    try {
        const prompt = buildEvaluationPrompt(skill, question, answer, options);

        const result = await geminiCircuitBreaker.execute(prompt);

        const evaluation = parseEvaluationResponse(result as string, skill);

        logger.info('Evaluated answer successfully', {
            skill,
            score: evaluation.score,
            answerLength: answer.length
        });

        return evaluation;
    } catch (error) {
        logger.error('Error evaluating answer', { error, skill, answerLength: answer.length });
        return {
            skill,
            score: 0,
            reasoning: 'Evaluation service temporarily unavailable',
            strengths: [],
            weaknesses: ['Unable to evaluate response'],
            suggestions: ['Please try again later'],
            confidence: 0,
            technicalAccuracy: 0,
            communicationClarity: 0,
            problemSolvingApproach: 0,
            createdAt: new Date()
        };
    }
}

// Production streaming evaluation with real incremental analysis
export async function* streamEvaluateAnswer(
    skill: string,
    question: string,
    answer: string,
    options: {
        candidateLevel?: string;
        jobRequirement?: string;
    } = {}
): AsyncGenerator<StreamingEvaluationChunk> {
    const startTime = Date.now();

    try {
        // Initial analysis - quick sentiment and structure check
        yield {
            progress: 0.1,
            partialScore: 1,
            partialReasoning: 'Starting analysis...',
            timestamp: new Date()
        };

        // Analyze answer structure and completeness
        const words = answer.trim().split(/\s+/);
        const sentences = answer.split(/[.!?]+/).filter(s => s.trim().length > 0);

        yield {
            progress: 0.2,
            partialScore: Math.min(10, Math.max(1, Math.floor(words.length / 10))),
            partialReasoning: `Answer contains ${words.length} words in ${sentences.length} sentences`,
            timestamp: new Date()
        };

        // Progressive analysis in chunks
        const chunks = chunkAnswer(answer, 3);
        for (let i = 0; i < chunks.length; i++) {
            const progress = 0.2 + (0.6 * (i + 1) / chunks.length);
            const partialAnswer = chunks.slice(0, i + 1).join(' ');

            // Quick partial evaluation
            const partialScore = await evaluatePartialAnswer(skill, question, partialAnswer);

            yield {
                progress,
                partialScore: partialScore.score,
                partialReasoning: partialScore.reasoning,
                timestamp: new Date()
            };

            // Add small delay to simulate real processing
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        // Final comprehensive evaluation
        yield {
            progress: 0.9,
            partialReasoning: 'Performing final analysis...',
            timestamp: new Date()
        };

        const finalEvaluation = await evaluateAnswer(skill, question, answer, options);

        yield {
            progress: 1.0,
            final: finalEvaluation,
            timestamp: new Date()
        };

        logger.info('Streaming evaluation completed', {
            skill,
            score: finalEvaluation.score,
            duration: Date.now() - startTime
        });

    } catch (error) {
        logger.error('Error in streaming evaluation', { error, skill });
        yield {
            progress: 1.0,
            error: 'Evaluation failed',
            timestamp: new Date()
        };
    }
}

export async function createSession(candidateId: string): Promise<string> {
    try {
        const supabaseAdmin = getSupabase();
        const { data, error } = await supabaseAdmin
            .from('interview_sessions')
            .insert({ candidate_id: candidateId })
            .select('id');

        if (error) {
            console.error('Error creating interview session:', error);
            throw new Error(`Failed to create interview session: ${error.message}`);
        }

        if (!data || data.length === 0) {
            throw new Error('No session data returned from database');
        }

        return data[0].id;
    } catch (error) {
        console.error('Interview session creation failed:', error);
        throw error;
    }
}

export async function storeQuestions(sessionId: string, qs: SkillQuestion[]) {
    if (!qs.length) return;
    const supabaseAdmin = getSupabase();
    await supabaseAdmin.from('interview_questions').insert(qs.map(q => ({ session_id: sessionId, skill: q.skill, question: q.question })));
}

export async function storeAnswer(questionId: string, transcript: string, evalResult: AnswerEvaluation) {
    const supabaseAdmin = getSupabase();
    await supabaseAdmin.from('interview_answers').insert({ question_id: questionId, transcript, score: evalResult.score, reasoning: evalResult.reasoning });
}

// Enhanced production session management
export async function createSessionAdvanced(
    candidateId: string,
    options: {
        jobId?: string;
        interviewType?: 'technical' | 'behavioral' | 'mixed';
        difficulty?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
        skillsToAssess?: string[];
        estimatedDuration?: number;
        voiceId?: string;
    } = {}
): Promise<InterviewSession> {
    const supabaseAdmin = getSupabase();

    const sessionData: any = {
        id: uuidv4(),
        candidate_id: candidateId,
        job_id: options.jobId,
        status: 'created',
        current_question_index: 0,
        total_questions: options.skillsToAssess?.length || 0,
        metadata: {
            skillsAssessed: options.skillsToAssess || [],
            questionsGenerated: 0,
            answersEvaluated: 0,
            interviewType: options.interviewType || 'technical',
            difficulty: options.difficulty || 'intermediate'
        },
        created_at: new Date(),
        estimated_duration: options.estimatedDuration || 1800 // 30 minutes default
    };

    if (options.voiceId) {
        sessionData.voice_id = options.voiceId;
    }

    const { data, error } = await supabaseAdmin
        .from('interview_sessions')
        .insert(sessionData)
        .select()
        .single();

    if (error) {
        logger.error('Failed to create interview session', { error, candidateId });
        throw new Error(`Failed to create session: ${error.message}`);
    }

    logger.info('Created interview session', { sessionId: data.id, candidateId, options });

    return {
        id: data.id,
        candidateId: data.candidate_id,
        jobId: data.job_id,
        status: data.status,
        currentQuestionIndex: data.current_question_index,
        totalQuestions: data.total_questions,
        startedAt: data.started_at ? new Date(data.started_at) : undefined,
        completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
        totalDuration: data.total_duration,
        averageScore: data.average_score,
        metadata: data.metadata
    };
}

export async function updateSessionStatus(
    sessionId: string,
    status: InterviewSession['status'],
    updates?: Partial<InterviewSession>
): Promise<void> {
    const supabaseAdmin = getSupabase();

    const updateData: any = {
        status,
        updated_at: new Date()
    };

    if (status === 'in_progress' && !updates?.startedAt) {
        updateData.started_at = new Date();
    }

    if (status === 'completed' && !updates?.completedAt) {
        updateData.completed_at = new Date();
    }

    if (updates) {
        if (updates.currentQuestionIndex !== undefined) {
            updateData.current_question_index = updates.currentQuestionIndex;
        }
        if (updates.totalDuration !== undefined) {
            updateData.total_duration = updates.totalDuration;
        }
        if (updates.averageScore !== undefined) {
            updateData.average_score = updates.averageScore;
        }
    }

    const { error } = await supabaseAdmin
        .from('interview_sessions')
        .update(updateData)
        .eq('id', sessionId);

    if (error) {
        logger.error('Failed to update session status', { error, sessionId, status });
        throw new Error(`Failed to update session: ${error.message}`);
    }

    logger.info('Updated session status', { sessionId, status, updates });
}

export async function getSessionById(sessionId: string): Promise<InterviewSession | null> {
    const supabaseAdmin = getSupabase();

    const { data, error } = await supabaseAdmin
        .from('interview_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

    if (error) {
        logger.error('Failed to get session', { error, sessionId });
        return null;
    }

    return {
        id: data.id,
        candidateId: data.candidate_id,
        jobId: data.job_id,
        status: data.status,
        currentQuestionIndex: data.current_question_index,
        totalQuestions: data.total_questions,
        startedAt: data.started_at ? new Date(data.started_at) : undefined,
        completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
        totalDuration: data.total_duration,
        averageScore: data.average_score,
        metadata: data.metadata
    };
}

export async function calculateSessionScore(sessionId: string): Promise<number> {
    const supabaseAdmin = getSupabase();

    // First get question IDs for the session
    const { data: questions, error: questionsError } = await supabaseAdmin
        .from('interview_questions')
        .select('id')
        .eq('session_id', sessionId);

    if (questionsError || !questions?.length) {
        return 0;
    }

    const questionIds = questions.map(q => q.id);

    // Then get answers for those questions
    const { data: answers, error: answersError } = await supabaseAdmin
        .from('interview_answers')
        .select('score')
        .in('question_id', questionIds);

    if (answersError || !answers?.length) {
        return 0;
    }

    const totalScore = answers.reduce((sum, answer) => sum + (answer.score || 0), 0);
    return Math.round((totalScore / answers.length) * 100) / 100;
}

// Helper functions for production functionality

function buildQuestionPrompt(
    skills: string[],
    candidateContext: string,
    difficulty: string,
    questionCount: number,
    interviewType: string,
    jobContext: string
): string {
    return `You are an expert technical interviewer. Generate ${questionCount} high-quality interview question(s) for each skill.

Context:
- Skills to assess: ${skills.join(', ')}
- Difficulty level: ${difficulty}
- Interview type: ${interviewType}
- Candidate background: ${candidateContext}
- Job context: ${jobContext}

Requirements:
- Questions must be practical and realistic
- Focus on real-world application of skills
- Include scenario-based questions for advanced levels
- Ensure questions can be answered in 2-5 minutes
- Avoid theoretical-only questions

Output format: JSON array of objects with this exact structure:
[
  {
    "skill": "skill name",
    "question": "detailed question text",
    "difficulty": "${difficulty}",
    "category": "technical category",
    "expectedDuration": 180,
    "keywords": ["keyword1", "keyword2"]
  }
]

Generate only valid JSON, no explanations or markdown.`;
}

function buildEvaluationPrompt(
    skill: string,
    question: string,
    answer: string,
    options: any
): string {
    return `You are an expert technical evaluator. Analyze this interview answer comprehensively.

SKILL: ${skill}
QUESTION: ${question}
ANSWER: ${answer}

Context:
- Candidate level: ${options.candidateLevel || 'Unknown'}
- Job requirement: ${options.jobRequirement || 'General'}

Evaluation criteria:
1. Technical accuracy (0-10)
2. Problem-solving approach (0-10)
3. Communication clarity (0-10)
4. Practical understanding (0-10)

Provide detailed analysis with specific examples from the answer.

Output format: JSON object with this exact structure:
{
  "score": 7.5,
  "reasoning": "detailed explanation of score",
  "strengths": ["specific strength 1", "specific strength 2"],
  "weaknesses": ["specific weakness 1", "specific weakness 2"],
  "suggestions": ["improvement suggestion 1", "improvement suggestion 2"],
  "confidence": 0.85,
  "technicalAccuracy": 8,
  "communicationClarity": 7,
  "problemSolvingApproach": 8
}

Generate only valid JSON, no explanations or markdown.`;
}

function parseQuestionsResponse(
    response: string,
    skills: string[],
    difficulty: string
): SkillQuestion[] {
    try {
        // Find JSON array in response
        const jsonStart = response.indexOf('[');
        const jsonEnd = response.lastIndexOf(']') + 1;

        if (jsonStart === -1 || jsonEnd === 0) {
            throw new Error('No JSON array found in response');
        }

        const jsonStr = response.slice(jsonStart, jsonEnd);
        const parsed = JSON.parse(jsonStr);

        if (!Array.isArray(parsed)) {
            throw new Error('Response is not an array');
        }

        return parsed.map((item: any, index: number) => ({
            id: uuidv4(),
            skill: item.skill || skills[index] || `skill_${index}`,
            question: item.question || 'No question generated',
            difficulty: (item.difficulty || difficulty) as any,
            category: item.category || 'general',
            expectedDuration: item.expectedDuration || 180,
            keywords: Array.isArray(item.keywords) ? item.keywords : [],
            createdAt: new Date()
        }));
    } catch (error) {
        logger.error('Failed to parse questions response', { error, response: response.slice(0, 200) });
        return generateFallbackQuestions(skills, difficulty);
    }
}

function parseEvaluationResponse(response: string, skill: string): AnswerEvaluation {
    try {
        // Find JSON object in response
        const jsonStart = response.indexOf('{');
        const jsonEnd = response.lastIndexOf('}') + 1;

        if (jsonStart === -1 || jsonEnd === 0) {
            throw new Error('No JSON object found in response');
        }

        const jsonStr = response.slice(jsonStart, jsonEnd);
        const parsed = JSON.parse(jsonStr);

        return {
            id: uuidv4(),
            skill,
            score: Math.max(0, Math.min(10, parsed.score || 0)),
            reasoning: parsed.reasoning || 'No reasoning provided',
            strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
            weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
            suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
            confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
            technicalAccuracy: Math.max(0, Math.min(10, parsed.technicalAccuracy || 0)),
            communicationClarity: Math.max(0, Math.min(10, parsed.communicationClarity || 0)),
            problemSolvingApproach: Math.max(0, Math.min(10, parsed.problemSolvingApproach || 0)),
            createdAt: new Date()
        };
    } catch (error) {
        logger.error('Failed to parse evaluation response', { error, response: response.slice(0, 200) });
        return {
            id: uuidv4(),
            skill,
            score: 0,
            reasoning: 'Evaluation parsing failed',
            strengths: [],
            weaknesses: ['Unable to parse evaluation'],
            suggestions: ['Please try again'],
            confidence: 0,
            technicalAccuracy: 0,
            communicationClarity: 0,
            problemSolvingApproach: 0,
            createdAt: new Date()
        };
    }
}

function generateFallbackQuestions(
    skills: string[],
    difficulty: string
): SkillQuestion[] {
    const fallbackTemplates = {
        beginner: (skill: string) => `Explain the basic concepts of ${skill} and provide a simple example.`,
        intermediate: (skill: string) => `Describe a practical scenario where you would use ${skill} and how you would implement it.`,
        advanced: (skill: string) => `Design a solution using ${skill} for a complex problem and explain your architectural decisions.`,
        expert: (skill: string) => `Compare different approaches to implementing ${skill} in enterprise systems and justify your preferred approach.`
    };

    const template = fallbackTemplates[difficulty as keyof typeof fallbackTemplates] || fallbackTemplates.intermediate;

    return skills.map(skill => ({
        id: uuidv4(),
        skill,
        question: template(skill),
        difficulty: difficulty as any,
        category: 'general',
        expectedDuration: 180,
        keywords: [skill.toLowerCase()],
        createdAt: new Date()
    }));
}

function chunkAnswer(answer: string, chunkCount: number): string[] {
    const words = answer.trim().split(/\s+/);
    const chunkSize = Math.ceil(words.length / chunkCount);
    const chunks: string[] = [];

    for (let i = 0; i < words.length; i += chunkSize) {
        chunks.push(words.slice(i, i + chunkSize).join(' '));
    }

    return chunks;
}

async function evaluatePartialAnswer(
    skill: string,
    question: string,
    partialAnswer: string
): Promise<{ score: number; reasoning: string }> {
    // Quick evaluation for partial answers
    const words = partialAnswer.trim().split(/\s+/);
    const keywordCount = countTechnicalKeywords(partialAnswer, skill);

    // Basic scoring based on length and keyword presence
    let score = Math.min(10, Math.max(1, words.length / 10));
    score += Math.min(3, keywordCount);
    score = Math.min(10, score);

    const reasoning = `Partial analysis: ${words.length} words, ${keywordCount} technical keywords detected`;

    return { score: Math.round(score * 10) / 10, reasoning };
}

function countTechnicalKeywords(text: string, skill: string): number {
    const lowerText = text.toLowerCase();
    const lowerSkill = skill.toLowerCase();

    // Common technical keywords by skill category
    const keywordMap: Record<string, string[]> = {
        javascript: ['function', 'variable', 'object', 'array', 'promise', 'async', 'callback'],
        python: ['function', 'class', 'list', 'dictionary', 'import', 'lambda', 'decorator'],
        react: ['component', 'state', 'props', 'hook', 'jsx', 'render', 'lifecycle'],
        node: ['server', 'express', 'middleware', 'route', 'callback', 'stream', 'buffer'],
        sql: ['select', 'join', 'where', 'table', 'index', 'query', 'database'],
        // Add more as needed
    };

    const skillKeywords = keywordMap[lowerSkill] || [];
    const generalKeywords = ['implement', 'design', 'architecture', 'performance', 'solution', 'approach'];
    const allKeywords = [...skillKeywords, ...generalKeywords];

    return allKeywords.filter(keyword => lowerText.includes(keyword)).length;
}
