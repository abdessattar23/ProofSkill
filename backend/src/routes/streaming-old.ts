import { FastifyInstance } from 'fastify';
import { EventEmitter } from 'events';
import { Readable } from 'stream';

interface StreamingSession {
    id: string;
    candidateId: string;
    chunks: Buffer[];
    startTime: Date;
    lastActivity: Date;
    isActive: boolean;
}

class AudioStreamManager extends EventEmitter {
    private sessions = new Map<string, StreamingSession>();
    private cleanupInterval: NodeJS.Timeout;

    constructor() {
        super();
        // Cleanup inactive sessions every 5 minutes
        this.cleanupInterval = setInterval(() => {
            this.cleanupInactiveSessions();
        }, 5 * 60 * 1000);
    }

    createSession(candidateId: string): string {
        const sessionId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        this.sessions.set(sessionId, {
            id: sessionId,
            candidateId,
            chunks: [],
            startTime: new Date(),
            lastActivity: new Date(),
            isActive: true
        });

        return sessionId;
    }

    appendChunk(sessionId: string, chunk: Buffer): boolean {
        const session = this.sessions.get(sessionId);
        if (!session || !session.isActive) {
            return false;
        }

        session.chunks.push(chunk);
        session.lastActivity = new Date();

        // Emit chunk received event
        this.emit('chunk', { sessionId, chunkIndex: session.chunks.length - 1 });

        return true;
    }

    finalizeSession(sessionId: string): Buffer | null {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return null;
        }

        session.isActive = false;
        const audioBuffer = Buffer.concat(session.chunks);

        // Emit session completed event
        this.emit('sessionComplete', { sessionId, audioBuffer });

        return audioBuffer;
    }

    getSession(sessionId: string): StreamingSession | undefined {
        return this.sessions.get(sessionId);
    }

    private cleanupInactiveSessions() {
        const now = new Date();
        const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

        for (const [sessionId, session] of this.sessions) {
            const timeSinceLastActivity = now.getTime() - session.lastActivity.getTime();

            if (timeSinceLastActivity > TIMEOUT_MS) {
                this.sessions.delete(sessionId);
                this.emit('sessionTimeout', { sessionId });
            }
        }
    }

    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.sessions.clear();
    }
}

export const audioStreamManager = new AudioStreamManager();

export default async function (fastify: FastifyInstance) {

    // Start streaming audio session
    fastify.post('/streaming/start', {
        schema: {
            tags: ['Audio Streaming'],
            summary: 'Start streaming audio session',
            description: 'Initialize a new streaming audio session for real-time recording',
            body: {
                type: 'object',
                required: ['candidateId'],
                properties: {
                    candidateId: { type: 'string', format: 'uuid' }
                }
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        sessionId: { type: 'string' },
                        uploadUrl: { type: 'string' }
                    }
                }
            }
        }
    }, async (request, reply) => {
        const { candidateId } = request.body as { candidateId: string };

        try {
            const sessionId = audioStreamManager.createSession(candidateId);
            const uploadUrl = `/v1/streaming/upload/${sessionId}`;

            reply.send({
                success: true,
                sessionId,
                uploadUrl
            });
        } catch (error: any) {
            fastify.log.error('Failed to start streaming session:', error);
            reply.status(500).send({
                error: 'Failed to start streaming session'
            });
        }
    });

    // Upload audio chunks
    fastify.post('/streaming/upload/:sessionId', {
        schema: {
            tags: ['Audio Streaming'],
            summary: 'Upload audio chunk',
            description: 'Upload an audio chunk to an active streaming session',
            params: {
                type: 'object',
                properties: {
                    sessionId: { type: 'string' }
                },
                required: ['sessionId']
            },
            consumes: ['audio/webm', 'audio/wav', 'audio/mp3', 'application/octet-stream'],
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        chunkIndex: { type: 'number' },
                        totalChunks: { type: 'number' }
                    }
                }
            }
        }
    }, async (request, reply) => {
        const { sessionId } = request.params as { sessionId: string };

        try {
            const session = audioStreamManager.getSession(sessionId);
            if (!session) {
                return reply.status(404).send({ error: 'Session not found' });
            }

            if (!session.isActive) {
                return reply.status(400).send({ error: 'Session is not active' });
            }

            // Get raw body as buffer
            const audioChunk = request.body as Buffer;

            if (!audioChunk || audioChunk.length === 0) {
                return reply.status(400).send({ error: 'No audio data provided' });
            }

            const success = audioStreamManager.appendChunk(sessionId, audioChunk);

            if (!success) {
                return reply.status(400).send({ error: 'Failed to append chunk' });
            }

            reply.send({
                success: true,
                chunkIndex: session.chunks.length - 1,
                totalChunks: session.chunks.length
            });
        } catch (error: any) {
            fastify.log.error('Failed to upload chunk:', error);
            reply.status(500).send({
                error: 'Failed to upload chunk'
            });
        }
    });

    // Finalize streaming session and get transcription
    fastify.post('/streaming/finalize/:sessionId', {
        schema: {
            tags: ['Audio Streaming'],
            summary: 'Finalize streaming session',
            description: 'Complete streaming session and get final transcription',
            params: {
                type: 'object',
                properties: {
                    sessionId: { type: 'string' }
                },
                required: ['sessionId']
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        transcript: { type: 'string' },
                        duration: { type: 'number' },
                        audioUrl: { type: 'string' }
                    }
                }
            }
        }
    }, async (request, reply) => {
        const { sessionId } = request.params as { sessionId: string };

        try {
            const session = audioStreamManager.getSession(sessionId);
            if (!session) {
                return reply.status(404).send({ error: 'Session not found' });
            }

            const audioBuffer = audioStreamManager.finalizeSession(sessionId);
            if (!audioBuffer) {
                return reply.status(400).send({ error: 'Failed to finalize session' });
            }

            // Calculate duration (rough estimate based on buffer size)
            const duration = Math.ceil(audioBuffer.length / (16000 * 2)); // Assuming 16kHz, 16-bit

            // Here you would typically:
            // 1. Save the complete audio file
            // 2. Send to transcription service
            // 3. Store in database

            // For now, return mock response
            const transcript = `[Transcription for session ${sessionId}]`;
            const audioUrl = `/v1/audio/download/${sessionId}`;

            reply.send({
                success: true,
                transcript,
                duration,
                audioUrl
            });
        } catch (error: any) {
            fastify.log.error('Failed to finalize session:', error);
            reply.status(500).send({
                error: 'Failed to finalize session'
            });
        }
    });

    // Get session status
    fastify.get('/streaming/status/:sessionId', {
        schema: {
            tags: ['Audio Streaming'],
            summary: 'Get streaming session status',
            description: 'Get current status of a streaming audio session',
            params: {
                type: 'object',
                properties: {
                    sessionId: { type: 'string' }
                },
                required: ['sessionId']
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        session: {
                            type: 'object',
                            properties: {
                                id: { type: 'string' },
                                candidateId: { type: 'string' },
                                isActive: { type: 'boolean' },
                                chunkCount: { type: 'number' },
                                startTime: { type: 'string', format: 'date-time' },
                                lastActivity: { type: 'string', format: 'date-time' }
                            }
                        }
                    }
                }
            }
        }
    }, async (request, reply) => {
        const { sessionId } = request.params as { sessionId: string };

        try {
            const session = audioStreamManager.getSession(sessionId);
            if (!session) {
                return reply.status(404).send({ error: 'Session not found' });
            }

            reply.send({
                success: true,
                session: {
                    id: session.id,
                    candidateId: session.candidateId,
                    isActive: session.isActive,
                    chunkCount: session.chunks.length,
                    startTime: session.startTime.toISOString(),
                    lastActivity: session.lastActivity.toISOString()
                }
            });
        } catch (error: any) {
            fastify.log.error('Failed to get session status:', error);
            reply.status(500).send({
                error: 'Failed to get session status'
            });
        }
    });

}
