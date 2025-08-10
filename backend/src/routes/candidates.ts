import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getSupabase } from '../lib/supabase';
import { classifySkills } from '../services/cvParser';
import { generateEmbedding, storeEmbedding } from '../services/embeddings';

export function registerCandidateRoutes(app: FastifyInstance) {
    // Import a parsed CV JSON and persist candidate (upsert by email)
    app.post('/api/candidates/import', {
        schema: {
            description: 'Import a parsed CV JSON and create/update candidate profile',
            body: {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    email: { type: 'string', format: 'email' },
                    phone: { type: 'string' },
                    education: { type: 'array', items: { type: 'string' } },
                    skills: { type: 'array', items: { type: 'string' } },
                    experience: { type: 'array', items: { type: 'string' } },
                    certifications: { type: 'array', items: { type: 'string' } },
                    raw_cv_text: { type: 'string' }
                },
                required: ['email']
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        id: { type: 'string' },
                        classified_skills: { type: 'array', items: { type: 'object' } }
                    }
                }
            },
            tags: ['Candidates']
        }
    }, async (req, reply) => {
        const schema = z.object({
            name: z.string().optional(),
            email: z.string().email(),
            phone: z.string().optional(),
            education: z.array(z.string()).optional(),
            skills: z.array(z.string()).optional(),
            experience: z.array(z.string()).optional(),
            certifications: z.array(z.string()).optional(),
            raw_cv_text: z.string().optional()
        });
        const body: any = req.body;
        const data = schema.parse(body);
        const supabaseAdmin = getSupabase();
        const { data: upserted, error } = await supabaseAdmin.from('candidates')
            .upsert({
                name: data.name,
                email: data.email,
                phone: data.phone,
                raw_cv_text: data.raw_cv_text || '',
            }, { onConflict: 'email' })
            .select('id');
        if (error) return reply.internalServerError(error.message);
        const candidateId = upserted![0].id;
        const classified = classifySkills(data.skills || []);
        return { success: true, id: candidateId, classified_skills: classified };
    });

    // Store validated skills (overwrite existing) and create embedding
    app.post('/api/candidates/:id/validated-skills', {
        schema: {
            description: 'Store validated skills with scores and generate embeddings',
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Candidate ID' }
                },
                required: ['id']
            },
            body: {
                type: 'object',
                properties: {
                    skills: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                skill: { type: 'string' },
                                score: { type: 'number', minimum: 0, maximum: 10 }
                            },
                            required: ['skill', 'score']
                        }
                    },
                    threshold: { type: 'number', minimum: 0, maximum: 10, default: 7 }
                },
                required: ['skills']
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        saved: { type: 'number' }
                    }
                }
            },
            tags: ['Candidates']
        }
    }, async (req, reply) => {
        const { id } = req.params as any;
        const schema = z.object({ skills: z.array(z.object({ skill: z.string(), score: z.number() })), threshold: z.number().min(0).max(10).default(7) });
        const body: any = req.body;
        const { skills, threshold } = schema.parse(body);
        const filtered = skills.filter(s => s.score >= threshold);
        // delete existing
        const supabaseAdmin = getSupabase();
        await supabaseAdmin.from('candidate_skills').delete().eq('candidate_id', id);
        if (filtered.length) {
            await supabaseAdmin.from('candidate_skills').insert(filtered.map(s => ({ candidate_id: id, skill: s.skill, score: s.score })));
            const emb = await generateEmbedding(filtered.map(s => `${s.skill}:${s.score}`).join(' '));
            await storeEmbedding('candidate', id, 'validated_skills', emb).catch(() => { });
        }
        return { success: true, saved: filtered.length };
    });

    app.get('/api/candidates/:id', {
        schema: {
            description: 'Get candidate profile with validated skills',
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Candidate ID' }
                },
                required: ['id']
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        data: {
                            type: 'object',
                            properties: {
                                id: { type: 'string' },
                                name: { type: 'string' },
                                email: { type: 'string' },
                                phone: { type: 'string' },
                                raw_cv_text: { type: 'string' },
                                validated_skills: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            skill: { type: 'string' },
                                            score: { type: 'number' }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            tags: ['Candidates']
        }
    }, async (req, reply) => {
        const { id } = req.params as any;
        const supabaseAdmin = getSupabase();
        const { data: candidate, error } = await supabaseAdmin.from('candidates').select('*').eq('id', id).maybeSingle();
        if (error) return reply.internalServerError(error.message);
        if (!candidate) return reply.notFound('Candidate not found');
        const { data: skills } = await supabaseAdmin.from('candidate_skills').select('skill,score').eq('candidate_id', id);
        return { success: true, data: { ...candidate, validated_skills: skills || [] } };
    });
}
