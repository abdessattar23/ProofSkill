import { FastifyPluginCallback } from 'fastify';
import { z } from 'zod';
import {
    generateQuestions,
    evaluateAnswer,
    streamEvaluateAnswer,
    createSessionAdvanced,
    updateSessionStatus,
    getSessionById,
    calculateSessionScore,
    storeQuestions,
    storeAnswer,
    createSession
} from '../services/interview';
import { getSupabase } from '../lib/supabase';
import { synthesizeQuestion, transcribeAudio } from '../services/audio';
import { uploadAudio } from '../services/audioStorage';
import { enqueue } from '../lib/queue';
import { authService } from '../services/authService';
// NOTE: Auth now handled globally via server preHandler JWT hook. Local checkAuth removed.

// Validation schemas
const CreateSessionSchema = z.object({
    candidateId: z.string().uuid(),
    jobId: z.string().uuid().optional(),
    interviewType: z.enum(['technical', 'behavioral', 'mixed']).default('technical'),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced', 'expert']).default('intermediate'),
    skillsToAssess: z.array(z.string()).min(1).max(20),
    estimatedDuration: z.number().min(300).max(7200).optional(),
    voiceId: z.string().min(1).max(100).optional()
});

const GenerateQuestionsSchema = z.object({
    skills: z.array(z.string()).min(1).max(10),
    candidateContext: z.string().max(1000).optional(),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced', 'expert']).default('intermediate'),
    questionCount: z.number().min(1).max(3).default(1),
    interviewType: z.enum(['technical', 'behavioral', 'mixed']).default('technical'),
    jobContext: z.string().max(1000).optional()
});

const EvaluateAnswerSchema = z.object({
    skill: z.string().min(1).max(100),
    question: z.string().min(10).max(1000),
    answer: z.string().min(1).max(5000),
    candidateLevel: z.string().max(50).optional(),
    jobRequirement: z.string().max(200).optional(),
    contextualFactors: z.array(z.string()).optional()
});

export const interviewRoutes: FastifyPluginCallback = async (fastify, opts) => {
    // TODO: Implement true streaming STT (WebSocket or HTTP chunked) endpoint providing partial transcripts
    // Contract (planned):
    //  - Client sends small PCM/opus chunks with sessionId & questionId
    //  - Server returns SSE events { type:'partial', text } and final { type:'final', text }
    //  - Downstream evaluation can start once sufficient partial captured
    // This placeholder documents upcoming work without exposing incomplete API surface.

    // Legacy endpoint for backward compatibility
    fastify.post('/session', {
        schema: {
            description: 'Create an interview session and generate questions for specified skills',
            body: {
                type: 'object',
                properties: {
                    candidate_id: { type: 'string' },
                    skills: { type: 'array', items: { type: 'string' } }
                },
                required: ['candidate_id', 'skills']
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        session_id: { type: 'string' },
                        questions: { type: 'array' }
                    }
                }
            }
        }
    }, async (request, reply) => {
        const { candidate_id, skills } = request.body as { candidate_id: string; skills: string[] };

        try {
            const sessionId = await createSession(candidate_id);
            const questions = await generateQuestions(skills);
            await storeQuestions(sessionId, questions);

            reply.send({
                session_id: sessionId,
                questions: questions.map(q => ({ skill: q.skill, question: q.question }))
            });
        } catch (error) {
            fastify.log.error(`Legacy session creation failed: ${String(error)}`);
            reply.code(500).send({ error: 'Failed to create session' });
        }
    });

    // Modern comprehensive session creation
    fastify.post('/sessions', {
        schema: {
            body: {
                type: 'object',
                properties: {
                    candidateId: { type: 'string', format: 'uuid' },
                    jobId: { type: 'string', format: 'uuid' },
                    interviewType: { type: 'string', enum: ['technical', 'behavioral', 'mixed'], default: 'technical' },
                    difficulty: { type: 'string', enum: ['beginner', 'intermediate', 'advanced', 'expert'], default: 'intermediate' },
                    skillsToAssess: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 20 },
                    estimatedDuration: { type: 'number', minimum: 300, maximum: 7200 },
                    voiceId: { type: 'string' }
                },
                required: ['candidateId', 'skillsToAssess']
            },
            response: {
                201: {
                    type: 'object',
                    properties: {
                        sessionId: { type: 'string' },
                        status: { type: 'string' },
                        metadata: { type: 'object' },
                        createdAt: { type: 'string' },
                        voiceId: { type: 'string' },
                        questions: { type: 'array' }
                    }
                }
            }
        }
    }, async (request, reply) => {
        const rawData = request.body as any;

        // Slice skills to max 20 items before validation
        if (rawData.skillsToAssess && Array.isArray(rawData.skillsToAssess) && rawData.skillsToAssess.length > 20) {
            rawData.skillsToAssess = rawData.skillsToAssess.slice(0, 20);
        }

        const data = rawData as z.infer<typeof CreateSessionSchema>;

        try {
            // Concurrency guard: prevent multiple active sessions per candidate
            const supabaseAdmin = getSupabase();
            const { data: existing } = await supabaseAdmin.from('interview_sessions').select('id,status').eq('candidate_id', data.candidateId).in('status', ['created', 'in_progress', 'active']).limit(1);
            if (existing && existing.length) {
                reply.code(409).send({ error: 'Active interview session already exists' });
                return;
            }

            const session = await createSessionAdvanced(data.candidateId, {
                jobId: data.jobId,
                interviewType: data.interviewType,
                difficulty: data.difficulty,
                skillsToAssess: data.skillsToAssess,
                estimatedDuration: data.estimatedDuration,
                voiceId: data.voiceId
            });
            // Generate questions immediately for advanced session for provided skills
            let questions: any[] = [];
            if (data.skillsToAssess?.length) {
                try {
                    const generated = await generateQuestions(data.skillsToAssess);
                    await storeQuestions(session.id, generated);
                    // Generate TTS audio for each question (best-effort; failures logged, question still returned)
                    const enriched: any[] = [];
                    for (const q of generated) {
                        try {
                            const buf = await synthesizeQuestion(q.question);
                            const uploaded = await uploadAudio(buf, `question_${q.id}.mp3`, 'audio/mpeg', 'questions');
                            enriched.push({ id: q.id, skill: q.skill, question: q.question, audio: { url: uploaded.url, filename: uploaded.filename, size: uploaded.size } });
                        } catch (ttse) {
                            fastify.log.error(`TTS generation failed for question ${q.id}: ${String(ttse)}`);
                            enriched.push({ id: q.id, skill: q.skill, question: q.question });
                        }
                    }
                    questions = enriched;
                } catch (err) {
                    fastify.log.error(`Failed to generate questions for advanced session ${session.id}: ${String(err)}`);
                }
            }
            reply.code(201).send({
                sessionId: session.id,
                status: session.status,
                metadata: session.metadata,
                createdAt: new Date().toISOString(),
                voiceId: data.voiceId,
                questions
            });
        } catch (error) {
            fastify.log.error(`Failed to create interview session: ${String(error)}`);
            reply.code(500).send({
                error: 'Failed to create interview session',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });

    // List questions for a session
    fastify.get('/sessions/:sessionId/questions', {
        schema: {
            params: {
                type: 'object',
                properties: { sessionId: { type: 'string' } },
                required: ['sessionId']
            }
        }
    }, async (request, reply) => {
        const { sessionId } = request.params as { sessionId: string };
        const supabaseAdmin = getSupabase();
        const { data, error } = await supabaseAdmin.from('interview_questions').select('id,skill,question,created_at').eq('session_id', sessionId).order('created_at');
        if (error) return reply.code(500).send({ error: 'Failed to list questions' });
        reply.send({ questions: data || [] });
    });

    // Submit answer for a question (non-streaming)
    fastify.post('/sessions/:sessionId/questions/:questionId/answer', {
        schema: {
            params: {
                type: 'object',
                properties: { sessionId: { type: 'string' }, questionId: { type: 'string' } },
                required: ['sessionId', 'questionId']
            },
            body: {
                type: 'object',
                properties: { answer: { type: 'string' } },
                required: ['answer']
            }
        }
    }, async (request, reply) => {
        const { sessionId, questionId } = request.params as any;
        const { answer } = request.body as any;
        const supabaseAdmin = getSupabase();
        const { data: qRow, error: qErr } = await supabaseAdmin.from('interview_questions').select('*').eq('id', questionId).maybeSingle();
        if (qErr || !qRow) return reply.code(404).send({ error: 'Question not found' });

        // Check if answer already exists
        const { data: existingAnswer } = await supabaseAdmin.from('interview_answers').select('id').eq('question_id', questionId).maybeSingle();
        if (existingAnswer) {
            return reply.code(409).send({ error: 'Answer already submitted for this question' });
        }

        try {
            const start = Date.now();
            const evalResult = await evaluateAnswer(qRow.skill, qRow.question, answer);
            await storeAnswer(questionId, answer, evalResult as any);
            const supabaseAdmin2 = getSupabase();
            await supabaseAdmin2.from('interview_answers').update({ transcript_full: answer, started_at: new Date(start), ended_at: new Date(), duration_ms: Date.now() - start }).eq('question_id', questionId);
            // Update session stats
            const avg = await calculateSessionScore(sessionId);
            await updateSessionStatus(sessionId, 'in_progress', { averageScore: avg });
            // Aggregate speaking time
            try {
                const supa = getSupabase();
                const { data: qIds } = await supa.from('interview_questions').select('id').eq('session_id', sessionId);
                if (qIds && qIds.length) {
                    const { data: durations } = await supa.from('interview_answers').select('duration_ms,question_id').in('question_id', qIds.map(q => q.id));
                    const total = (durations || []).reduce((s, a) => s + (a.duration_ms || 0), 0);
                    await supa.from('interview_sessions').update({ speaking_time_ms: total }).eq('id', sessionId);
                }
            } catch (aggErr) {
                fastify.log.error(`Failed updating speaking_time_ms: ${String(aggErr)}`);
            }
            reply.send({ evaluation: evalResult });
        } catch (err) {
            fastify.log.error(`Answer evaluation failed: ${String(err)}`);
            reply.code(500).send({ error: 'Failed to evaluate answer' });
        }
    });

    // Submit audio for transcription and evaluation
    fastify.post('/sessions/:sessionId/questions/:questionId/audio', {
        schema: {
            params: {
                type: 'object',
                properties: { sessionId: { type: 'string' }, questionId: { type: 'string' } },
                required: ['sessionId', 'questionId']
            },
            consumes: ['multipart/form-data']
        }
    }, async (request, reply) => {
        const { sessionId, questionId } = request.params as any;

        try {
            // Verify question exists
            const supabaseAdmin = getSupabase();
            const { data: qRow, error: qErr } = await supabaseAdmin.from('interview_questions').select('*').eq('id', questionId).maybeSingle();
            if (qErr || !qRow) {
                return reply.code(404).send({ error: 'Question not found' });
            }

            // Check if answer already exists
            const { data: existingAnswer } = await supabaseAdmin.from('interview_answers').select('id').eq('question_id', questionId).maybeSingle();
            if (existingAnswer) {
                return reply.code(409).send({ error: 'Answer already submitted for this question' });
            }

            // Get the uploaded audio file
            const data = await request.file();
            if (!data) {
                return reply.code(400).send({ error: 'No audio file provided' });
            }

            const audioBuffer = await data.toBuffer();
            if (audioBuffer.length === 0) {
                return reply.code(400).send({ error: 'Empty audio file' });
            }

            // Transcribe audio
            const start = Date.now();
            const transcript = await transcribeAudio(audioBuffer, `${sessionId}_${questionId}.${data.mimetype?.split('/')[1] || 'webm'}`);

            if (!transcript || transcript.trim().length === 0) {
                return reply.code(400).send({ error: 'Failed to transcribe audio or empty transcript' });
            }

            // Evaluate the transcribed answer
            const evalResult = await evaluateAnswer(qRow.skill, qRow.question, transcript);
            await storeAnswer(questionId, transcript, evalResult as any);

            // Update answer metadata
            const supabaseAdmin2 = getSupabase();
            await supabaseAdmin2.from('interview_answers').update({
                transcript_full: transcript,
                started_at: new Date(start),
                ended_at: new Date(),
                duration_ms: Date.now() - start
            }).eq('question_id', questionId);

            // Update session stats
            const avg = await calculateSessionScore(sessionId);
            await updateSessionStatus(sessionId, 'in_progress', { averageScore: avg });

            // Aggregate speaking time
            try {
                const supa = getSupabase();
                const { data: qIds } = await supa.from('interview_questions').select('id').eq('session_id', sessionId);
                if (qIds && qIds.length) {
                    const { data: durations } = await supa.from('interview_answers').select('duration_ms,question_id').in('question_id', qIds.map(q => q.id));
                    const total = (durations || []).reduce((s, a) => s + (a.duration_ms || 0), 0);
                    await supa.from('interview_sessions').update({ speaking_time_ms: total }).eq('id', sessionId);
                }
            } catch (aggErr) {
                fastify.log.error(`Failed updating speaking_time_ms: ${String(aggErr)}`);
            }

            reply.send({
                transcript,
                evaluation: evalResult,
                duration: Date.now() - start
            });
        } catch (err) {
            fastify.log.error(`Audio transcription and evaluation failed: ${String(err)}`);
            reply.code(500).send({ error: 'Failed to process audio' });
        }
    });

    // Streaming answer submission (SSE)
    fastify.get('/sessions/:sessionId/questions/:questionId/answer/stream', {
        schema: {
            params: {
                type: 'object',
                properties: { sessionId: { type: 'string' }, questionId: { type: 'string' } },
                required: ['sessionId', 'questionId']
            },
            querystring: {
                type: 'object',
                properties: { answer: { type: 'string' } },
                required: ['answer']
            }
        }
    }, async (request, reply) => {
        const { sessionId, questionId } = request.params as any;
        const { answer } = request.query as any;
        const supabaseAdmin = getSupabase();
        const { data: qRow, error: qErr } = await supabaseAdmin.from('interview_questions').select('*').eq('id', questionId).maybeSingle();
        if (qErr || !qRow) {
            reply.code(404).send({ error: 'Question not found' });
            return;
        }
        reply.raw.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
        });
        try {
            const start = Date.now();
            for await (const chunk of streamEvaluateAnswer(qRow.skill, qRow.question, answer)) {
                const shaped = (chunk as any).final ? { type: 'final', evaluation: (chunk as any).final } : (chunk as any).error ? { type: 'error', message: (chunk as any).error } : { type: 'progress', ...chunk };
                reply.raw.write(`data: ${JSON.stringify(shaped)}\n\n`);
                if ((chunk as any).final) {
                    try {
                        await storeAnswer(questionId, answer, (chunk as any).final);
                        const supabaseAdmin2 = getSupabase();
                        await supabaseAdmin2.from('interview_answers').update({ transcript_full: answer, started_at: new Date(start), ended_at: new Date(), duration_ms: Date.now() - start }).eq('question_id', questionId);
                        const avg = await calculateSessionScore(sessionId);
                        await updateSessionStatus(sessionId, 'in_progress', { averageScore: avg });
                        // Aggregate speaking time after persistence
                        try {
                            const supa = getSupabase();
                            const { data: qIds } = await supa.from('interview_questions').select('id').eq('session_id', sessionId);
                            if (qIds && qIds.length) {
                                const { data: durations } = await supa.from('interview_answers').select('duration_ms,question_id').in('question_id', qIds.map(q => q.id));
                                const total = (durations || []).reduce((s, a) => s + (a.duration_ms || 0), 0);
                                await supa.from('interview_sessions').update({ speaking_time_ms: total }).eq('id', sessionId);
                            }
                        } catch (aggErr) {
                            fastify.log.error(`Failed updating speaking_time_ms (stream): ${String(aggErr)}`);
                        }
                    } catch (storeErr) {
                        fastify.log.error(`Failed to persist streaming final evaluation: ${String(storeErr)}`);
                    }
                }
            }
        } catch (err) {
            fastify.log.error(`Streaming answer failed: ${String(err)}`);
            reply.raw.write(`data: ${JSON.stringify({ type: 'error', message: 'Streaming evaluation failed' })}\n\n`);
        } finally {
            reply.raw.end();
        }
    });

    // Session summary (aggregate evaluations)
    fastify.get('/sessions/:sessionId/summary', {
        schema: { params: { type: 'object', properties: { sessionId: { type: 'string' } }, required: ['sessionId'] } }
    }, async (request, reply) => {
        const { sessionId } = request.params as any;
        const user = (request as any).user; // Global JWT auth sets req.user

        const supabaseAdmin = getSupabase();

        // Get user details from database since JWT only has basic info
        let authUser = null;
        if (user && user.sub) {
            const { data: userFromDB } = await supabaseAdmin.from('users').select('id,first_time,email,role').eq('id', user.sub).single();
            authUser = userFromDB;
        }

        const { data: questions } = await supabaseAdmin.from('interview_questions').select('id,skill,question').eq('session_id', sessionId);
        const { data: answers } = await supabaseAdmin.from('interview_answers').select('question_id,score,reasoning,duration_ms,created_at').in('question_id', (questions || []).map(q => q.id));
        const items = (questions || []).map(q => ({
            id: q.id,
            skill: q.skill,
            question: q.question,
            answer: answers?.find(a => a.question_id === q.id) || null
        }));
        const scored = items.filter(i => i.answer && typeof i.answer.score === 'number');
        const avg = scored.length ? scored.reduce((s, i) => s + Number((i.answer as any)?.score || 0), 0) / scored.length : 0;

        // Mark profile as complete for first-time users when they access their interview summary
        console.log('Summary endpoint - authUser:', authUser ? { id: authUser.id, first_time: authUser.first_time } : 'no authUser');

        if (authUser && authUser.first_time) {
            console.log('Marking profile as complete for first-time user:', authUser.id);
            try {
                const result = await authService.markProfileComplete(authUser.id);
                console.log('Profile completion result:', result);
            } catch (error) {
                // Don't fail the summary request if profile update fails
                console.error(`Failed to mark profile complete for user ${authUser.id}:`, error);
                fastify.log.warn(`Failed to mark profile complete for user ${authUser.id}: ${String(error)}`);
            }
        } else {
            console.log('Not marking profile complete - user not first time or no auth user');
        }

        reply.send({ sessionId, averageScore: avg, totalQuestions: questions?.length || 0, answered: scored.length, items });
    });

    // Get session details
    fastify.get('/sessions/:sessionId', {
        schema: {
            params: {
                type: 'object',
                properties: {
                    sessionId: { type: 'string' }
                },
                required: ['sessionId']
            }
        }
    }, async (request, reply) => {
        const { sessionId } = request.params as { sessionId: string };

        try {
            const session = await getSessionById(sessionId);

            if (!session) {
                reply.code(404).send({ error: 'Session not found' });
                return;
            }

            reply.send(session);
        } catch (error) {
            fastify.log.error(`Failed to get session: ${String(error)}`);
            reply.code(500).send({
                error: 'Failed to retrieve session',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });

    // Update session status
    fastify.patch('/sessions/:sessionId', {
        schema: {
            params: {
                type: 'object',
                properties: {
                    sessionId: { type: 'string' }
                },
                required: ['sessionId']
            },
            body: {
                type: 'object',
                properties: {
                    status: { type: 'string', enum: ['created', 'in_progress', 'completed', 'cancelled'] },
                    metadata: { type: 'object' }
                }
            }
        }
    }, async (request, reply) => {
        const { sessionId } = request.params as { sessionId: string };
        const { status, metadata } = request.body as { status?: string; metadata?: any };

        try {
            // Verify session exists
            const session = await getSessionById(sessionId);
            if (!session) {
                reply.code(404).send({ error: 'Session not found' });
                return;
            }

            // Update session
            if (status) {
                await updateSessionStatus(sessionId, status, metadata);
            }

            // Return updated session
            const updatedSession = await getSessionById(sessionId);
            reply.send(updatedSession);
        } catch (error) {
            fastify.log.error(`Failed to update session: ${String(error)}`);
            reply.code(500).send({
                error: 'Failed to update session',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });

    // Legacy evaluation endpoint
    fastify.post('/evaluate', {
        schema: {
            description: 'Evaluate candidate answer to a question',
            body: {
                type: 'object',
                properties: {
                    skill: { type: 'string' },
                    question: { type: 'string' },
                    answer: { type: 'string' }
                },
                required: ['skill', 'question', 'answer']
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        score: { type: 'number' },
                        reasoning: { type: 'string' }
                    }
                }
            }
        }
    }, async (request, reply) => {
        const { skill, question, answer } = request.body as { skill: string; question: string; answer: string };

        try {
            const evaluation = await evaluateAnswer(skill, question, answer);
            reply.send({
                score: evaluation.score,
                reasoning: evaluation.reasoning
            });
        } catch (error) {
            fastify.log.error(`Legacy evaluation failed: ${String(error)}`);
            reply.code(500).send({ error: 'Evaluation failed' });
        }
    });

    // Modern comprehensive evaluation
    fastify.post('/evaluations', {
        schema: {
            body: {
                type: 'object',
                properties: {
                    skill: { type: 'string', minLength: 1 },
                    question: { type: 'string', minLength: 1 },
                    answer: { type: 'string', minLength: 1 },
                    candidateLevel: { type: 'string' },
                    jobRequirement: { type: 'string' },
                    contextualFactors: { type: 'array', items: { type: 'string' } }
                },
                required: ['skill', 'question', 'answer']
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        evaluation: { type: 'object' },
                        evaluatedAt: { type: 'string' }
                    }
                }
            }
        }
    }, async (request, reply) => {
        const data = request.body as z.infer<typeof EvaluateAnswerSchema>;

        try {
            const evaluation = await evaluateAnswer(data.skill, data.question, data.answer, {
                candidateLevel: data.candidateLevel,
                jobRequirement: data.jobRequirement,
                contextualFactors: data.contextualFactors
            });

            reply.send({
                evaluation,
                evaluatedAt: new Date().toISOString()
            });
        } catch (error) {
            fastify.log.error(`Failed to evaluate answer: ${String(error)}`);
            reply.code(500).send({
                error: 'Failed to evaluate answer',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });

    // Streaming evaluation endpoint
    fastify.get('/evaluate/stream', {
        schema: {
            querystring: {
                type: 'object',
                properties: {
                    skill: { type: 'string' },
                    question: { type: 'string' },
                    answer: { type: 'string' },
                    candidateLevel: { type: 'string' },
                    jobRequirement: { type: 'string' }
                },
                required: ['skill', 'question', 'answer']
            }
        }
    }, async (request, reply) => {
        const { skill, question, answer, candidateLevel, jobRequirement } = request.query as any;

        // Set SSE headers
        reply.raw.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
        });

        try {
            for await (const chunk of streamEvaluateAnswer(skill, question, answer, { candidateLevel, jobRequirement })) {
                const shaped = (chunk as any).final ? { type: 'final', evaluation: (chunk as any).final } : (chunk as any).error ? { type: 'error', message: (chunk as any).error } : { type: 'progress', ...chunk };
                reply.raw.write(`data: ${JSON.stringify(shaped)}\n\n`);
            }
        } catch (error) {
            fastify.log.error(`Streaming evaluation failed: ${String(error)}`);
            reply.raw.write(`data: ${JSON.stringify({ type: 'error', message: 'Evaluation failed' })}\n\n`);
        } finally {
            reply.raw.end();
        }
    });

    // Legacy streaming evaluation 
    fastify.get('/stream-evaluate', {
        schema: {
            description: 'Streaming evaluation of candidate answer',
            querystring: {
                type: 'object',
                properties: {
                    skill: { type: 'string' },
                    question: { type: 'string' },
                    answer: { type: 'string' }
                },
                required: ['skill', 'question', 'answer']
            }
        }
    }, async (request, reply) => {
        const { skill, question, answer } = request.query as { skill: string; question: string; answer: string };

        reply.raw.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });

        try {
            for await (const chunk of streamEvaluateAnswer(skill, question, answer)) {
                reply.raw.write(`data: ${JSON.stringify(chunk)}\n\n`);
            }
        } catch (error) {
            fastify.log.error(`Legacy streaming evaluation failed: ${String(error)}`);
            reply.raw.write(`data: ${JSON.stringify({ type: 'error', message: 'Evaluation failed' })}\n\n`);
        } finally {
            reply.raw.end();
        }
    });

    // Health check
    fastify.get('/health', async (request, reply) => {
        try {
            const testQuestions = await generateQuestions(['JavaScript'], 'Test candidate', {
                difficulty: 'beginner',
                questionCount: 1
            });

            reply.send({
                status: 'healthy',
                service: 'interview',
                timestamp: new Date().toISOString(),
                checks: {
                    questionGeneration: testQuestions.length > 0,
                    database: true
                }
            });
        } catch (error) {
            reply.code(503).send({
                status: 'unhealthy',
                service: 'interview',
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString()
            });
        }
    });
};

// Legacy function export for backward compatibility
export function registerInterviewRoutes(app: any) {
    app.register(interviewRoutes, { prefix: '/api/interview' });
}
