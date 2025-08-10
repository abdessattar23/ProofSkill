import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { authService } from '../services/authService';

export function registerAuthRoutes(app: FastifyInstance) {
    app.post('/api/auth/register', {
        schema: {
            body: {
                type: 'object',
                properties: {
                    email: { type: 'string' },
                    name: { type: 'string' },
                    password: { type: 'string' },
                    role: { type: 'string' }
                },
                required: ['email', 'password']
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        id: { type: 'string' }
                    }
                }
            }
        }
    }, async (req, reply) => {
        const body: any = req.body;
        const schema = z.object({
            email: z.string().email(),
            name: z.string().min(2).max(80).optional(),
            password: z.string().min(6),
            role: z.string().default('user')
        });

        try {
            const { email, password, role, name } = schema.parse(body);

            const result = await authService.createUser({ email, password, role, name });

            if (!result.success) {
                if (result.error === 'User already exists') {
                    return reply.conflict(result.error);
                }
                return reply.internalServerError(result.error || 'Failed to create user');
            }

            return { success: true, id: result.user!.id };
        } catch (error) {
            if (error instanceof z.ZodError) {
                return reply.badRequest('Invalid input data');
            }
            return reply.internalServerError('Internal server error');
        }
    });

    app.post('/api/auth/login', {
        schema: {
            body: {
                type: 'object',
                properties: {
                    email: { type: 'string' },
                    password: { type: 'string' }
                },
                required: ['email', 'password']
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        token: { type: 'string' },
                        user: {
                            type: 'object',
                            properties: {
                                id: { type: 'string' },
                                email: { type: 'string' },
                                name: { type: 'string' },
                                role: { type: 'string' },
                                first_time: { type: 'boolean' }
                            }
                        }
                    }
                }
            }
        }
    }, async (req, reply) => {
        if (!process.env.JWT_SECRET) {
            return reply.internalServerError('JWT disabled');
        }

        const body: any = req.body;
        const schema = z.object({
            email: z.string().email(),
            password: z.string()
        });

        try {
            const { email, password } = schema.parse(body);

            const result = await authService.authenticateUser({ email, password });

            if (!result.success) {
                return reply.unauthorized(result.error || 'Invalid credentials');
            }

            const user = result.user!;
            const token = (app as any).jwt.sign({
                sub: user.id,
                email: user.email,
                role: user.role
            });

            return { success: true, token, user: { id: user.id, email: user.email, name: user.name, role: user.role, first_time: user.first_time } };
        } catch (error) {
            if (error instanceof z.ZodError) {
                return reply.badRequest('Invalid input data');
            }
            return reply.internalServerError('Internal server error');
        }
    });

    app.get('/api/auth/me', {
        preHandler: [requireAuth],
        schema: {
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        user: {
                            type: 'object',
                            properties: {
                                id: { type: 'string' },
                                email: { type: 'string' },
                                name: { type: 'string' },
                                role: { type: 'string' },
                                first_time: { type: 'boolean' },
                                profile: {
                                    type: 'object',
                                    properties: {
                                        id: { type: 'string' },
                                        name: { type: 'string' },
                                        email: { type: 'string' },
                                        phone: { type: 'string' },
                                        skills: { type: 'array', items: { type: 'string' } },
                                        experience: { type: 'array', items: { type: 'string' } },
                                        raw_cv_text: { type: 'string' },
                                        parsed_data: { type: 'object' },
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
                    }
                }
            }
        }
    }, async (req, reply) => {
        const authUser = (req as any).authUser;

        // Get full user data with profile
        const result = await authService.getUserById(authUser.id);

        if (!result.success || !result.user) {
            return reply.internalServerError('Failed to fetch user data');
        }

        const user = result.user;

        return {
            success: true,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                first_time: user.first_time,
                profile: user.profile
            }
        };
    });

    // Mark profile as complete (for first-time flow)
    app.post('/api/auth/profile-complete', {
        preHandler: [requireAuth],
        schema: {
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' }
                    }
                }
            }
        }
    }, async (req, reply) => {
        const authUser = (req as any).authUser;

        // Mark profile as complete in database
        const result = await authService.markProfileComplete(authUser.id);

        if (!result.success) {
            return reply.internalServerError(result.error || 'Failed to mark profile complete');
        }

        return { success: true };
    });
}
