import { getSupabase } from '../lib/supabase';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const embedModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });

export async function generateEmbedding(text: string): Promise<number[]> {
    const res = await embedModel.embedContent(text);
    return res.embedding.values as number[]; // already float[]
}

export async function generateEmbeddingsBatch(chunks: string[], concurrency = 4): Promise<number[][]> {
    const results: number[][] = new Array(chunks.length);
    let idx = 0;
    async function worker() {
        while (true) {
            const current = idx++;
            if (current >= chunks.length) break;
            results[current] = await retry(async () => generateEmbedding(chunks[current]));
        }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, chunks.length) }, () => worker()));
    return results;
}

async function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }
export async function retry<T>(fn: () => Promise<T>, attempts = 3, baseDelay = 300): Promise<T> {
    let lastErr: any;
    for (let i = 0; i < attempts; i++) {
        try { return await fn(); } catch (e: any) { lastErr = e; await delay(baseDelay * 2 ** i); }
    }
    throw lastErr;
}

export async function storeEmbedding(ownerType: 'candidate' | 'job', ownerId: string, label: string, vector: number[]) {
    const supabase = getSupabase();
    const { error } = await supabase.rpc('insert_embedding', {
        p_owner_type: ownerType,
        p_owner_id: ownerId,
        p_chunk_label: label,
        p_vector: vector
    });
    if (error) throw new Error(error.message);
}

export async function upsertOwnerEmbeddings(ownerType: 'candidate' | 'job', ownerId: string, chunks: { label: string; text: string }[]) {
    const texts = chunks.map(c => c.text);
    const vectors = await generateEmbeddingsBatch(texts);
    for (let i = 0; i < chunks.length; i++) {
        await storeEmbedding(ownerType, ownerId, chunks[i].label, vectors[i]).catch(e => console.error('Embedding store failed', e));
    }
}
