import { FastifyRequest, FastifyReply } from 'fastify';
import { recordHttpMetrics } from '../lib/metrics';

export async function metricsMiddleware(request: FastifyRequest, reply: FastifyReply) {
    const startTime = Date.now();

    // Hook to record metrics after response is sent
    reply.hijack();

    const originalSend = reply.send;
    reply.send = function (payload?: any) {
        const duration = (Date.now() - startTime) / 1000;
        const route = request.routerPath || request.url;

        recordHttpMetrics(
            request.method,
            route,
            reply.statusCode,
            duration
        );

        return originalSend.call(this, payload);
    };
}
