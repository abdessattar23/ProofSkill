import type { FastifyInstance } from 'fastify';
import { parseCvFile } from '../services/cvParser';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';

const CvResponseSchema = z.object({
    name: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    education: z.array(z.string()).optional(),
    skills: z.array(z.string()).optional(),
    experience: z.array(z.string()).optional(),
    certifications: z.array(z.string()).optional()
});

export function registerCvRoutes(app: FastifyInstance) {
    // Test endpoint for multipart debugging
    app.post('/api/cv/test-upload', {
        preHandler: [requireAuth],
        schema: {
            description: 'Test multipart upload (debugging)',
            consumes: ['multipart/form-data'],
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        fileInfo: { type: 'object' }
                    }
                }
            }
        }
    }, async function (req, reply) {
        try {
            req.log.info('Test upload request received');
            req.log.info(`Content-Type: ${req.headers['content-type']}`);
            req.log.info(`Content-Length: ${req.headers['content-length']}`);

            if (!req.isMultipart()) {
                return reply.badRequest('Request must be multipart/form-data');
            }

            const file = await (req as any).file();
            if (!file) {
                return reply.badRequest('No file received');
            }

            const buffer = await file.toBuffer();

            return {
                success: true,
                message: 'File upload test successful',
                fileInfo: {
                    filename: file.filename,
                    mimetype: file.mimetype,
                    encoding: file.encoding,
                    size: buffer.length
                }
            };
        } catch (error: any) {
            req.log.error(error, 'Test upload failed');
            return reply.internalServerError(`Upload test failed: ${error.message}`);
        }
    });

    app.post('/api/cv/parse', {
        preHandler: [requireAuth],
        schema: {
            description: 'Parse a CV file (PDF/DOCX/TXT) and extract structured information',
            consumes: ['multipart/form-data'],
            // Remove body schema for multipart uploads
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        data: {
                            type: 'object',
                            properties: {
                                name: { type: 'string' },
                                email: { type: 'string', format: 'email' },
                                phone: { type: 'string' },
                                education: { type: 'array', items: { type: 'string' } },
                                skills: { type: 'array', items: { type: 'string' } },
                                experience: { type: 'array', items: { type: 'string' } },
                                certifications: { type: 'array', items: { type: 'string' } }
                            }
                        }
                    }
                },
                400: {
                    type: 'object',
                    properties: {
                        statusCode: { type: 'number' },
                        error: { type: 'string' },
                        message: { type: 'string' }
                    }
                }
            },
            tags: ['CV Processing']
        }
    }, async function (req, reply) {
        try {
            req.log.info('CV parse request received');
            req.log.info(`Content-Type: ${req.headers['content-type']}`);
            req.log.info(`Content-Length: ${req.headers['content-length']}`);

            // Check if this is a multipart request
            if (!req.isMultipart()) {
                req.log.warn('Request is not multipart');
                return reply.badRequest('Request must be multipart/form-data');
            }

            req.log.info('Processing multipart data...');

            // Add timeout and error handling for file processing
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('File processing timeout')), 30000); // 30 second timeout
            });

            const filePromise = (req as any).file();
            const mp: any = await Promise.race([filePromise, timeoutPromise]);

            if (!mp) {
                req.log.warn('No file received in CV parse request');
                return reply.badRequest('File required');
            }

            req.log.info(`Processing CV file: ${mp.filename}, type: ${mp.mimetype}, encoding: ${mp.encoding}`);

            // Use streaming approach for large files
            const chunks: Buffer[] = [];
            const stream = mp.file;

            for await (const chunk of stream) {
                chunks.push(chunk);
            }

            const buf = Buffer.concat(chunks);
            const filename: string = mp.filename;

            req.log.info(`File buffer size: ${buf.length} bytes`);

            if (buf.length === 0) {
                req.log.warn('Empty file received');
                return reply.badRequest('Empty file received');
            }

            // Validate file type
            const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'text/plain'];
            if (!allowedTypes.includes(mp.mimetype)) {
                req.log.warn(`Unsupported file type: ${mp.mimetype}`);
                return reply.badRequest('Unsupported file type. Please upload PDF, DOCX, DOC, or TXT files.');
            }

            const parsed = await parseCvFile(buf, filename);
            const validated = CvResponseSchema.parse(parsed);

            req.log.info('CV parsing completed successfully');
            return { success: true, data: validated };
        } catch (e: any) {
            req.log.error(e, 'CV parse failed');

            // More specific error handling
            if (e.code === 'FST_REQ_BODY_SIZE_MISMATCH') {
                return reply.badRequest('Request body size mismatch. Please try uploading a smaller file or check your network connection.');
            }

            if (e.message === 'File processing timeout') {
                return reply.requestTimeout('File processing timeout. Please try uploading a smaller file.');
            }

            if (e.code === 'FST_FILES_LIMIT') {
                return reply.badRequest('Too many files. Please upload only one file at a time.');
            }

            if (e.code === 'FST_FILE_TOO_LARGE') {
                return reply.badRequest('File too large. Maximum size is 8MB.');
            }

            return reply.internalServerError(e.message || 'CV parsing failed');
        }
    });
}
