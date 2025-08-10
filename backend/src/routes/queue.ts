import type { FastifyInstance } from 'fastify';
import { getDLQJobs, replayDLQJob } from '../lib/queue';
import { getSupabase } from '../lib/supabase';

export function registerQueueRoutes(app: FastifyInstance) {
    app.get('/api/queue/dlq', {
        config: { roles: ['admin'] },
        schema: {
            description: 'Get dead letter queue jobs (admin only)',
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        jobs: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    id: { type: 'string' },
                                    type: { type: 'string' },
                                    payload: { type: 'object' },
                                    attempts: { type: 'number' },
                                    error: { type: 'string' },
                                    created: { type: 'number' }
                                }
                            }
                        }
                    }
                }
            },
            tags: ['Queue', 'Admin']
        }
    }, async (req, reply) => {
        const jobs = await getDLQJobs();
        return { success: true, jobs };
    });

    app.post('/api/queue/dlq/:jobId/replay', {
        config: { roles: ['admin'] },
        schema: {
            description: 'Replay a failed job from the dead letter queue (admin only)',
            params: {
                type: 'object',
                properties: {
                    jobId: { type: 'string' }
                },
                required: ['jobId']
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        replayed: { type: 'boolean' }
                    }
                }
            },
            tags: ['Queue', 'Admin']
        }
    }, async (req, reply) => {
        const { jobId } = req.params as any;
        const replayed = await replayDLQJob(jobId);
        return { success: true, replayed };
    });

    app.get('/api/queue/stats', {
        config: { roles: ['admin'] },
        schema: {
            description: 'Get queue statistics (admin only)',
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        stats: {
                            type: 'object',
                            properties: {
                                queued: { type: 'number' },
                                running: { type: 'number' },
                                succeeded: { type: 'number' },
                                failed: { type: 'number' },
                                retry: { type: 'number' }
                            }
                        }
                    }
                }
            },
            tags: ['Queue', 'Admin']
        }
    }, async (req, reply) => {
        const supabase = getSupabase();
        const { data } = await supabase
            .from('job_status')
            .select('status')
            .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Last 24h

        const stats = (data || []).reduce((acc: any, row: any) => {
            acc[row.status] = (acc[row.status] || 0) + 1;
            return acc;
        }, {});

        return { success: true, stats };
    });
}
