import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import sensible from '@fastify/sensible';
import { registerCvRoutes } from '../src/routes/cv';
import { registerJobRoutes } from '../src/routes/jobs';
import { registerCandidateRoutes } from '../src/routes/candidates';

describe('API Integration Tests', () => {
    let app: any;

    beforeAll(async () => {
        app = Fastify({ logger: false });

        // Register minimal plugins
        await app.register(multipart);
        await app.register(sensible);

        // Register routes
        registerCvRoutes(app);
        registerJobRoutes(app);
        registerCandidateRoutes(app);

        await app.ready();
    });

    afterAll(async () => {
        await app.close();
    });

    it('should have health endpoint', async () => {
        app.get('/health', async () => ({ ok: true }));
        const response = await app.inject({
            method: 'GET',
            url: '/health'
        });

        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body)).toEqual({ ok: true });
    });

    it('should reject CV parse without file', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/cv/parse',
            headers: {
                'content-type': 'application/json'
            },
            body: JSON.stringify({})
        });

        expect(response.statusCode).toBe(400);
    });

    it('should reject candidate import without email', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/candidates/import',
            headers: {
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                name: 'Test User'
            })
        });

        expect(response.statusCode).toBe(400);
    });

    it('should reject job creation without title', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/jobs',
            headers: {
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                description: 'Test job'
            })
        });

        expect(response.statusCode).toBe(400);
    });
});
