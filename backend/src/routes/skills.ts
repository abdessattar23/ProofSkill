import { FastifyInstance } from 'fastify';
import { seedSkillTaxonomy, normalizeSkillAdvanced, getSkillSuggestions } from '../services/skillTaxonomy';


export default async function (fastify: FastifyInstance) {

    // Admin endpoint to seed skill taxonomy data
    fastify.post('/taxonomy/seed', {
        schema: {
            tags: ['Skills'],
            summary: 'Seed skill taxonomy database',
            description: 'Populate the skills and skill_aliases tables with ESCO/O*NET data',
            security: [{ ApiKeyAuth: [] }],
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        data: {
                            type: 'object',
                            properties: {
                                skills: { type: 'number', description: 'Number of skills inserted' },
                                aliases: { type: 'number', description: 'Number of aliases inserted' }
                            }
                        }
                    }
                },
                500: {
                    type: 'object',
                    properties: {
                        error: { type: 'string' }
                    }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const result = await seedSkillTaxonomy();

            reply.send({
                success: true,
                data: result
            });
        } catch (error: any) {
            fastify.log.error('Skill taxonomy seeding failed:', error);
            reply.status(500).send({
                error: 'Failed to seed skill taxonomy'
            });
        }
    });

    // Normalize skill name using taxonomy
    fastify.post('/skills/normalize', {
        schema: {
            tags: ['Skills'],
            summary: 'Normalize skill name',
            description: 'Get normalized skill name, category, and confidence score',
            body: {
                type: 'object',
                required: ['skill'],
                properties: {
                    skill: { type: 'string', description: 'Raw skill name to normalize' }
                }
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        data: {
                            type: 'object',
                            properties: {
                                normalized: { type: 'string', description: 'Normalized skill name' },
                                category: { type: 'string', description: 'Skill category' },
                                confidence: { type: 'number', description: 'Confidence score (0-1)' },
                                alternatives: {
                                    type: 'array',
                                    items: { type: 'string' },
                                    description: 'Alternative skill matches'
                                }
                            }
                        }
                    }
                }
            }
        }
    }, async (request, reply) => {
        const { skill } = request.body as { skill: string };

        try {
            const result = await normalizeSkillAdvanced(skill);

            reply.send({
                success: true,
                data: result
            });
        } catch (error: any) {
            fastify.log.error('Skill normalization failed:', error);
            reply.status(500).send({
                error: 'Failed to normalize skill'
            });
        }
    });

    // Get skill suggestions/autocomplete
    fastify.get('/skills/suggestions', {
        schema: {
            tags: ['Skills'],
            summary: 'Get skill suggestions',
            description: 'Get autocomplete suggestions for skill names',
            querystring: {
                type: 'object',
                required: ['q'],
                properties: {
                    q: { type: 'string', description: 'Query string for autocomplete' },
                    limit: { type: 'number', default: 10, description: 'Maximum number of suggestions' }
                }
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        data: {
                            type: 'object',
                            properties: {
                                suggestions: {
                                    type: 'array',
                                    items: { type: 'string' },
                                    description: 'Skill name suggestions'
                                }
                            }
                        }
                    }
                }
            }
        }
    }, async (request, reply) => {
        const { q, limit = 10 } = request.query as { q: string; limit?: number };

        try {
            const suggestions = await getSkillSuggestions(q, limit);

            reply.send({
                success: true,
                data: {
                    suggestions
                }
            });
        } catch (error: any) {
            fastify.log.error('Skill suggestions failed:', error);
            reply.status(500).send({
                error: 'Failed to get skill suggestions'
            });
        }
    });

}
