import { getSupabase } from '../lib/supabase';
import { generateEmbedding } from './embeddings';

export async function normalizeSkill(raw: string): Promise<{ skill: string; skill_id?: string }> {
    const supabase = getSupabase();
    const name = raw.trim().toLowerCase();
    const { data } = await supabase.from('skills').select('id,name').ilike('name', name).limit(1);
    if (data && data.length) return { skill: data[0].name, skill_id: data[0].id };
    // fallback: create new skill
    const { data: inserted } = await supabase.from('skills').insert({ name: raw }).select('id,name');
    return { skill: inserted?.[0].name || raw, skill_id: inserted?.[0].id };
}

export async function bulkNormalize(skills: string[]) {
    return Promise.all(skills.map(normalizeSkill));
}

export async function skillEmbedding(skill: string) {
    return generateEmbedding(skill);
}
