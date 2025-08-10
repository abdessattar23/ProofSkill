import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
// import swagger from '@fastify/swagger';
// import swaggerUI from '@fastify/swagger-ui';
import jwt from '@fastify/jwt';
import { registerV1Routes } from './routes';
import dotenv from 'dotenv';
import { z } from 'zod';
import crypto from 'node:crypto';

dotenv.config();

// Env validation
const EnvSchema = z.object({
    PORT: z.string().optional(),
    SUPABASE_URL: z.string().url().optional(),
    SUPABASE_SERVICE_KEY: z.string().optional(),
    GEMINI_API_KEY: z.string().min(10),
    ELEVENLABS_API_KEY: z.string().min(10).optional(),
    JWT_SECRET: z.string().min(16).optional(),
    ADMIN_BOOTSTRAP_KEY: z.string().optional()
});
EnvSchema.parse(process.env);

const app = Fastify({
    logger: {
        level: process.env.LOG_LEVEL || 'info',
        transport: process.env.NODE_ENV === 'production' ? undefined : { target: 'pino-pretty' }
    }
});

await app.register(cors, { origin: true });
await app.register(sensible);
await app.register(multipart, {
    limits: {
        fileSize: 8 * 1024 * 1024,  // 8MB
        files: 1,                   // Only allow 1 file
        fieldSize: 1000000,         // 1MB for text fields
        headerPairs: 200            // Increase header pairs limit
    },
    attachFieldsToBody: false,      // Don't attach fields to body
    sharedSchemaId: 'multipart'     // Use shared schema
});
await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
// await app.register(swagger, { openapi: { info: { title: 'ProofSkill API', version: '0.1.0' } } });
// await app.register(swaggerUI, { routePrefix: '/docs', staticCSP: true });
if (process.env.JWT_SECRET) {
    await app.register(jwt, { secret: process.env.JWT_SECRET });
}
// Basic request id
app.addHook('onRequest', async (req) => {
    (req as any).id = crypto.randomUUID();
});

// Legacy path rewrite (avoid 301 redirect issues for POST from some clients)
app.addHook('onRequest', async (req) => {
    if (req.url.startsWith('/api/auth/')) {
        const newUrl = req.url.replace('/api/auth/', '/v1/api/auth/');
        (req as any).raw.url = newUrl; // mutate raw Node req to adjust routing
    }
});

// Global JWT auth (no API key). Allowlist public routes.
app.addHook('preHandler', async (req, reply) => {
    const path = req.routerPath || req.url; // fallback
    const publicPaths = [
        '/healthz',
        '/v1/api/auth/login',
        '/v1/api/auth/register',
        '/api/auth/login', // legacy redirect race
        '/api/auth/register',
        '/docs',
        '/openapi.json'
    ];
    if (publicPaths.some(p => path.startsWith(p))) return;

    if (process.env.JWT_SECRET) {
        try {
            const decoded = await (req as any).jwtVerify();
            (req as any).user = decoded;
        } catch {
            return reply.code(401).send({ error: 'unauthorized' });
        }
    } else {
        return reply.code(500).send({ error: 'JWT not configured' });
    }

    const requiredRoles: string[] | undefined = (req.routeOptions as any)?.config?.roles;
    if (requiredRoles && requiredRoles.length) {
        const role = (req as any).user?.role;
        if (!role || !requiredRoles.includes(role)) {
            return reply.code(403).send({ error: 'forbidden' });
        }
    }
});

registerV1Routes(app);

// Legacy auth endpoints (non-versioned) for backward compatibility / tooling hitting /api/auth/*
import { authService } from './services/authService';
app.post('/api/auth/register', async (req, reply) => {
    const body: any = req.body;
    const schema = z.object({ email: z.string().email(), name: z.string().min(2).max(80).optional(), password: z.string().min(6), role: z.string().default('user') });
    try {
        const { email, password, role, name } = schema.parse(body);
        const result = await authService.createUser({ email, password, role, name });
        if (!result.success) {
            if (result.error === 'User already exists') return reply.conflict(result.error);
            return reply.internalServerError(result.error || 'Failed to create user');
        }
        return { success: true, id: result.user!.id };
    } catch (e) {
        if (e instanceof z.ZodError) return reply.badRequest('Invalid input data');
        return reply.internalServerError('Internal server error');
    }
});

app.post('/api/auth/login', async (req, reply) => {
    if (!process.env.JWT_SECRET) return reply.internalServerError('JWT disabled');
    const body: any = req.body;
    const schema = z.object({ email: z.string().email(), password: z.string() });
    try {
        const { email, password } = schema.parse(body);
        const result = await authService.authenticateUser({ email, password });
        if (!result.success) return reply.unauthorized(result.error || 'Invalid credentials');
        const user = result.user!;
        const token = (app as any).jwt.sign({ sub: user.id, email: user.email, role: user.role });
        return { success: true, token, user: { id: user.id, email: user.email, name: (user as any).name, role: user.role } };
    } catch (e) {
        if (e instanceof z.ZodError) return reply.badRequest('Invalid input data');
        return reply.internalServerError('Internal server error');
    }
});

const port = Number(process.env.PORT) || 4000;

// Graceful shutdown
const signals = ['SIGINT', 'SIGTERM'];
signals.forEach((signal) => {
    process.on(signal, async () => {
        app.log.info(`Received ${signal}, starting graceful shutdown...`);

        try {
            await app.close();
            app.log.info('Server closed successfully');
            process.exit(0);
        } catch (err) {
            app.log.error(err, 'Error during shutdown');
            process.exit(1);
        }
    });
});

try {
    await app.listen({ port, host: '0.0.0.0' });
    app.ready(err => {
        if (!err) {
            // app.log.info('Registered routes:\n' + app.printRoutes());
        }
    });
    app.log.info(`Server listening on ${port}`);
} catch (err) {
    app.log.error(err);
    process.exit(1);
}
