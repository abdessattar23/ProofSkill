import type { FastifyInstance } from 'fastify';
import { registerCvRoutes } from './cv';
import { registerInterviewRoutes } from './interview';
import { registerJobRoutes } from './jobs';
import { registerCandidateRoutes } from './candidates';
import { registerAudioRoutes } from './audio';
import { registerQueueRoutes } from './queue';
import { registerAuthRoutes } from './auth';
import skillRoutes from './skills';
import matchingRoutes from './matching';
import monitoringRoutes from './monitoring';
import { registerStreamingRoutes } from './streaming-new';

export function registerV1Routes(app: FastifyInstance) {
    // Register all route modules with /v1 prefix
    app.register(async function (fastify) {
        // Add version-specific middleware/validation here if needed
        fastify.addHook('preHandler', async (req, reply) => {
            // Add version header
            reply.header('API-Version', 'v1');
        });

        registerCvRoutes(fastify);
        registerInterviewRoutes(fastify);
        registerJobRoutes(fastify);
        registerCandidateRoutes(fastify);
        registerAudioRoutes(fastify);
        registerQueueRoutes(fastify);
        registerAuthRoutes(fastify);
        registerStreamingRoutes(fastify);

        // Register skill routes
        fastify.register(skillRoutes);

        // Register matching routes
        fastify.register(matchingRoutes);

        // Register monitoring routes
        fastify.register(monitoringRoutes);
    }, { prefix: '/v1' });

    // Health and docs remain at root level
    app.get('/healthz', async () => ({ ok: true, version: 'v1' }));

    // Redirect root API calls to v1 for backward compatibility
    app.register(async function (fastify) {
        fastify.addHook('preHandler', async (req, reply) => {
            const path = req.url.replace('/api/', '/v1/api/');
            reply.redirect(301, path);
        });
    }, { prefix: '/api' });
}
