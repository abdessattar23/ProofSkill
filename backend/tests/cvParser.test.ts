import { describe, it, expect } from 'vitest';
import { classifySkills } from '../src/services/cvParser';

describe('CV Parser', () => {
    it('should classify skills correctly', () => {
        const skills = ['JavaScript', 'Node.js', 'React', 'Docker', 'AWS'];
        const classified = classifySkills(skills);

        expect(Array.isArray(classified)).toBe(true);
        expect(classified.length).toBe(skills.length);

        classified.forEach(skill => {
            expect(skill).toHaveProperty('skill');
            expect(skill).toHaveProperty('category');
            expect(typeof skill.skill).toBe('string');
            expect(typeof skill.category).toBe('string');
        });
    });

    it('should handle empty skills array', () => {
        const classified = classifySkills([]);
        expect(classified).toEqual([]);
    });

    it('should classify known skills with correct categories', () => {
        const skills = ['python', 'docker', 'pytorch'];
        const classified = classifySkills(skills);

        const pythonSkill = classified.find(s => s.skill === 'python');
        const dockerSkill = classified.find(s => s.skill === 'docker');
        const pytorchSkill = classified.find(s => s.skill === 'pytorch');

        expect(pythonSkill?.category).toBe('Programming Language');
        expect(dockerSkill?.category).toBe('DevOps');
        expect(pytorchSkill?.category).toBe('Deep Learning Framework');
    });

    it('should handle duplicate skills', () => {
        const skills = ['JavaScript', 'JavaScript', 'React'];
        const classified = classifySkills(skills);
        expect(classified.length).toBe(3); // Should preserve duplicates
    });
});
