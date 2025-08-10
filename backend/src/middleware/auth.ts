import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { authService } from '../services/authService';

interface AuthenticatedRequest extends FastifyRequest {
    authUser?: {
        id: string;
        email: string;
        role: string;
    };
}

// JWT authentication middleware
export async function requireAuth(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
        const token = request.headers.authorization?.replace('Bearer ', '');

        if (!token) {
            return reply.status(401).send({ error: 'Authentication token required' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

        // The JWT contains { sub: userId, email, role }
        const userId = decoded.sub;

        if (!userId) {
            return reply.status(401).send({ error: 'Invalid token structure' });
        }

        // Get fresh user data from database
        const result = await authService.getUserById(userId);

        if (!result.success || !result.user) {
            return reply.status(401).send({ error: 'Invalid token - user not found' });
        }

        request.authUser = {
            id: result.user.id,
            email: result.user.email,
            role: result.user.role
        };
    } catch (error) {
        return reply.status(401).send({ error: 'Invalid token' });
    }
}

// Role-based authorization
export function requireRole(roles: string[]) {
    return async function (request: AuthenticatedRequest, reply: FastifyReply) {
        if (!request.authUser) {
            return reply.status(401).send({ error: 'Authentication required' });
        }

        if (!roles.includes(request.authUser.role)) {
            return reply.status(403).send({ error: 'Insufficient permissions' });
        }
    };
}

// Optional authentication (doesn't fail if no token)
export async function optionalAuth(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
        const token = request.headers.authorization?.replace('Bearer ', '');

        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

            const result = await authService.getUserById(decoded.sub);

            if (result.success && result.user) {
                request.authUser = {
                    id: result.user.id,
                    email: result.user.email,
                    role: result.user.role
                };
            }
        }
        // Continue regardless of authentication status
    } catch (error) {
        // Ignore authentication errors for optional auth
    }
}
