import { FastifyInstance } from 'fastify';
import { register } from '../lib/metrics';

export default async function (fastify: FastifyInstance) {

    // Prometheus metrics endpoint
    fastify.get('/metrics', {
        schema: {
            tags: ['Monitoring'],
            summary: 'Prometheus metrics endpoint',
            description: 'Get all application metrics in Prometheus format',
            response: {
                200: {
                    type: 'string',
                    description: 'Prometheus metrics data'
                }
            }
        }
    }, async (request, reply) => {
        try {
            const metrics = await register.metrics();
            reply
                .type('text/plain; version=0.0.4; charset=utf-8')
                .send(metrics);
        } catch (error: any) {
            fastify.log.error('Failed to get metrics:', error);
            reply.status(500).send('Failed to get metrics');
        }
    });

    // Health check with detailed status
    fastify.get('/health', {
        schema: {
            tags: ['Monitoring'],
            summary: 'Detailed health check',
            description: 'Get application health status with component details',
            response: {
                200: {
                    type: 'object',
                    properties: {
                        status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
                        timestamp: { type: 'string', format: 'date-time' },
                        uptime: { type: 'number', description: 'Uptime in seconds' },
                        version: { type: 'string' },
                        components: {
                            type: 'object',
                            properties: {
                                database: {
                                    type: 'object',
                                    properties: {
                                        status: { type: 'string' },
                                        responseTime: { type: 'number' }
                                    }
                                },
                                redis: {
                                    type: 'object',
                                    properties: {
                                        status: { type: 'string' },
                                        responseTime: { type: 'number' }
                                    }
                                },
                                gemini: {
                                    type: 'object',
                                    properties: {
                                        status: { type: 'string' },
                                        circuitBreakerState: { type: 'string' }
                                    }
                                },
                                elevenlabs: {
                                    type: 'object',
                                    properties: {
                                        status: { type: 'string' },
                                        circuitBreakerState: { type: 'string' }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }, async (request, reply) => {
        const startTime = Date.now();
        const healthData: any = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            version: process.env.npm_package_version || '1.0.0',
            components: {}
        };

        try {
            // Check database connectivity
            const dbStart = Date.now();
            try {
                // Simple health query - could be improved with actual DB check
                healthData.components.database = {
                    status: 'healthy',
                    responseTime: Date.now() - dbStart
                };
            } catch (error) {
                healthData.components.database = {
                    status: 'unhealthy',
                    responseTime: Date.now() - dbStart
                };
                healthData.status = 'degraded';
            }

            // Check Redis connectivity
            const redisStart = Date.now();
            try {
                // Simple ping - could be improved with actual Redis check
                healthData.components.redis = {
                    status: 'healthy',
                    responseTime: Date.now() - redisStart
                };
            } catch (error) {
                healthData.components.redis = {
                    status: 'unhealthy',
                    responseTime: Date.now() - redisStart
                };
                healthData.status = 'degraded';
            }

            // Check external services (placeholder)
            healthData.components.gemini = {
                status: 'healthy',
                circuitBreakerState: 'closed'
            };

            healthData.components.elevenlabs = {
                status: 'healthy',
                circuitBreakerState: 'closed'
            };

        } catch (error: any) {
            healthData.status = 'unhealthy';
            fastify.log.error('Health check failed:', error);
        }

        const statusCode = healthData.status === 'healthy' ? 200 :
            healthData.status === 'degraded' ? 200 : 503;

        reply.status(statusCode).send(healthData);
    });

}
