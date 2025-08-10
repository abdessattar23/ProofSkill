import { getSupabase } from '../lib/supabase';
import { generateEmbedding } from './embeddings';
import { cacheSet, cacheGet } from '../lib/redis';

// Sample ESCO skills data (in production, this would be imported from ESCO API/dataset)
const ESCO_SKILLS = [
    { id: 'S1.0.0', name: 'javascript', category: 'Programming Language', description: 'Programming language for web development' },
    { id: 'S1.0.1', name: 'typescript', category: 'Programming Language', description: 'Typed superset of JavaScript' },
    { id: 'S1.0.2', name: 'python', category: 'Programming Language', description: 'High-level programming language' },
    { id: 'S1.0.3', name: 'java', category: 'Programming Language', description: 'Object-oriented programming language' },
    { id: 'S1.1.0', name: 'react', category: 'Frontend Framework', description: 'JavaScript library for building user interfaces' },
    { id: 'S1.1.1', name: 'vue', category: 'Frontend Framework', description: 'Progressive JavaScript framework' },
    { id: 'S1.1.2', name: 'angular', category: 'Frontend Framework', description: 'Platform for building mobile and desktop web applications' },
    { id: 'S1.2.0', name: 'node.js', category: 'Backend Framework', description: 'JavaScript runtime built on Chrome V8 engine' },
    { id: 'S1.2.1', name: 'express', category: 'Backend Framework', description: 'Fast, unopinionated web framework for Node.js' },
    { id: 'S1.2.2', name: 'fastify', category: 'Backend Framework', description: 'Fast and low overhead web framework for Node.js' },
    { id: 'S1.3.0', name: 'docker', category: 'DevOps', description: 'Platform for developing, shipping, and running applications' },
    { id: 'S1.3.1', name: 'kubernetes', category: 'DevOps', description: 'Container orchestration system' },
    { id: 'S1.3.2', name: 'aws', category: 'Cloud Platform', description: 'Amazon Web Services cloud platform' },
    { id: 'S1.3.3', name: 'azure', category: 'Cloud Platform', description: 'Microsoft Azure cloud platform' },
    { id: 'S1.4.0', name: 'postgresql', category: 'Database', description: 'Object-relational database system' },
    { id: 'S1.4.1', name: 'mongodb', category: 'Database', description: 'Document-oriented NoSQL database' },
    { id: 'S1.4.2', name: 'redis', category: 'Database', description: 'In-memory data structure store' },
    { id: 'S1.5.0', name: 'machine learning', category: 'AI/ML', description: 'Algorithms that learn from data' },
    { id: 'S1.5.1', name: 'deep learning', category: 'AI/ML', description: 'Neural networks with multiple layers' },
    { id: 'S1.5.2', name: 'pytorch', category: 'ML Framework', description: 'Open source machine learning framework' },
    { id: 'S1.5.3', name: 'tensorflow', category: 'ML Framework', description: 'End-to-end open source machine learning platform' }
];

// Common skill aliases
const SKILL_ALIASES = [
    { skill: 'javascript', aliases: ['js', 'ecmascript', 'es6', 'es2015', 'nodejs'] },
    { skill: 'typescript', aliases: ['ts'] },
    { skill: 'python', aliases: ['py', 'python3'] },
    { skill: 'react', aliases: ['reactjs', 'react.js'] },
    { skill: 'vue', aliases: ['vuejs', 'vue.js'] },
    { skill: 'node.js', aliases: ['nodejs', 'node'] },
    { skill: 'postgresql', aliases: ['postgres', 'psql'] },
    { skill: 'mongodb', aliases: ['mongo'] },
    { skill: 'machine learning', aliases: ['ml', 'ai', 'artificial intelligence'] },
    { skill: 'deep learning', aliases: ['dl', 'neural networks'] },
    { skill: 'amazon web services', aliases: ['aws', 'amazon aws'] },
    { skill: 'microsoft azure', aliases: ['azure'] }
];

export async function seedSkillTaxonomy(): Promise<{ skills: number; aliases: number }> {
    const supabase = getSupabase();

    // Clear existing data
    await supabase.from('skill_aliases').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('skills').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // Insert skills
    const skillsData = ESCO_SKILLS.map(skill => ({
        name: skill.name,
        category: skill.category,
        esco_id: skill.id,
        description: skill.description
    }));

    const { data: insertedSkills, error: skillsError } = await supabase
        .from('skills')
        .insert(skillsData)
        .select('id, name');

    if (skillsError) {
        throw new Error(`Failed to insert skills: ${skillsError.message}`);
    }

    // Create skill name to ID mapping
    const skillMap = new Map(insertedSkills.map(s => [s.name, s.id]));

    // Insert aliases
    const aliasesData: any[] = [];
    SKILL_ALIASES.forEach(({ skill, aliases }) => {
        const skillId = skillMap.get(skill);
        if (skillId) {
            aliases.forEach(alias => {
                aliasesData.push({
                    skill_id: skillId,
                    alias: alias.toLowerCase()
                });
            });
        }
    });

    const { error: aliasesError } = await supabase
        .from('skill_aliases')
        .insert(aliasesData);

    if (aliasesError) {
        throw new Error(`Failed to insert aliases: ${aliasesError.message}`);
    }

    // Generate embeddings for skills
    for (const skill of insertedSkills) {
        try {
            const embedding = await generateEmbedding(skill.name);
            await supabase.from('embeddings').insert({
                owner_type: 'skill',
                owner_id: skill.id,
                content_type: 'skill_name',
                vector: embedding
            });
        } catch (error) {
            console.warn(`Failed to generate embedding for skill ${skill.name}:`, error);
        }
    }

    return {
        skills: insertedSkills.length,
        aliases: aliasesData.length
    };
}

export async function normalizeSkillAdvanced(inputSkill: string): Promise<{
    normalized: string;
    category: string;
    confidence: number;
    alternatives: string[];
}> {
    const cacheKey = `skill:normalize:${inputSkill.toLowerCase()}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return cached as any;

    const supabase = getSupabase();
    const input = inputSkill.toLowerCase().trim();

    // Direct match
    const { data: directMatch } = await supabase
        .from('skills')
        .select('name, category')
        .eq('name', input)
        .limit(1)
        .maybeSingle();

    if (directMatch) {
        const result = {
            normalized: directMatch.name,
            category: directMatch.category,
            confidence: 1.0,
            alternatives: []
        };
        await cacheSet(cacheKey, result, 3600);
        return result;
    }

    // Alias match
    const { data: aliasMatch } = await supabase
        .from('skill_aliases')
        .select('skills!inner(name, category)')
        .eq('alias', input)
        .limit(1)
        .maybeSingle();

    if (aliasMatch) {
        const skill = (aliasMatch as any).skills;
        const result = {
            normalized: skill.name,
            category: skill.category,
            confidence: 0.95,
            alternatives: []
        };
        await cacheSet(cacheKey, result, 3600);
        return result;
    }

    // Fuzzy/embedding match
    try {
        const embedding = await generateEmbedding(input);
        const { data: similarSkills } = await supabase.rpc('match_similar_skills', {
            query_embedding: embedding,
            match_threshold: 0.7,
            match_count: 5
        });

        if (similarSkills && similarSkills.length > 0) {
            const best = similarSkills[0];
            const result = {
                normalized: best.skill_name,
                category: best.category,
                confidence: best.similarity,
                alternatives: similarSkills.slice(1, 3).map((s: any) => s.skill_name)
            };
            await cacheSet(cacheKey, result, 1800);
            return result;
        }
    } catch (error) {
        console.warn('Embedding-based skill matching failed:', error);
    }

    // No match found
    const result = {
        normalized: inputSkill,
        category: 'Other',
        confidence: 0.0,
        alternatives: []
    };
    await cacheSet(cacheKey, result, 900); // Cache misses for shorter time
    return result;
}

export async function getSkillSuggestions(query: string, limit = 10): Promise<string[]> {
    const cacheKey = `skill:suggestions:${query.toLowerCase()}:${limit}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return cached as string[];

    const supabase = getSupabase();
    const input = query.toLowerCase().trim();

    // Get skills starting with query
    const { data: skills } = await supabase
        .from('skills')
        .select('name')
        .ilike('name', `${input}%`)
        .limit(limit);

    // Get aliases starting with query
    const { data: aliases } = await supabase
        .from('skill_aliases')
        .select('alias, skills!inner(name)')
        .ilike('alias', `${input}%`)
        .limit(limit);

    const suggestions = [
        ...(skills || []).map(s => s.name),
        ...(aliases || []).map((a: any) => a.skills.name)
    ];

    const uniqueSuggestions = [...new Set(suggestions)].slice(0, limit);
    await cacheSet(cacheKey, uniqueSuggestions, 1800);

    return uniqueSuggestions;
}
