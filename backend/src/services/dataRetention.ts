import { getSupabase } from '../lib/supabase';
import { deleteAudio } from './audioStorage';

interface CleanupConfig {
    audioFiles: {
        tempFileAge: number; // days
        completedSessionAge: number; // days
    };
    logs: {
        maxAge: number; // days
        keepCriticalLogs: boolean;
    };
    embeddings: {
        orphanedAge: number; // days
    };
    queue: {
        completedJobAge: number; // days
        failedJobAge: number; // days
    };
}

const DEFAULT_CLEANUP_CONFIG: CleanupConfig = {
    audioFiles: {
        tempFileAge: 1, // 1 day
        completedSessionAge: 30, // 30 days
    },
    logs: {
        maxAge: 90, // 90 days
        keepCriticalLogs: true,
    },
    embeddings: {
        orphanedAge: 7, // 7 days
    },
    queue: {
        completedJobAge: 7, // 7 days
        failedJobAge: 30, // 30 days
    }
};

export class DataRetentionManager {
    private config: CleanupConfig;

    constructor(config: CleanupConfig = DEFAULT_CLEANUP_CONFIG) {
        this.config = config;
    }

    // Clean up temporary audio files
    async cleanupTempAudioFiles(): Promise<{ deleted: number; errors: string[] }> {
        const supabase = getSupabase();
        const errors: string[] = [];
        let deleted = 0;

        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - this.config.audioFiles.tempFileAge);

            // Find temporary audio files older than cutoff
            const { data: tempFiles, error } = await supabase
                .from('audio_files')
                .select('id, file_path, storage_path')
                .eq('is_temporary', true)
                .lt('created_at', cutoffDate.toISOString());

            if (error) {
                errors.push(`Failed to query temp files: ${error.message}`);
                return { deleted, errors };
            }

            if (!tempFiles || tempFiles.length === 0) {
                return { deleted, errors };
            }

            // Delete files from storage and database
            for (const file of tempFiles) {
                try {
                    // Delete from Supabase storage
                    if (file.storage_path) {
                        await deleteAudio(file.storage_path);
                    }

                    // Delete database record
                    const { error: deleteError } = await supabase
                        .from('audio_files')
                        .delete()
                        .eq('id', file.id);

                    if (deleteError) {
                        errors.push(`Failed to delete file record ${file.id}: ${deleteError.message}`);
                    } else {
                        deleted++;
                    }
                } catch (error: any) {
                    errors.push(`Failed to delete file ${file.id}: ${error.message}`);
                }
            }

        } catch (error: any) {
            errors.push(`Cleanup failed: ${error.message}`);
        }

        return { deleted, errors };
    }

    // Clean up old completed interview sessions
    async cleanupCompletedSessions(): Promise<{ deleted: number; errors: string[] }> {
        const supabase = getSupabase();
        const errors: string[] = [];
        let deleted = 0;

        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - this.config.audioFiles.completedSessionAge);

            // Find completed sessions older than cutoff
            const { data: sessions, error } = await supabase
                .from('interview_sessions')
                .select('id')
                .eq('status', 'completed')
                .lt('created_at', cutoffDate.toISOString());

            if (error) {
                errors.push(`Failed to query completed sessions: ${error.message}`);
                return { deleted, errors };
            }

            if (!sessions || sessions.length === 0) {
                return { deleted, errors };
            }

            // Delete sessions and related data
            for (const session of sessions) {
                try {
                    // Get question IDs first
                    const { data: questions } = await supabase
                        .from('interview_questions')
                        .select('id')
                        .eq('session_id', session.id);

                    if (questions && questions.length > 0) {
                        const questionIds = questions.map(q => q.id);

                        // Delete answers first (foreign key constraint)
                        await supabase
                            .from('interview_answers')
                            .delete()
                            .in('question_id', questionIds);
                    }

                    // Delete questions
                    await supabase
                        .from('interview_questions')
                        .delete()
                        .eq('session_id', session.id);

                    // Delete session
                    const { error: deleteError } = await supabase
                        .from('interview_sessions')
                        .delete()
                        .eq('id', session.id);

                    if (deleteError) {
                        errors.push(`Failed to delete session ${session.id}: ${deleteError.message}`);
                    } else {
                        deleted++;
                    }
                } catch (error: any) {
                    errors.push(`Failed to delete session ${session.id}: ${error.message}`);
                }
            }

        } catch (error: any) {
            errors.push(`Session cleanup failed: ${error.message}`);
        }

        return { deleted, errors };
    }

    // Clean up orphaned embeddings
    async cleanupOrphanedEmbeddings(): Promise<{ deleted: number; errors: string[] }> {
        const supabase = getSupabase();
        const errors: string[] = [];
        let deleted = 0;

        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - this.config.embeddings.orphanedAge);

            // Find embeddings with no corresponding owner
            const { data: orphanedEmbeddings, error } = await supabase
                .from('embeddings')
                .select('id, owner_type, owner_id')
                .lt('created_at', cutoffDate.toISOString());

            if (error) {
                errors.push(`Failed to query embeddings: ${error.message}`);
                return { deleted, errors };
            }

            if (!orphanedEmbeddings || orphanedEmbeddings.length === 0) {
                return { deleted, errors };
            }

            // Check which embeddings are truly orphaned
            for (const embedding of orphanedEmbeddings) {
                try {
                    let isOrphaned = false;

                    switch (embedding.owner_type) {
                        case 'candidate':
                            const { data: candidate } = await supabase
                                .from('candidates')
                                .select('id')
                                .eq('id', embedding.owner_id)
                                .single();
                            isOrphaned = !candidate;
                            break;

                        case 'job':
                            const { data: job } = await supabase
                                .from('jobs')
                                .select('id')
                                .eq('id', embedding.owner_id)
                                .single();
                            isOrphaned = !job;
                            break;

                        case 'skill':
                            const { data: skill } = await supabase
                                .from('skills')
                                .select('id')
                                .eq('id', embedding.owner_id)
                                .single();
                            isOrphaned = !skill;
                            break;
                    }

                    if (isOrphaned) {
                        const { error: deleteError } = await supabase
                            .from('embeddings')
                            .delete()
                            .eq('id', embedding.id);

                        if (deleteError) {
                            errors.push(`Failed to delete embedding ${embedding.id}: ${deleteError.message}`);
                        } else {
                            deleted++;
                        }
                    }
                } catch (error: any) {
                    errors.push(`Failed to check embedding ${embedding.id}: ${error.message}`);
                }
            }

        } catch (error: any) {
            errors.push(`Embedding cleanup failed: ${error.message}`);
        }

        return { deleted, errors };
    }

    // Clean up old queue jobs
    async cleanupQueueJobs(): Promise<{ deleted: number; errors: string[] }> {
        const supabase = getSupabase();
        const errors: string[] = [];
        let deleted = 0;

        try {
            const completedCutoff = new Date();
            completedCutoff.setDate(completedCutoff.getDate() - this.config.queue.completedJobAge);

            const failedCutoff = new Date();
            failedCutoff.setDate(failedCutoff.getDate() - this.config.queue.failedJobAge);

            // Delete old completed jobs
            const { error: completedError } = await supabase
                .from('job_status')
                .delete()
                .eq('status', 'completed')
                .lt('finished_at', completedCutoff.toISOString());

            if (completedError) {
                errors.push(`Failed to delete completed jobs: ${completedError.message}`);
            }

            // Delete old failed jobs
            const { error: failedError } = await supabase
                .from('job_status')
                .delete()
                .eq('status', 'failed')
                .lt('finished_at', failedCutoff.toISOString());

            if (failedError) {
                errors.push(`Failed to delete failed jobs: ${failedError.message}`);
            }

            // Get count of deleted jobs (approximate)
            deleted = 1; // Placeholder since we can't get exact count from delete operation

        } catch (error: any) {
            errors.push(`Queue cleanup failed: ${error.message}`);
        }

        return { deleted, errors };
    }

    // Clean up application logs
    async cleanupLogs(): Promise<{ deleted: number; errors: string[] }> {
        const supabase = getSupabase();
        const errors: string[] = [];
        let deleted = 0;

        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - this.config.logs.maxAge);

            let query = supabase
                .from('application_logs')
                .delete()
                .lt('created_at', cutoffDate.toISOString());

            // Keep critical logs if configured
            if (this.config.logs.keepCriticalLogs) {
                query = query.not('level', 'in', '("error","fatal")');
            }

            const { error } = await query;

            if (error) {
                errors.push(`Failed to delete logs: ${error.message}`);
            } else {
                deleted = 1; // Placeholder
            }

        } catch (error: any) {
            errors.push(`Log cleanup failed: ${error.message}`);
        }

        return { deleted, errors };
    }

    // Run all cleanup tasks
    async runFullCleanup(): Promise<{
        audioFiles: { deleted: number; errors: string[] };
        sessions: { deleted: number; errors: string[] };
        embeddings: { deleted: number; errors: string[] };
        queueJobs: { deleted: number; errors: string[] };
        logs: { deleted: number; errors: string[] };
    }> {
        console.log('Starting full data retention cleanup...');

        const results = {
            audioFiles: await this.cleanupTempAudioFiles(),
            sessions: await this.cleanupCompletedSessions(),
            embeddings: await this.cleanupOrphanedEmbeddings(),
            queueJobs: await this.cleanupQueueJobs(),
            logs: await this.cleanupLogs(),
        };

        console.log('Cleanup completed:', {
            audioFiles: results.audioFiles.deleted,
            sessions: results.sessions.deleted,
            embeddings: results.embeddings.deleted,
            queueJobs: results.queueJobs.deleted,
            logs: results.logs.deleted,
        });

        return results;
    }

    // Get cleanup statistics
    async getCleanupStats(): Promise<{
        tempAudioFiles: number;
        oldSessions: number;
        orphanedEmbeddings: number;
        oldQueueJobs: number;
        oldLogs: number;
    }> {
        const supabase = getSupabase();

        const tempAudioCutoff = new Date();
        tempAudioCutoff.setDate(tempAudioCutoff.getDate() - this.config.audioFiles.tempFileAge);

        const sessionCutoff = new Date();
        sessionCutoff.setDate(sessionCutoff.getDate() - this.config.audioFiles.completedSessionAge);

        const embeddingCutoff = new Date();
        embeddingCutoff.setDate(embeddingCutoff.getDate() - this.config.embeddings.orphanedAge);

        const queueCutoff = new Date();
        queueCutoff.setDate(queueCutoff.getDate() - this.config.queue.completedJobAge);

        const logCutoff = new Date();
        logCutoff.setDate(logCutoff.getDate() - this.config.logs.maxAge);

        try {
            const [
                { count: tempAudioFiles },
                { count: oldSessions },
                { count: orphanedEmbeddings },
                { count: oldQueueJobs },
                { count: oldLogs }
            ] = await Promise.all([
                supabase.from('audio_files').select('*', { count: 'exact', head: true }).eq('is_temporary', true).lt('created_at', tempAudioCutoff.toISOString()),
                supabase.from('interview_sessions').select('*', { count: 'exact', head: true }).eq('status', 'completed').lt('created_at', sessionCutoff.toISOString()),
                supabase.from('embeddings').select('*', { count: 'exact', head: true }).lt('created_at', embeddingCutoff.toISOString()),
                supabase.from('job_status').select('*', { count: 'exact', head: true }).eq('status', 'completed').lt('finished_at', queueCutoff.toISOString()),
                supabase.from('application_logs').select('*', { count: 'exact', head: true }).lt('created_at', logCutoff.toISOString())
            ]);

            return {
                tempAudioFiles: tempAudioFiles || 0,
                oldSessions: oldSessions || 0,
                orphanedEmbeddings: orphanedEmbeddings || 0,
                oldQueueJobs: oldQueueJobs || 0,
                oldLogs: oldLogs || 0,
            };
        } catch (error) {
            console.error('Failed to get cleanup stats:', error);
            return {
                tempAudioFiles: 0,
                oldSessions: 0,
                orphanedEmbeddings: 0,
                oldQueueJobs: 0,
                oldLogs: 0,
            };
        }
    }
}

export const dataRetentionManager = new DataRetentionManager();
