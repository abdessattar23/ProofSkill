import { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/auth';
import { streamingSessionService } from '../services/streamingSessionService';
import { Readable } from 'stream';

// In-memory storage for audio chunks and SSE connections (performance-critical)
const audioChunks = new Map<string, Buffer[]>();
const sseConnections = new Map<string, any>();

export function registerStreamingRoutes(app: FastifyInstance) {
    // Create streaming session
    app.post('/api/streaming/session', {
        preHandler: [requireAuth],
        schema: {
            body: {
                type: 'object',
                properties: {
                    candidateId: { type: 'string' }
                },
                required: ['candidateId']
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
        try {
            const { candidateId } = request.body as { candidateId: string };

            const sessionId = await streamingSessionService.createSession({ candidateId });
            const uploadUrl = `/v1/streaming/upload/${sessionId}`;

            // Initialize audio chunks storage for this session
            audioChunks.set(sessionId, []);

            return {
                success: true,
                sessionId,
                uploadUrl
            };
        } catch (error) {
            console.error('Error creating streaming session:', error);
            return reply.internalServerError('Failed to create streaming session');
        }
    });

    // Upload audio chunk
    app.post('/api/streaming/upload/:sessionId', {
        preHandler: [requireAuth],
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
        try {
            const { sessionId } = request.params as { sessionId: string };

            // Check if session exists and is active
            const isActive = await streamingSessionService.isSessionActive(sessionId);
            if (!isActive) {
                return reply.badRequest('Session not found or inactive');
            }

            // Get chunks array for this session
            const chunks = audioChunks.get(sessionId);
            if (!chunks) {
                return reply.badRequest('Session not initialized');
            }

            // Process the uploaded chunk
            const data = await request.file();
            if (!data) {
                return reply.badRequest('No audio data provided');
            }

            const buffer = await data.toBuffer();
            chunks.push(buffer);

            // Update session activity
            await streamingSessionService.updateActivity(sessionId);

            // Notify SSE connections about new chunk
            const sseConnection = sseConnections.get(sessionId);
            if (sseConnection) {
                const eventData = JSON.stringify({
                    type: 'chunk',
                    chunkIndex: chunks.length - 1,
                    timestamp: new Date().toISOString()
                });
                sseConnection.write(`data: ${eventData}\n\n`);
            }

            return {
                success: true,
                chunkIndex: chunks.length - 1,
                totalChunks: chunks.length
            };
        } catch (error) {
            console.error('Error uploading audio chunk:', error);
            return reply.internalServerError('Failed to upload audio chunk');
        }
    });

    // Get session status
    app.get('/api/streaming/session/:sessionId', {
        preHandler: [requireAuth],
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
        try {
            const { sessionId } = request.params as { sessionId: string };

            const session = await streamingSessionService.getSession(sessionId);
            if (!session) {
                return reply.notFound('Session not found');
            }

            const chunks = audioChunks.get(sessionId) || [];

            return {
                success: true,
                session: {
                    id: session.id,
                    candidateId: session.candidate_id,
                    status: session.status,
                    totalChunks: chunks.length,
                    createdAt: session.created_at,
                    lastActivity: session.last_activity
                }
            };
        } catch (error) {
            console.error('Error getting session status:', error);
            return reply.internalServerError('Failed to get session status');
        }
    });

    // Complete streaming session
    app.post('/api/streaming/session/:sessionId/complete', {
        preHandler: [requireAuth],
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
        try {
            const { sessionId } = request.params as { sessionId: string };

            const session = await streamingSessionService.getSession(sessionId);
            if (!session) {
                return reply.notFound('Session not found');
            }

            // Update session status to completed
            await streamingSessionService.updateStatus(sessionId, 'completed');

            const chunks = audioChunks.get(sessionId) || [];
            const audioBuffer = chunks.length > 0 ? Buffer.concat(chunks) : null;

            // Here you could save the audio to permanent storage
            // For now, we'll just return metadata
            const transcript = `[Transcription for session ${sessionId}]`;
            const audioUrl = `/v1/audio/download/${sessionId}`;

            // Close SSE connection if exists
            const sseConnection = sseConnections.get(sessionId);
            if (sseConnection) {
                sseConnection.write(`data: ${JSON.stringify({ type: 'completed' })}\n\n`);
                sseConnection.end();
                sseConnections.delete(sessionId);
            }

            return {
                success: true,
                transcript,
                audioUrl,
                duration: audioBuffer ? Math.floor(audioBuffer.length / 16000) : 0, // Estimate duration
                size: audioBuffer ? audioBuffer.length : 0
            };
        } catch (error) {
            console.error('Error completing streaming session:', error);
            return reply.internalServerError('Failed to complete streaming session');
        }
    });

    // Download audio
    app.get('/api/streaming/download/:sessionId', {
        preHandler: [requireAuth],
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
        try {
            const { sessionId } = request.params as { sessionId: string };

            const session = await streamingSessionService.getSession(sessionId);
            if (!session) {
                return reply.notFound('Session not found');
            }

            const chunks = audioChunks.get(sessionId);
            if (!chunks || chunks.length === 0) {
                return reply.notFound('No audio data available');
            }

            const audioBuffer = Buffer.concat(chunks);
            
            reply.header('Content-Type', 'audio/wav');
            reply.header('Content-Disposition', `attachment; filename="audio_${sessionId}.wav"`);
            reply.header('Content-Length', audioBuffer.length.toString());

            const stream = new Readable({
                read() {
                    this.push(audioBuffer);
                    this.push(null);
                }
            });

            return reply.send(stream);
        } catch (error) {
            console.error('Error downloading audio:', error);
            return reply.internalServerError('Failed to download audio');
        }
    });

    // Server-Sent Events for real-time updates
    app.get('/api/streaming/events/:sessionId', {
        preHandler: [requireAuth],
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
        try {
            const { sessionId } = request.params as { sessionId: string };

            const session = await streamingSessionService.getSession(sessionId);
            if (!session) {
                return reply.notFound('Session not found');
            }

            reply.raw.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Cache-Control'
            });

            // Store connection for this session
            sseConnections.set(sessionId, reply.raw);

            // Send initial connection event
            reply.raw.write(`data: ${JSON.stringify({ type: 'connected', sessionId })}\n\n`);

            // Handle client disconnect
            request.raw.on('close', () => {
                sseConnections.delete(sessionId);
            });

            request.raw.on('error', () => {
                sseConnections.delete(sessionId);
            });

        } catch (error) {
            console.error('Error setting up SSE connection:', error);
            return reply.internalServerError('Failed to establish SSE connection');
        }
    });

    // Cancel streaming session
    app.delete('/api/streaming/session/:sessionId', {
        preHandler: [requireAuth],
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
        try {
            const { sessionId } = request.params as { sessionId: string };

            const session = await streamingSessionService.getSession(sessionId);
            if (!session) {
                return reply.notFound('Session not found');
            }

            // Update status to cancelled
            await streamingSessionService.updateStatus(sessionId, 'cancelled');

            // Clean up audio chunks
            audioChunks.delete(sessionId);

            // Close SSE connection
            const sseConnection = sseConnections.get(sessionId);
            if (sseConnection) {
                sseConnection.write(`data: ${JSON.stringify({ type: 'cancelled' })}\n\n`);
                sseConnection.end();
                sseConnections.delete(sessionId);
            }

            return { success: true };
        } catch (error) {
            console.error('Error cancelling streaming session:', error);
            return reply.internalServerError('Failed to cancel streaming session');
        }
    });

    // Get all active sessions (admin only)
    app.get('/api/streaming/sessions', {
        preHandler: [requireAuth],
        schema: {
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        sessions: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    id: { type: 'string' },
                                    candidateId: { type: 'string' },
                                    status: { type: 'string' },
                                    createdAt: { type: 'string' },
                                    lastActivity: { type: 'string' }
                                }
                            }
                        }
                    }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const user = (request as any).authUser;
            if (user.role !== 'admin') {
                return reply.forbidden('Admin access required');
            }

            const sessions = await streamingSessionService.getActiveSessions();

            return {
                success: true,
                sessions: sessions.map(session => ({
                    id: session.id,
                    candidateId: session.candidate_id,
                    status: session.status,
                    createdAt: session.created_at,
                    lastActivity: session.last_activity
                }))
            };
        } catch (error) {
            console.error('Error getting active sessions:', error);
            return reply.internalServerError('Failed to get active sessions');
        }
    });
}
