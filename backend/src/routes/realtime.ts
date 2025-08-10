import { FastifyPluginCallback } from 'fastify';

interface SSEClient {
    response: any;
    userId: string;
    sessionId?: string;
    lastActivity: number;
}

interface BroadcastMessage {
    type: string;
    data: any;
    sessionId?: string;
    timestamp?: string;
}

export const realtimeRoutes: FastifyPluginCallback = async (fastify, opts) => {
    // Store active SSE clients
    const sseClients = new Map<string, SSEClient>();

    // Server-Sent Events endpoint for interview updates
    fastify.get('/sse/interview/:sessionId', {
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
        const userId = (request as any).user?.id;

        if (!userId) {
            reply.code(401).send({ error: 'Unauthorized' });
            return;
        }

        // Set SSE headers
        reply.raw.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Cache-Control'
        });

        const clientId = generateConnectionId();
        const client: SSEClient = {
            response: reply.raw,
            userId,
            sessionId,
            lastActivity: Date.now()
        };

        sseClients.set(clientId, client);
        fastify.log.info(`SSE client connected: ${clientId} for session ${sessionId}`);

        // Send initial connection event
        sendSSEMessage(reply.raw, 'connected', {
            sessionId,
            timestamp: new Date().toISOString()
        });

        // Handle client disconnect
        request.raw.on('close', () => {
            fastify.log.info(`SSE client disconnected: ${clientId}`);
            sseClients.delete(clientId);
        });

        // Keep connection alive with periodic pings
        const pingInterval = setInterval(() => {
            if (sseClients.has(clientId)) {
                try {
                    sendSSEMessage(reply.raw, 'ping', { timestamp: new Date().toISOString() });
                    client.lastActivity = Date.now();
                } catch (error) {
                    fastify.log.info(`SSE client ${clientId} disconnected during ping`);
                    sseClients.delete(clientId);
                    clearInterval(pingInterval);
                }
            } else {
                clearInterval(pingInterval);
            }
        }, 30000); // Ping every 30 seconds
    });

    // Broadcast interview updates to SSE clients
    fastify.post('/broadcast/interview/:sessionId', {
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
                    type: { type: 'string' },
                    data: { type: 'object' }
                },
                required: ['type', 'data']
            }
        }
    }, async (request, reply) => {
        const { sessionId } = request.params as { sessionId: string };
        const { type, data } = request.body as { type: string; data: any };

        let broadcastCount = 0;

        // Broadcast to SSE clients
        for (const [clientId, client] of sseClients.entries()) {
            if (client.sessionId === sessionId) {
                try {
                    sendSSEMessage(client.response, type, {
                        ...data,
                        sessionId,
                        timestamp: new Date().toISOString()
                    });
                    client.lastActivity = Date.now();
                    broadcastCount++;
                } catch (error) {
                    fastify.log.info(`Error sending SSE message to ${clientId}, removing client`);
                    sseClients.delete(clientId);
                }
            }
        }

        reply.send({ success: true, broadcastCount });
    });

    // Global broadcast endpoint for system-wide updates
    fastify.post('/broadcast/global', {
        schema: {
            body: {
                type: 'object',
                properties: {
                    type: { type: 'string' },
                    data: { type: 'object' },
                    userIds: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Optional array of user IDs to target specific users'
                    }
                },
                required: ['type', 'data']
            }
        }
    }, async (request, reply) => {
        const { type, data, userIds } = request.body as {
            type: string;
            data: any;
            userIds?: string[]
        };

        let broadcastCount = 0;

        // Broadcast to all SSE clients or specific users
        for (const [clientId, client] of sseClients.entries()) {
            const shouldBroadcast = !userIds || userIds.includes(client.userId);

            if (shouldBroadcast) {
                try {
                    sendSSEMessage(client.response, type, {
                        ...data,
                        timestamp: new Date().toISOString()
                    });
                    client.lastActivity = Date.now();
                    broadcastCount++;
                } catch (error) {
                    fastify.log.info(`Error sending global broadcast to ${clientId}, removing client`);
                    sseClients.delete(clientId);
                }
            }
        }

        reply.send({ success: true, broadcastCount });
    });

    // Audio chunk upload endpoint for chunked audio streaming
    fastify.post('/audio/chunk/:sessionId', {
        schema: {
            params: {
                type: 'object',
                properties: {
                    sessionId: { type: 'string' }
                },
                required: ['sessionId']
            },
            querystring: {
                type: 'object',
                properties: {
                    chunkIndex: { type: 'number' },
                    isLastChunk: { type: 'boolean' }
                }
            }
        }
    }, async (request, reply) => {
        const { sessionId } = request.params as { sessionId: string };
        const { chunkIndex, isLastChunk } = request.query as {
            chunkIndex?: number;
            isLastChunk?: boolean
        };

        // Handle audio chunk upload
        const audioChunk = await request.file();

        if (!audioChunk) {
            reply.code(400).send({ error: 'No audio chunk provided' });
            return;
        }

        // Process the audio chunk
        const chunkBuffer = await audioChunk.toBuffer();

        // Broadcast chunk received event to session participants
        const broadcastData = {
            sessionId,
            chunkIndex: chunkIndex || 0,
            chunkSize: chunkBuffer.length,
            isLastChunk: isLastChunk || false,
            timestamp: new Date().toISOString()
        };

        let notifiedClients = 0;
        for (const [clientId, client] of sseClients.entries()) {
            if (client.sessionId === sessionId) {
                try {
                    sendSSEMessage(client.response, 'audio_chunk_received', broadcastData);
                    client.lastActivity = Date.now();
                    notifiedClients++;
                } catch (error) {
                    fastify.log.info(`Error notifying client ${clientId} of audio chunk`);
                    sseClients.delete(clientId);
                }
            }
        }

        reply.send({
            success: true,
            chunkIndex: chunkIndex || 0,
            chunkSize: chunkBuffer.length,
            isLastChunk: isLastChunk || false,
            notifiedClients
        });
    });

    // Get active connections status endpoint
    fastify.get('/status/connections', async (request, reply) => {
        const connections = Array.from(sseClients.entries()).map(([clientId, client]) => ({
            clientId,
            userId: client.userId,
            sessionId: client.sessionId,
            lastActivity: new Date(client.lastActivity).toISOString(),
            connectionAge: Date.now() - client.lastActivity
        }));

        reply.send({
            totalConnections: sseClients.size,
            connections,
            timestamp: new Date().toISOString()
        });
    });

    // Interview session lifecycle hooks
    fastify.post('/session/:sessionId/start', {
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

        // Broadcast session start to all participants
        await broadcastToSession(sessionId, 'session_started', {
            sessionId,
            startTime: new Date().toISOString()
        });

        reply.send({ success: true, sessionId });
    });

    fastify.post('/session/:sessionId/end', {
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

        // Broadcast session end to all participants
        await broadcastToSession(sessionId, 'session_ended', {
            sessionId,
            endTime: new Date().toISOString()
        });

        reply.send({ success: true, sessionId });
    });

    // Helper functions
    function sendSSEMessage(response: any, type: string, data: any) {
        const message = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
        response.write(message);
    }

    function generateConnectionId(): string {
        return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    async function broadcastToSession(sessionId: string, type: string, data: any) {
        let broadcastCount = 0;

        for (const [clientId, client] of sseClients.entries()) {
            if (client.sessionId === sessionId) {
                try {
                    sendSSEMessage(client.response, type, data);
                    client.lastActivity = Date.now();
                    broadcastCount++;
                } catch (error) {
                    fastify.log.info(`Error broadcasting to session ${sessionId}, client ${clientId}`);
                    sseClients.delete(clientId);
                }
            }
        }

        return broadcastCount;
    }

    // Cleanup inactive connections periodically
    const cleanupInterval = setInterval(() => {
        const now = Date.now();
        const timeout = 300000; // 5 minute timeout

        for (const [clientId, client] of sseClients.entries()) {
            if ((now - client.lastActivity) > timeout) {
                fastify.log.info(`Cleaning up inactive SSE client: ${clientId}`);
                try {
                    client.response.end();
                } catch (error) {
                    // Ignore errors when closing
                }
                sseClients.delete(clientId);
            }
        }
    }, 60000); // Run cleanup every minute

    // Cleanup on shutdown
    fastify.addHook('onClose', async () => {
        clearInterval(cleanupInterval);

        // Close all SSE connections
        for (const [clientId, client] of sseClients.entries()) {
            try {
                client.response.end();
            } catch (error) {
                // Ignore errors during shutdown
            }
        }

        sseClients.clear();
    });
};
