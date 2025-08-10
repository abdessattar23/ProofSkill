import pdfParse from 'pdf-parse';
import path from 'node:path';
import mammoth from 'mammoth';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Lazy initialization of Gemini client
function getGeminiClient() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY environment variable is not set');
    }

    console.log('Initializing Gemini client with API key prefix:', apiKey.substring(0, 12) + '...');
    console.log('API key length:', apiKey.length);
    console.log('API key starts with AIza:', apiKey.startsWith('AIza'));

    const genAI = new GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
}

async function extractText(buffer: Buffer, filename: string): Promise<string> {
    const ext = path.extname(filename).toLowerCase();
    if (ext === '.pdf') {
        const data = await pdfParse(buffer);
        return data.text;
    }
    if (ext === '.docx') {
        const { value } = await mammoth.extractRawText({ buffer });
        return value;
    }
    return buffer.toString('utf8');
}

export interface ParsedCvRaw {
    name?: string; email?: string; phone?: string;
    education?: string[]; skills?: string[]; experience?: string[]; certifications?: string[];
}

export async function parseCvFile(buffer: Buffer, filename: string): Promise<ParsedCvRaw> {
    const rawText = await extractText(buffer, filename);
    console.log('Extracted text length:', rawText.length);

    // Simple text parsing fallback
    const result: ParsedCvRaw = {
        name: extractName(rawText),
        email: extractEmail(rawText),
        phone: extractPhone(rawText),
        skills: extractSkills(rawText),
        experience: extractExperience(rawText),
        education: extractEducation(rawText),
        certifications: extractCertifications(rawText)
    };

    console.log('Simple parser extracted skills:', result.skills?.length || 0);

    // Try Gemini AI if available
    const geminiApiKey = process.env.GEMINI_API_KEY;
    console.log('Gemini API Key available:', !!geminiApiKey);
    console.log('Gemini API Key length:', geminiApiKey?.length || 0);

    if (geminiApiKey && geminiApiKey.length > 20) {
        try {
            console.log('Attempting Gemini AI parsing...');

            // Initialize Gemini client
            const model = getGeminiClient();

            const prompt = `Extract candidate information from this resume and return as JSON with these exact keys: name, email, phone, education (string[]), skills (string[]), experience (string[]), certifications (string[]).

For skills, extract ALL technical skills mentioned including:
- Programming languages (JavaScript, TypeScript, Python, etc.)
- Frameworks and libraries (React, Node.js, Express, etc.)  
- Databases (MongoDB, PostgreSQL, Redis, etc.)
- Tools and platforms (Git, Docker, Webpack, etc.)
- Cloud services (AWS, Azure, etc.)
- Concepts and methodologies (OOP, REST API, etc.)

Return ONLY the JSON object, no markdown formatting.

RESUME:
${rawText}`;

            const geminiResult = await model.generateContent(prompt);
            const text = geminiResult.response.text();
            console.log('Gemini response length:', text.length);
            console.log('Gemini response preview:', text.slice(0, 200));

            const start = text.indexOf('{');
            const end = text.lastIndexOf('}') + 1;
            if (start >= 0 && end > start) {
                const jsonStr = text.slice(start, end);
                const parsed: ParsedCvRaw = JSON.parse(jsonStr);
                console.log('Parsed with Gemini - skills found:', parsed.skills?.length || 0);
                console.log('Gemini skills preview:', parsed.skills?.slice(0, 5));
                return parsed;
            } else {
                console.warn('No valid JSON found in Gemini response');
            }
        } catch (e: any) {
            console.error('Gemini parsing failed, using fallback:', e.message);
            console.error('Error details:', {
                status: e.status,
                statusText: e.statusText,
                errorDetails: e.errorDetails
            });
        }
    } else {
        console.log('Gemini API not available, using simple parser');
    }

    console.log('Using simple parser result - skills:', result.skills?.length || 0);
    return result;
}

// Simple text parsing functions
function extractName(text: string): string | undefined {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    return lines[0] || undefined;
}

function extractEmail(text: string): string | undefined {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
    const match = text.match(emailRegex);
    return match ? match[0] : undefined;
}

function extractPhone(text: string): string | undefined {
    const phoneRegex = /[\+]?[1-9]?[\-\.\s]?\(?[0-9]{3}\)?[\-\.\s]?[0-9]{3}[\-\.\s]?[0-9]{4}/;
    const match = text.match(phoneRegex);
    return match ? match[0] : undefined;
}

function extractSkills(text: string): string[] {
    // First try to extract from dedicated skills sections
    const skillsSection = extractSection(text, ['SKILLS', 'TECHNICAL SKILLS', 'TECHNOLOGIES', 'TECHNICAL']);

    // Expanded skill list covering more technologies
    const commonSkills = [
        // Programming Languages
        'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'PHP', 'Ruby', 'Go', 'Rust', 'Swift', 'Kotlin',
        // Web Technologies  
        'HTML', 'CSS', 'React', 'React.js', 'Vue.js', 'Angular', 'Node.js', 'Express.js', 'Next.js', 'Nuxt.js',
        'TailwindCSS', 'Bootstrap', 'SCSS', 'SASS', 'jQuery', 'Svelte', 'SvelteKit',
        // Backend & APIs
        'Express', 'Flask', 'Django', 'Spring', 'ASP.NET', 'Rails', 'FastAPI', 'GraphQL', 'REST', 'RESTful API',
        // Databases
        'MongoDB', 'PostgreSQL', 'MySQL', 'SQLite', 'Redis', 'Elasticsearch', 'DynamoDB', 'Cassandra',
        // Cloud & DevOps
        'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Jenkins', 'CI/CD', 'GitHub Actions', 'GitLab CI',
        // Tools & Platforms
        'Git', 'GitHub', 'GitLab', 'Postman', 'Webpack', 'Vite', 'WebSocket', 'Socket.io',
        // Concepts & Methodologies
        'OOP', 'SOLID', 'Clean Code', 'SDLC', 'Agile', 'Scrum', 'TDD', 'Microservices'
    ];

    const foundSkills: string[] = [];
    const textToSearch = skillsSection || text;

    // Search for exact matches and common variations
    commonSkills.forEach(skill => {
        const skillVariations = [
            skill,
            skill.replace('.js', ''),
            skill.replace('.', ''),
            skill.toLowerCase(),
            skill.toUpperCase()
        ];

        const found = skillVariations.some(variation => {
            const regex = new RegExp(`\\b${variation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
            return regex.test(textToSearch);
        });

        if (found && !foundSkills.includes(skill)) {
            foundSkills.push(skill);
        }
    });

    // Also extract skills from comma-separated lists and bullet points
    const skillPatterns = [
        /(?:Skills?|Technologies?|Tools?|Languages?):\s*([^\n]+)/gi,
        /•\s*([A-Za-z][A-Za-z0-9\s\.\-]+)(?:,|$)/g,
        /-\s*([A-Za-z][A-Za-z0-9\s\.\-]+)(?:,|$)/g
    ];

    skillPatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(textToSearch)) !== null) {
            const skillText = match[1].trim();
            // Split by common separators
            const skills = skillText.split(/[,;|]/).map(s => s.trim()).filter(s => s.length > 2);

            skills.forEach(skill => {
                // Clean up the skill name
                const cleanSkill = skill.replace(/[^\w\s\.\-]/g, '').trim();
                if (cleanSkill.length > 2 && cleanSkill.length < 30 && !foundSkills.includes(cleanSkill)) {
                    foundSkills.push(cleanSkill);
                }
            });
        }
    });

    return foundSkills;
}

function extractExperience(text: string): string[] {
    const expSection = extractSection(text, ['EXPERIENCE', 'WORK EXPERIENCE', 'EMPLOYMENT']);
    if (!expSection) return [];

    return expSection.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 10)
        .slice(0, 5); // Limit to 5 entries
}

function extractEducation(text: string): string[] {
    const eduSection = extractSection(text, ['EDUCATION', 'ACADEMIC BACKGROUND']);
    if (!eduSection) return [];

    return eduSection.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 5)
        .slice(0, 3); // Limit to 3 entries
}

function extractCertifications(text: string): string[] {
    const certSection = extractSection(text, ['CERTIFICATIONS', 'CERTIFICATES', 'CERTIFICATION']);
    if (!certSection) return [];

    return certSection.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 5 && (line.includes('Certified') || line.includes('Certificate')))
        .slice(0, 5); // Limit to 5 entries
}

function extractSection(text: string, headers: string[]): string | null {
    for (const header of headers) {
        // Try multiple patterns for section headers
        const patterns = [
            // Standard header with colon
            new RegExp(`${header}:?\\s*\\n([\\s\\S]*?)(?=\\n[A-Z][A-Z\\s]+:|$)`, 'i'),
            // Header followed by content on same line
            new RegExp(`${header}:?\\s*([^\\n]+(?:\\n[^\\n]*)*?)(?=\\n[A-Z][A-Z\\s]+:|$)`, 'i'),
            // Header with underline or formatting
            new RegExp(`${header}[:\\-\\s]*\\n[\\-=]*\\s*\\n([\\s\\S]*?)(?=\\n[A-Z][A-Z\\s]+:|$)`, 'i')
        ];

        for (const regex of patterns) {
            const match = text.match(regex);
            if (match && match[1] && match[1].trim().length > 0) {
                return match[1];
            }
        }
    }
    return null;
}

// Simple taxonomy classification (placeholder). In production, map to ESCO/O*NET dataset.
export function classifySkills(skills: string[] = []): { skill: string; category: string }[] {
    const categories: Record<string, string> = {
        python: 'Programming Language',
        pytorch: 'Deep Learning Framework',
        tensorflow: 'Deep Learning Framework',
        mlops: 'MLOps',
        docker: 'DevOps',
        kubernetes: 'DevOps'
    };
    return skills.map(s => ({ skill: s, category: categories[s.toLowerCase()] || 'Other' }));
}
