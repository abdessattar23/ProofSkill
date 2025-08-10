import { describe, it, expect } from 'vitest';
import { generateEmbeddingsBatch } from '../src/services/embeddings';

describe('embeddings batch', () => {
    it('generates vectors with consistent length', async () => {
        const inputs = ['python skill', 'ml engineer', 'deep learning'];
        const vecs = await generateEmbeddingsBatch(inputs, 2);
        expect(vecs.length).toBe(3);
        const len = vecs[0].length;
        expect(len).toBeGreaterThan(0);
        vecs.forEach(v => expect(v.length).toBe(len));
    });
});
