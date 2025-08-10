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

    // Get jobs for authenticated business user
    app.get('/api/jobs/my-jobs', {
        schema: {
            description: 'Get jobs posted by the authenticated business user',
            querystring: {
                type: 'object',
                properties: { page: { type: 'string', default: '1' }, pageSize: { type: 'string', default: '20' } }
            }
        }
    }, async (req, reply) => {
        const user = (req as any).user; // Set by global JWT middleware
        if (!user || user.role !== 'business') {
            return reply.code(403).send({ error: 'Access denied. Business role required.' });
        }

        const { page = '1', pageSize = '20' } = req.query as any;
        const p = Math.max(1, parseInt(page));
        const ps = Math.min(100, Math.max(1, parseInt(pageSize)));

        const supabaseAdmin = getSupabase();
        const { data, error } = await supabaseAdmin
            .from('jobs')
            .select(`
                id,title,description,region,created_at,status,created_by,
                job_applications(count)
            `)
            .eq('created_by', user.sub)
            .order('created_at', { ascending: false })
            .range((p - 1) * ps, p * ps - 1);

        if (error) return reply.internalServerError(error.message);
        
        // Transform the data to include applications_count
        const jobsWithCounts = (data || []).map(job => ({
            ...job,
            applications_count: job.job_applications?.length || 0
        }));
        
        reply.send({ success: true, jobs: jobsWithCounts, page: p, pageSize: ps });
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
        const user = (req as any).user; // Set by global JWT middleware
        if (!user || user.role !== 'business') {
            return reply.code(403).send({ error: 'Access denied. Business role required.' });
        }

        const supabaseAdmin = getSupabase();
        const schema = z.object({
            title: z.string(),
            description: z.string().optional(),
            region: z.string().optional(),
            skills: z.array(z.string()).optional(),
            salary_range: z.string().optional(),
            experience_level: z.string().optional(),
            job_type: z.string().optional()
        });
        const body: any = req.body;
        const d = schema.parse(body);

        const { data, error } = await supabaseAdmin.from('jobs').insert({
            title: d.title,
            description: d.description,
            region: d.region,
            salary_range: d.salary_range,
            experience_level: d.experience_level,
            job_type: d.job_type,
            created_by: user.sub,
            status: 'active'
        }).select('id');

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

    // Get single job by ID
    app.get('/api/jobs/:id', {
        schema: {
            description: 'Get a single job by ID',
            params: {
                type: 'object',
                properties: { id: { type: 'string' } },
                required: ['id']
            }
        }
    }, async (req, reply) => {
        const { id } = req.params as any;
        const supabaseAdmin = getSupabase();

        const { data, error } = await supabaseAdmin
            .from('jobs')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !data) return reply.notFound('Job not found');

        // Get job skills
        const { data: skills } = await supabaseAdmin
            .from('job_skills')
            .select('skill')
            .eq('job_id', id);

        const job = {
            ...data,
            skills: skills?.map(s => s.skill) || []
        };

        reply.send(job);
    });

    // Delete job (business owner only)
    app.delete('/api/jobs/:id', {
        schema: {
            description: 'Delete a job posting',
            params: {
                type: 'object',
                properties: { id: { type: 'string' } },
                required: ['id']
            }
        }
    }, async (req, reply) => {
        const user = (req as any).user;
        const { id } = req.params as any;

        if (!user || user.role !== 'business') {
            return reply.code(403).send({ error: 'Access denied' });
        }

        const supabaseAdmin = getSupabase();

        // Verify job ownership
        const { data: job } = await supabaseAdmin
            .from('jobs')
            .select('created_by')
            .eq('id', id)
            .single();

        if (!job || job.created_by !== user.sub) {
            return reply.code(403).send({ error: 'Access denied' });
        }

        // Delete job skills first (foreign key constraint)
        await supabaseAdmin.from('job_skills').delete().eq('job_id', id);

        // Delete job
        const { error } = await supabaseAdmin.from('jobs').delete().eq('id', id);

        if (error) return reply.internalServerError(error.message);

        reply.send({ success: true });
    });

    // Apply to job (candidates only)
    app.post('/api/jobs/:id/apply', {
        schema: {
            description: 'Apply to a job posting',
            params: {
                type: 'object',
                properties: { id: { type: 'string' } },
                required: ['id']
            }
        }
    }, async (req, reply) => {
        const user = (req as any).user;
        const { id } = req.params as any;

        if (!user || user.role !== 'candidate') {
            return reply.code(403).send({ error: 'Access denied. Candidate role required.' });
        }

        const supabaseAdmin = getSupabase();

        // Ensure candidate record exists
        const { data: candidate, error: candidateError } = await supabaseAdmin
            .from('candidates')
            .select('id')
            .eq('id', user.sub)
            .single();

        if (candidateError && candidateError.code === 'PGRST116') {
            // Candidate doesn't exist, create one
            const { error: createError } = await supabaseAdmin
                .from('candidates')
                .insert({
                    id: user.sub,
                    name: user.name || user.email,
                    email: user.email,
                    created_at: new Date().toISOString()
                });

            if (createError) {
                return reply.internalServerError(`Failed to create candidate profile: ${createError.message}`);
            }
        } else if (candidateError) {
            return reply.internalServerError(`Database error: ${candidateError.message}`);
        }

        // Check if already applied
        const { data: existing } = await supabaseAdmin
            .from('job_applications')
            .select('id')
            .eq('job_id', id)
            .eq('candidate_id', user.sub)
            .single();

        if (existing) {
            return reply.code(409).send({ error: 'Already applied to this job' });
        }

        // Create application
        const { error } = await supabaseAdmin
            .from('job_applications')
            .insert({
                job_id: id,
                candidate_id: user.sub,
                status: 'pending',
                applied_at: new Date().toISOString()
            });

        if (error) return reply.internalServerError(error.message);

        // Generate basic embedding for candidate if they don't have one
        try {
            const { data: existingEmbedding } = await supabaseAdmin
                .from('embeddings')
                .select('id')
                .eq('owner_type', 'candidate')
                .eq('owner_id', user.sub)
                .limit(1)
                .maybeSingle();

            if (!existingEmbedding) {
                // Get candidate's CV text or basic info
                const { data: candidateData } = await supabaseAdmin
                    .from('candidates')
                    .select('raw_cv_text, name, email')
                    .eq('id', user.sub)
                    .single();

                if (candidateData) {
                    // Create embedding from available candidate information
                    const embeddingText = [
                        candidateData.name || '',
                        candidateData.email || '',
                        candidateData.raw_cv_text || 'No CV uploaded yet'
                    ].filter(Boolean).join(' ');

                    const embedding = await generateEmbedding(embeddingText);
                    await storeEmbedding('candidate', user.sub, 'basic_profile', embedding);
                }
            }
        } catch (embError) {
            // Log error but don't fail the application
            console.warn('Failed to generate candidate embedding:', embError);
        }

        reply.send({ success: true });
    });

    // Get job applications (for businesses to see who applied)
    app.get('/api/jobs/:id/applications', {
        schema: {
            description: 'Get applications for a specific job',
            tags: ['Jobs'],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Job ID' }
                },
                required: ['id']
            },
            querystring: {
                type: 'object',
                properties: {
                    page: { type: 'string', description: 'Page number' },
                    pageSize: { type: 'string', description: 'Items per page' },
                    status: { type: 'string', description: 'Filter by application status' }
                }
            }
        }
    }, async (req, reply) => {
        const user = (req as any).user;
        if (!user || user.role !== 'business') {
            return reply.code(403).send({ error: 'Access denied. Business role required.' });
        }

        const { id: jobId } = req.params as { id: string };
        const { page = '1', pageSize = '20', status } = req.query as any;
        const p = Math.max(1, parseInt(page));
        const ps = Math.min(100, Math.max(1, parseInt(pageSize)));

        const supabaseAdmin = getSupabase();

        // Verify job ownership
        const { data: job, error: jobError } = await supabaseAdmin
            .from('jobs')
            .select('id')
            .eq('id', jobId)
            .eq('created_by', user.sub)
            .single();

        if (jobError || !job) {
            return reply.code(404).send({ error: 'Job not found or access denied' });
        }

        // Build query
        let query = supabaseAdmin
            .from('job_applications')
            .select(`
                id,
                status,
                applied_at,
                notes,
                candidates!inner(id, name, email, phone)
            `)
            .eq('job_id', jobId)
            .order('applied_at', { ascending: false })
            .range((p - 1) * ps, p * ps - 1);

        if (status) {
            query = query.eq('status', status);
        }

        const { data, error } = await query;

        if (error) return reply.internalServerError(error.message);
        reply.send({
            success: true,
            applications: data || [],
            page: p,
            pageSize: ps
        });
    });

    // Get job matches (AI-powered matching results)
    app.get('/api/jobs/:id/matches', {
        schema: {
            description: 'Get AI-powered candidate matches for a job',
            tags: ['Jobs'],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Job ID' }
                },
                required: ['id']
            },
            querystring: {
                type: 'object',
                properties: {
                    minSimilarity: { type: 'string', description: 'Minimum similarity score (0-1)' },
                    page: { type: 'string', description: 'Page number' },
                    pageSize: { type: 'string', description: 'Items per page' }
                }
            }
        }
    }, async (req, reply) => {
        const user = (req as any).user;
        if (!user || user.role !== 'business') {
            return reply.code(403).send({ error: 'Access denied. Business role required.' });
        }

        const { id: jobId } = req.params as { id: string };
        const { minSimilarity = '0.3', page = '1', pageSize = '20' } = req.query as any;
        const p = Math.max(1, parseInt(page));
        const ps = Math.min(100, Math.max(1, parseInt(pageSize)));
        const minSim = Math.max(0, Math.min(1, parseFloat(minSimilarity)));

        const supabaseAdmin = getSupabase();

        // Verify job ownership
        const { data: job, error: jobError } = await supabaseAdmin
            .from('jobs')
            .select('id')
            .eq('id', jobId)
            .eq('created_by', user.sub)
            .single();

        if (jobError || !job) {
            return reply.code(404).send({ error: 'Job not found or access denied' });
        }

        // Get matches using the existing RPC function
        const { data, error } = await supabaseAdmin
            .rpc('match_candidates_for_job', {
                p_job_id: jobId,
                p_limit: ps
            });

        if (error) return reply.internalServerError(error.message);

        // Filter by minimum similarity and add pagination
        const filteredData = (data || [])
            .filter((match: any) => match.similarity >= minSim)
            .slice((p - 1) * ps, p * ps);

        reply.send({
            success: true,
            matches: filteredData,
            page: p,
            pageSize: ps,
            minSimilarity: minSim
        });
    });

    // Update application status (for businesses)
    app.patch('/api/jobs/:jobId/applications/:applicationId', {
        schema: {
            description: 'Update application status',
            tags: ['Jobs'],
            params: {
                type: 'object',
                properties: {
                    jobId: { type: 'string', description: 'Job ID' },
                    applicationId: { type: 'string', description: 'Application ID' }
                },
                required: ['jobId', 'applicationId']
            },
            body: {
                type: 'object',
                properties: {
                    status: {
                        type: 'string',
                        enum: ['pending', 'reviewed', 'accepted', 'rejected'],
                        description: 'New application status'
                    },
                    notes: { type: 'string', description: 'Optional notes' }
                },
                required: ['status']
            }
        }
    }, async (req, reply) => {
        const user = (req as any).user;
        if (!user || user.role !== 'business') {
            return reply.code(403).send({ error: 'Access denied. Business role required.' });
        }

        const { jobId, applicationId } = req.params as { jobId: string; applicationId: string };
        const { status, notes } = req.body as { status: string; notes?: string };

        const supabaseAdmin = getSupabase();

        // Verify job ownership
        const { data: job, error: jobError } = await supabaseAdmin
            .from('jobs')
            .select('id')
            .eq('id', jobId)
            .eq('created_by', user.sub)
            .single();

        if (jobError || !job) {
            return reply.code(404).send({ error: 'Job not found or access denied' });
        }

        // Update application
        const updateData: any = {
            status,
            reviewed_at: new Date().toISOString()
        };
        if (notes !== undefined) updateData.notes = notes;

        const { error } = await supabaseAdmin
            .from('job_applications')
            .update(updateData)
            .eq('id', applicationId)
            .eq('job_id', jobId);

        if (error) return reply.internalServerError(error.message);
        reply.send({ success: true, message: 'Application status updated' });
    });

    // Get candidate's applications
    app.get('/api/my-applications', {
        schema: {
            description: 'Get current user applications',
            tags: ['Jobs'],
            querystring: {
                type: 'object',
                properties: {
                    page: { type: 'string', description: 'Page number' },
                    pageSize: { type: 'string', description: 'Items per page' },
                    status: { type: 'string', description: 'Filter by status' }
                }
            }
        }
    }, async (req, reply) => {
        const user = (req as any).user;
        if (!user || user.role !== 'candidate') {
            return reply.code(403).send({ error: 'Access denied. Candidate role required.' });
        }

        const { page = '1', pageSize = '20', status } = req.query as any;
        const p = Math.max(1, parseInt(page));
        const ps = Math.min(100, Math.max(1, parseInt(pageSize)));

        const supabaseAdmin = getSupabase();

        // Build query
        let query = supabaseAdmin
            .from('job_applications')
            .select(`
                id,
                status,
                applied_at,
                jobs!inner(id, title, description, region, created_at)
            `)
            .eq('candidate_id', user.sub)
            .order('applied_at', { ascending: false })
            .range((p - 1) * ps, p * ps - 1);

        if (status) {
            query = query.eq('status', status);
        }

        const { data, error } = await query;

        if (error) return reply.internalServerError(error.message);
        reply.send({
            success: true,
            applications: data || [],
            page: p,
            pageSize: ps
        });
    });
}
