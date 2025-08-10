import { FastifyInstance } from 'fastify';
import { advancedMatcher } from '../services/advancedMatching';
import { optionalAuth } from '../middleware/auth';

export default async function (fastify: FastifyInstance) {

    // Advanced candidate-job matching
    fastify.post('/matching/candidate-job', {
        preHandler: [optionalAuth],
        schema: {
            tags: ['Matching'],
            summary: 'Match candidate to job with detailed scoring',
            description: 'Get comprehensive matching score between a candidate and job',
            body: {
                type: 'object',
                required: ['candidateId', 'jobId'],
                properties: {
                    candidateId: { type: 'string', format: 'uuid' },
                    jobId: { type: 'string', format: 'uuid' },
                    weights: {
                        type: 'object',
                        properties: {
                            skills: { type: 'number', minimum: 0, maximum: 1, default: 0.5 },
                            location: { type: 'number', minimum: 0, maximum: 1, default: 0.2 },
                            experience: { type: 'number', minimum: 0, maximum: 1, default: 0.2 },
                            salary: { type: 'number', minimum: 0, maximum: 1, default: 0.1 }
                        }
                    }
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
                                candidateId: { type: 'string' },
                                jobId: { type: 'string' },
                                totalScore: { type: 'number' },
                                skillScore: { type: 'number' },
                                locationScore: { type: 'number' },
                                experienceScore: { type: 'number' },
                                salaryScore: { type: 'number' },
                                breakdown: {
                                    type: 'object',
                                    properties: {
                                        matchedSkills: {
                                            type: 'array',
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    skill: { type: 'string' },
                                                    score: { type: 'number' }
                                                }
                                            }
                                        },
                                        locationMatch: { type: 'boolean' },
                                        experienceMatch: { type: 'boolean' },
                                        salaryMatch: { type: 'boolean' }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }, async (request, reply) => {
        const { candidateId, jobId, weights } = request.body as any;

        try {
            const result = await advancedMatcher.matchCandidateToJob(candidateId, jobId, weights);

            reply.send({
                success: true,
                data: result
            });
        } catch (error: any) {
            fastify.log.error('Advanced matching failed:', error);
            reply.status(500).send({
                error: 'Failed to perform advanced matching'
            });
        }
    });

    // Batch matching for multiple candidates and jobs
    fastify.post('/matching/batch', {
        schema: {
            tags: ['Matching'],
            summary: 'Batch match candidates to jobs',
            description: 'Perform matching for multiple candidate-job combinations',
            security: [{ ApiKeyAuth: [] }],
            body: {
                type: 'object',
                required: ['candidateIds', 'jobIds'],
                properties: {
                    candidateIds: {
                        type: 'array',
                        items: { type: 'string', format: 'uuid' },
                        maxItems: 100
                    },
                    jobIds: {
                        type: 'array',
                        items: { type: 'string', format: 'uuid' },
                        maxItems: 50
                    },
                    criteria: {
                        type: 'object',
                        properties: {
                            skills: { type: 'array', items: { type: 'string' } },
                            location: {
                                type: 'object',
                                properties: {
                                    city: { type: 'string' },
                                    region: { type: 'string' },
                                    country: { type: 'string' },
                                    remote: { type: 'boolean' }
                                }
                            },
                            experience: {
                                type: 'object',
                                properties: {
                                    min: { type: 'number' },
                                    max: { type: 'number' }
                                }
                            },
                            salary: {
                                type: 'object',
                                properties: {
                                    min: { type: 'number' },
                                    max: { type: 'number' }
                                }
                            },
                            jobType: { type: 'string' },
                            hybrid: { type: 'boolean' }
                        }
                    },
                    minScore: { type: 'number', minimum: 0, maximum: 1, default: 0.3 },
                    limit: { type: 'number', minimum: 1, maximum: 1000, default: 100 }
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
                                matches: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            candidateId: { type: 'string' },
                                            jobId: { type: 'string' },
                                            totalScore: { type: 'number' },
                                            skillScore: { type: 'number' },
                                            locationScore: { type: 'number' },
                                            experienceScore: { type: 'number' },
                                            salaryScore: { type: 'number' }
                                        }
                                    }
                                },
                                total: { type: 'number' },
                                processed: { type: 'number' }
                            }
                        }
                    }
                }
            }
        }
    }, async (request, reply) => {
        const { candidateIds, jobIds, criteria, minScore = 0.3, limit = 100 } = request.body as any;

        try {
            const allMatches = await advancedMatcher.batchMatch(candidateIds, jobIds, criteria);

            // Filter and limit results
            const filteredMatches = allMatches
                .filter(match => match.totalScore >= minScore)
                .slice(0, limit);

            reply.send({
                success: true,
                data: {
                    matches: filteredMatches,
                    total: filteredMatches.length,
                    processed: candidateIds.length * jobIds.length
                }
            });
        } catch (error: any) {
            fastify.log.error('Batch matching failed:', error);
            reply.status(500).send({
                error: 'Failed to perform batch matching'
            });
        }
    });

    // Skill matching only (for testing/debugging)
    fastify.post('/matching/skills', {
        schema: {
            tags: ['Matching'],
            summary: 'Match skills with semantic similarity',
            description: 'Compare two skill sets using AI embeddings',
            body: {
                type: 'object',
                required: ['candidateSkills', 'jobSkills'],
                properties: {
                    candidateSkills: { type: 'array', items: { type: 'string' } },
                    jobSkills: { type: 'array', items: { type: 'string' } },
                    threshold: { type: 'number', minimum: 0, maximum: 1, default: 0.75 }
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
                                score: { type: 'number' },
                                matches: {
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
            }
        }
    }, async (request, reply) => {
        const { candidateSkills, jobSkills, threshold = 0.75 } = request.body as any;

        try {
            const result = await advancedMatcher.matchBySkills(candidateSkills, jobSkills, threshold);

            reply.send({
                success: true,
                data: result
            });
        } catch (error: any) {
            fastify.log.error('Skill matching failed:', error);
            reply.status(500).send({
                error: 'Failed to perform skill matching'
            });
        }
    });

}
