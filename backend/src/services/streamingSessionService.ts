import { getSupabase } from '../lib/supabase';
import { EventEmitter } from 'events';

export interface StreamingSession {
    id: string;
    candidate_id: string;
    status: 'active' | 'completed' | 'cancelled';
    metadata: any;
    created_at: string;
    last_activity: string;
}

export interface CreateStreamingSessionData {
    candidateId: string;
    metadata?: any;
}

class StreamingSessionService extends EventEmitter {
    private supabase = getSupabase();
    private cleanupInterval: NodeJS.Timeout;

    constructor() {
        super();
        // Cleanup inactive sessions every 5 minutes
        this.cleanupInterval = setInterval(() => {
            this.cleanupInactiveSessions();
        }, 5 * 60 * 1000);
    }

    // Create a new streaming session
    async createSession(data: CreateStreamingSessionData): Promise<string> {
        try {
            const sessionId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            const { error } = await this.supabase
                .from('streaming_sessions')
                .insert({
                    id: sessionId,
                    candidate_id: data.candidateId,
                    status: 'active',
                    metadata: data.metadata || {},
                    created_at: new Date().toISOString(),
                    last_activity: new Date().toISOString()
                });

            if (error) {
                console.error('Error creating streaming session:', error);
                throw new Error(`Failed to create streaming session: ${error.message}`);
            }

            this.emit('sessionCreated', { sessionId, candidateId: data.candidateId });
            return sessionId;
        } catch (error) {
            console.error('Streaming session creation failed:', error);
            throw error;
        }
    }

    // Get session by ID
    async getSession(sessionId: string): Promise<StreamingSession | null> {
        try {
            const { data, error } = await this.supabase
                .from('streaming_sessions')
                .select('*')
                .eq('id', sessionId)
                .single();

            if (error) {
                if (error.code === 'PGRST116') { // Not found
                    return null;
                }
                console.error('Error fetching streaming session:', error);
                throw new Error(`Failed to fetch streaming session: ${error.message}`);
            }

            return data;
        } catch (error) {
            console.error('Error getting streaming session:', error);
            throw error;
        }
    }

    // Update session activity
    async updateActivity(sessionId: string): Promise<void> {
        try {
            const { error } = await this.supabase
                .from('streaming_sessions')
                .update({
                    last_activity: new Date().toISOString()
                })
                .eq('id', sessionId);

            if (error) {
                console.error('Error updating session activity:', error);
                throw new Error(`Failed to update session activity: ${error.message}`);
            }
        } catch (error) {
            console.error('Error updating session activity:', error);
            throw error;
        }
    }

    // Update session status
    async updateStatus(sessionId: string, status: 'active' | 'completed' | 'cancelled'): Promise<void> {
        try {
            const { error } = await this.supabase
                .from('streaming_sessions')
                .update({
                    status,
                    last_activity: new Date().toISOString()
                })
                .eq('id', sessionId);

            if (error) {
                console.error('Error updating session status:', error);
                throw new Error(`Failed to update session status: ${error.message}`);
            }

            this.emit('statusUpdated', { sessionId, status });
        } catch (error) {
            console.error('Error updating session status:', error);
            throw error;
        }
    }

    // Update session metadata
    async updateMetadata(sessionId: string, metadata: any): Promise<void> {
        try {
            const session = await this.getSession(sessionId);
            if (!session) {
                throw new Error('Session not found');
            }

            const updatedMetadata = { ...session.metadata, ...metadata };

            const { error } = await this.supabase
                .from('streaming_sessions')
                .update({
                    metadata: updatedMetadata,
                    last_activity: new Date().toISOString()
                })
                .eq('id', sessionId);

            if (error) {
                console.error('Error updating session metadata:', error);
                throw new Error(`Failed to update session metadata: ${error.message}`);
            }
        } catch (error) {
            console.error('Error updating session metadata:', error);
            throw error;
        }
    }

    // Get all active sessions
    async getActiveSessions(): Promise<StreamingSession[]> {
        try {
            const { data, error } = await this.supabase
                .from('streaming_sessions')
                .select('*')
                .eq('status', 'active')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching active sessions:', error);
                throw new Error(`Failed to fetch active sessions: ${error.message}`);
            }

            return data || [];
        } catch (error) {
            console.error('Error getting active sessions:', error);
            throw error;
        }
    }

    // Get sessions by candidate
    async getSessionsByCandidate(candidateId: string): Promise<StreamingSession[]> {
        try {
            const { data, error } = await this.supabase
                .from('streaming_sessions')
                .select('*')
                .eq('candidate_id', candidateId)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching candidate sessions:', error);
                throw new Error(`Failed to fetch candidate sessions: ${error.message}`);
            }

            return data || [];
        } catch (error) {
            console.error('Error getting candidate sessions:', error);
            throw error;
        }
    }

    // Delete session
    async deleteSession(sessionId: string): Promise<void> {
        try {
            const { error } = await this.supabase
                .from('streaming_sessions')
                .delete()
                .eq('id', sessionId);

            if (error) {
                console.error('Error deleting streaming session:', error);
                throw new Error(`Failed to delete streaming session: ${error.message}`);
            }

            this.emit('sessionDeleted', { sessionId });
        } catch (error) {
            console.error('Error deleting streaming session:', error);
            throw error;
        }
    }

    // Cleanup inactive sessions (older than 2 hours)
    private async cleanupInactiveSessions(): Promise<void> {
        try {
            const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

            const { data, error } = await this.supabase
                .from('streaming_sessions')
                .delete()
                .lt('last_activity', twoHoursAgo)
                .eq('status', 'active')
                .select('id');

            if (error) {
                console.error('Error cleaning up inactive sessions:', error);
                return;
            }

            if (data && data.length > 0) {
                console.log(`Cleaned up ${data.length} inactive streaming sessions`);
                data.forEach(session => {
                    this.emit('sessionCleaned', { sessionId: session.id });
                });
            }
        } catch (error) {
            console.error('Error during session cleanup:', error);
        }
    }

    // Check if session exists and is active
    async isSessionActive(sessionId: string): Promise<boolean> {
        try {
            const session = await this.getSession(sessionId);
            return session !== null && session.status === 'active';
        } catch (error) {
            console.error('Error checking session status:', error);
            return false;
        }
    }

    // Cleanup on service shutdown
    destroy(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.removeAllListeners();
    }
}

export const streamingSessionService = new StreamingSessionService();
