import type { FastifyInstance } from 'fastify';
import { synthesizeQuestion, transcribeAudio, getAvailableVoices } from '../services/audio';
import { uploadAudio, getSignedAudioUrl, deleteAudio, listAudioFiles, cleanupTempAudio } from '../services/audioStorage';
import { z } from 'zod';

export function registerAudioRoutes(app: FastifyInstance) {
    app.post('/api/audio/tts', {
        schema: {
            description: 'Convert text to speech using ElevenLabs TTS',
            body: {
                type: 'object',
                properties: {
                    text: { type: 'string', maxLength: 5000 },
                    voiceId: { type: 'string', description: 'ElevenLabs voice ID' },
                    store: { type: 'boolean', description: 'Whether to store the audio file' }
                },
                required: ['text']
            },
            response: {
                200: {
                    description: 'Audio file (MP3)',
                    type: 'string',
                    format: 'binary'
                }
            },
            tags: ['Audio']
        }
    }, async (req, reply) => {
        const body: any = req.body || {};
        const schema = z.object({
            text: z.string().min(1).max(5000),
            voiceId: z.string().optional(),
            store: z.boolean().optional()
        });
        const { text, voiceId, store } = schema.parse(body);

        try {
            const buf = await synthesizeQuestion(text, voiceId);

            // Store audio file if requested
            if (body.store) {
                const audioFile = await uploadAudio(
                    buf,
                    `tts_${Date.now()}.mp3`,
                    'audio/mpeg',
                    'questions'
                );
                return {
                    success: true,
                    audioFile,
                    message: 'Audio generated and stored'
                };
            }

            reply.header('Content-Type', 'audio/mpeg');
            reply.header('Content-Length', buf.length.toString());
            reply.send(buf);
        } catch (error: any) {
            reply.internalServerError(error.message);
        }
    });

    app.post('/api/audio/stt', {
        schema: {
            description: 'Convert speech to text using ElevenLabs STT',
            consumes: ['multipart/form-data'],
            // Remove body schema for multipart uploads
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        transcript: { type: 'string' }
                    }
                }
            },
            tags: ['Audio']
        }
    }, async (req, reply) => {
        const mp: any = await (req as any).file();
        if (!mp) return reply.badRequest('audio file required');

        const buf = await mp.toBuffer();
        const filename = mp.filename;

        try {
            const transcript = await transcribeAudio(buf, filename);

            // Optionally store the uploaded audio
            if (req.query && (req.query as any).store === 'true') {
                const audioFile = await uploadAudio(
                    buf,
                    filename || 'upload.mp3',
                    'audio/mpeg',
                    'interviews'
                );
                return {
                    success: true,
                    transcript,
                    audioFile,
                    message: 'Audio transcribed and stored'
                };
            }

            return { success: true, transcript };
        } catch (error: any) {
            reply.internalServerError(error.message);
        }
    });

    app.get('/api/audio/files', {
        config: { roles: ['admin', 'recruiter'] },
        schema: {
            description: 'List stored audio files',
            querystring: {
                type: 'object',
                properties: {
                    folder: { type: 'string', enum: ['interviews', 'questions', 'temp'] }
                }
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        files: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    id: { type: 'string' },
                                    filename: { type: 'string' },
                                    size: { type: 'number' },
                                    mimeType: { type: 'string' },
                                    createdAt: { type: 'string' }
                                }
                            }
                        }
                    }
                }
            },
            tags: ['Audio', 'Admin']
        }
    }, async (req, reply) => {
        try {
            const { folder } = req.query as any;
            const files = await listAudioFiles(folder);
            return { success: true, files };
        } catch (error: any) {
            reply.internalServerError(error.message);
        }
    });

    app.get('/api/audio/files/:filename/signed-url', {
        schema: {
            description: 'Get signed URL for audio file access',
            params: {
                type: 'object',
                properties: {
                    filename: { type: 'string' }
                },
                required: ['filename']
            },
            querystring: {
                type: 'object',
                properties: {
                    expiresIn: { type: 'number', default: 3600 }
                }
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        signedUrl: { type: 'string' },
                        expiresAt: { type: 'string' }
                    }
                }
            },
            tags: ['Audio']
        }
    }, async (req, reply) => {
        try {
            const { filename } = req.params as any;
            const { expiresIn = 3600 } = req.query as any;

            const signedUrl = await getSignedAudioUrl(filename, expiresIn);
            const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

            return { success: true, signedUrl, expiresAt };
        } catch (error: any) {
            reply.internalServerError(error.message);
        }
    });

    app.delete('/api/audio/files/:filename', {
        config: { roles: ['admin', 'recruiter'] },
        schema: {
            description: 'Delete an audio file',
            params: {
                type: 'object',
                properties: {
                    filename: { type: 'string' }
                },
                required: ['filename']
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' }
                    }
                }
            },
            tags: ['Audio', 'Admin']
        }
    }, async (req, reply) => {
        try {
            const { filename } = req.params as any;
            await deleteAudio(filename);
            return { success: true, message: 'Audio file deleted' };
        } catch (error: any) {
            reply.internalServerError(error.message);
        }
    });

    app.post('/api/audio/cleanup', {
        config: { roles: ['admin'] },
        schema: {
            description: 'Cleanup old temporary audio files',
            body: {
                type: 'object',
                properties: {
                    olderThanHours: { type: 'number', default: 24 }
                }
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        deletedCount: { type: 'number' }
                    }
                }
            },
            tags: ['Audio', 'Admin']
        }
    }, async (req, reply) => {
        try {
            const { olderThanHours = 24 } = (req.body as any) || {};
            const deletedCount = await cleanupTempAudio(olderThanHours);
            return { success: true, deletedCount };
        } catch (error: any) {
            reply.internalServerError(error.message);
        }
    });

    app.get('/api/audio/voices', {
        schema: {
            description: 'Get available ElevenLabs voices',
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        voices: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    voice_id: { type: 'string' },
                                    name: { type: 'string' },
                                    category: { type: 'string' }
                                }
                            }
                        }
                    }
                }
            },
            tags: ['Audio']
        }
    }, async (req, reply) => {
        try {
            const voices = await getAvailableVoices();
            return { success: true, voices };
        } catch (error: any) {
            reply.internalServerError(error.message);
        }
    });
}
