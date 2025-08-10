import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getSupabase } from '../lib/supabase';
import { generateEmbedding, storeEmbedding } from '../services/embeddings';
import { cacheGet, cacheSet } from '../lib/redis';

export function registerJobRoutes(app: FastifyInstance) {
    // List jobs (basic pagination)
    app.get('/api/jobs', {
        schema: {
            description: 'List jobs',
            querystring: {
                type: 'object',
                properties: { page: { type: 'string', default: '1' }, pageSize: { type: 'string', default: '20' } }
            }
        }
    }, async (req, reply) => {
        const { page = '1', pageSize = '20' } = req.query as any;
        const p = Math.max(1, parseInt(page));
        const ps = Math.min(100, Math.max(1, parseInt(pageSize)));
        const supabaseAdmin = getSupabase();
        const { data, error } = await supabaseAdmin.from('jobs').select('id,title,description,region,created_at').order('created_at', { ascending: false }).range((p - 1) * ps, p * ps - 1);
        if (error) return reply.internalServerError(error.message);
        reply.send({ success: true, jobs: data || [], page: p, pageSize: ps });
    });
    app.post('/api/jobs', {
        schema: {
            description: 'Create a new job posting with skills and generate embeddings',
            body: {
                type: 'object',
                properties: {
                    title: { type: 'string', description: 'Job title' },
                    description: { type: 'string', description: 'Job description' },
                    region: { type: 'string', description: 'Job location/region' },
                    skills: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Required skills for the job'
                    }
                },
                required: ['title']
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        id: { type: 'string', description: 'Created job ID' }
                    }
                }
            },
            tags: ['Jobs']
        }
    }, async (req, reply) => {
        const supabaseAdmin = getSupabase();
        const schema = z.object({ title: z.string(), description: z.string().optional(), region: z.string().optional(), skills: z.array(z.string()).optional() });
        const body: any = req.body;
        const d = schema.parse(body);
        const { data, error } = await supabaseAdmin.from('jobs').insert({ title: d.title, description: d.description, region: d.region }).select('id');
        if (error) return reply.internalServerError(error.message);
        const jobId = data![0].id;
        if (d.skills) {
            await supabaseAdmin.from('job_skills').insert(d.skills.map(s => ({ job_id: jobId, skill: s })));
        }
        const emb = await generateEmbedding([d.title, d.description, ...(d.skills || [])].join(' '));
        await storeEmbedding('job', jobId, 'job_full', emb);
        return { success: true, id: jobId };
    });

    app.get('/api/jobs/:id/match', {
        schema: {
            description: 'Find candidates matching a job using vector similarity',
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Job ID to match candidates for' }
                },
                required: ['id']
            },
            querystring: {
                type: 'object',
                properties: {
                    page: { type: 'string', default: '1', description: 'Page number for pagination' },
                    pageSize: { type: 'string', default: '20', description: 'Number of results per page (max 100)' },
                    minSimilarity: { type: 'string', default: '0', description: 'Minimum similarity score (0-1)' }
                }
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        cached: { type: 'boolean' },
                        page: { type: 'number' },
                        pageSize: { type: 'number' },
                        total: { type: 'number' },
                        data: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    candidate_id: { type: 'string' },
                                    similarity: { type: 'number' },
                                    name: { type: 'string' },
                                    email: { type: 'string' }
                                }
                            }
                        }
                    }
                }
            },
            tags: ['Jobs', 'Matching']
        }
    }, async (req, reply) => {
        const supabaseAdmin = getSupabase();
        const { id } = req.params as any;
        const { page = '1', pageSize = '20', minSimilarity = '0' } = req.query as any;
        const p = Math.max(1, parseInt(page));
        const ps = Math.min(100, Math.max(1, parseInt(pageSize)));
        const minSim = Math.max(0, Math.min(1, parseFloat(minSimilarity)));
        const cacheKey = `match:${id}:${p}:${ps}:${minSim}`;
        const cached = await cacheGet<any>(cacheKey);
        if (cached) return { success: true, cached: true, ...cached };
        const { data: jobEmb } = await supabaseAdmin.from('embeddings').select('vector').eq('owner_type', 'job').eq('owner_id', id).limit(1).maybeSingle();
        if (!jobEmb) return reply.notFound('Job embedding missing');
        const { data, error } = await supabaseAdmin.rpc('match_candidates_for_job', { p_job_id: id, p_limit: p * ps });
        if (error) return reply.internalServerError(error.message);
        const filtered = (data || []).filter((r: any) => r.similarity >= minSim);
        const paged = filtered.slice((p - 1) * ps, p * ps);
        const payload = { page: p, pageSize: ps, total: filtered.length, data: paged };
        await cacheSet(cacheKey, payload, 30);
        return { success: true, ...payload };
    });
}
