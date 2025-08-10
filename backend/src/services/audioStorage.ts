import { getSupabase } from '../lib/supabase';
import { randomUUID } from 'crypto';

export interface AudioFile {
    id: string;
    filename: string;
    url: string;
    signedUrl?: string;
    size: number;
    mimeType: string;
    createdAt: string;
}

const AUDIO_BUCKET = 'audio-files';

export async function uploadAudio(
    buffer: Buffer,
    filename: string,
    mimeType: string,
    folder: 'interviews' | 'questions' | 'temp' = 'temp'
): Promise<AudioFile> {
    const supabase = getSupabase();

    // Generate unique filename
    const fileId = randomUUID();
    const ext = filename.split('.').pop() || 'mp3';
    const storagePath = `${folder}/${fileId}.${ext}`;

    // Upload to Supabase storage
    const { data, error } = await supabase.storage
        .from(AUDIO_BUCKET)
        .upload(storagePath, buffer, {
            contentType: mimeType,
            cacheControl: '3600'
        });

    if (error) {
        throw new Error(`Upload failed: ${error.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
        .from(AUDIO_BUCKET)
        .getPublicUrl(storagePath);

    return {
        id: fileId,
        filename: storagePath,
        url: publicUrl,
        size: buffer.length,
        mimeType,
        createdAt: new Date().toISOString()
    };
}

export async function getSignedAudioUrl(filename: string, expiresIn = 3600): Promise<string> {
    const supabase = getSupabase();

    const { data, error } = await supabase.storage
        .from(AUDIO_BUCKET)
        .createSignedUrl(filename, expiresIn);

    if (error) {
        throw new Error(`Signed URL generation failed: ${error.message}`);
    }

    return data.signedUrl;
}

export async function deleteAudio(filename: string): Promise<void> {
    const supabase = getSupabase();

    const { error } = await supabase.storage
        .from(AUDIO_BUCKET)
        .remove([filename]);

    if (error) {
        throw new Error(`Delete failed: ${error.message}`);
    }
}

export async function listAudioFiles(folder?: string): Promise<AudioFile[]> {
    const supabase = getSupabase();

    const { data, error } = await supabase.storage
        .from(AUDIO_BUCKET)
        .list(folder || '', {
            limit: 100,
            sortBy: { column: 'created_at', order: 'desc' }
        });

    if (error) {
        throw new Error(`List failed: ${error.message}`);
    }

    return data.map(file => ({
        id: file.id || '',
        filename: file.name,
        url: '', // Would need to generate public URL for each
        size: file.metadata?.size || 0,
        mimeType: file.metadata?.mimetype || 'audio/mpeg',
        createdAt: file.created_at || new Date().toISOString()
    }));
}

export async function cleanupTempAudio(olderThanHours = 24): Promise<number> {
    const supabase = getSupabase();
    const cutoffDate = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);

    const { data, error } = await supabase.storage
        .from(AUDIO_BUCKET)
        .list('temp/', {
            limit: 1000,
            sortBy: { column: 'created_at', order: 'asc' }
        });

    if (error) {
        throw new Error(`Cleanup list failed: ${error.message}`);
    }

    const filesToDelete = data
        .filter(file => new Date(file.created_at || '') < cutoffDate)
        .map(file => `temp/${file.name}`);

    if (filesToDelete.length === 0) {
        return 0;
    }

    const { error: deleteError } = await supabase.storage
        .from(AUDIO_BUCKET)
        .remove(filesToDelete);

    if (deleteError) {
        throw new Error(`Cleanup delete failed: ${deleteError.message}`);
    }

    return filesToDelete.length;
}
