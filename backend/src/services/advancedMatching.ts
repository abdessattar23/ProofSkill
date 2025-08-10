import { getSupabase } from '../lib/supabase';
import { generateEmbedding, generateEmbeddingsBatch } from './embeddings';
import { cacheGet, cacheSet } from '../lib/redis';

interface MatchingCriteria {
    skills?: string[];
    location?: {
        city?: string;
        region?: string;
        country?: string;
        remote?: boolean;
        maxDistance?: number; // in kilometers
        timezone?: string;
    };
    experience?: {
        min?: number;
        max?: number;
    };
    salary?: {
        min?: number;
        max?: number;
        currency?: string;
    };
    jobType?: string; // full-time, part-time, contract, internship
    availability?: {
        startDate?: Date;
        noticePeriod?: number; // in days
        workingHours?: 'flexible' | 'fixed' | 'shift';
        timezone?: string;
    };
    hybrid?: boolean; // skill + location + experience combined scoring
}interface MatchResult {
    candidateId: string;
    jobId: string;
    totalScore: number;
    skillScore: number;
    locationScore: number;
    experienceScore: number;
    salaryScore: number;
    breakdown: {
        matchedSkills: Array<{ skill: string; score: number }>;
        locationMatch: boolean;
        experienceMatch: boolean;
        salaryMatch: boolean;
    };
}

export class AdvancedMatcher {

    // Enhanced skill-based matching with semantic similarity
    async matchBySkills(
        candidateSkills: string[],
        jobSkills: string[],
        threshold = 0.75
    ): Promise<{ score: number; matches: Array<{ skill: string; score: number }> }> {

        const cacheKey = `skill_match:${candidateSkills.sort().join('+')}:${jobSkills.sort().join('+')}`;
        const cached = await cacheGet(cacheKey);
        if (cached) return cached as any;

        // Generate embeddings for all skills
        const [candidateEmbeddings, jobEmbeddings] = await Promise.all([
            generateEmbeddingsBatch(candidateSkills),
            generateEmbeddingsBatch(jobSkills)
        ]);

        const matches: Array<{ skill: string; score: number }> = [];
        let totalScore = 0;

        // For each job skill, find best matching candidate skill
        for (let i = 0; i < jobSkills.length; i++) {
            const jobSkill = jobSkills[i];
            const jobEmbedding = jobEmbeddings[i];

            let bestMatch = { skill: '', score: 0 };

            for (let j = 0; j < candidateSkills.length; j++) {
                const candidateSkill = candidateSkills[j];
                const candidateEmbedding = candidateEmbeddings[j];

                // Calculate cosine similarity
                const similarity = this.cosineSimilarity(jobEmbedding, candidateEmbedding);

                if (similarity > bestMatch.score && similarity > threshold) {
                    bestMatch = { skill: candidateSkill, score: similarity };
                }
            }

            if (bestMatch.score > 0) {
                matches.push({ skill: jobSkill, score: bestMatch.score });
                totalScore += bestMatch.score;
            }
        }

        const result = {
            score: jobSkills.length > 0 ? totalScore / jobSkills.length : 0,
            matches
        };

        await cacheSet(cacheKey, result, 3600);
        return result;
    }

    // Enhanced location matching with distance and timezone
    async matchByLocation(
        candidateLocation: {
            city?: string;
            region?: string;
            country?: string;
            remote?: boolean;
            coordinates?: { lat: number; lng: number };
            timezone?: string;
        },
        jobLocation: {
            city?: string;
            region?: string;
            country?: string;
            remote?: boolean;
            coordinates?: { lat: number; lng: number };
            maxDistance?: number;
            timezone?: string;
        }
    ): Promise<{ score: number; match: boolean; distance?: number; timezoneMatch?: boolean }> {

        // Remote work always matches
        if (jobLocation.remote || candidateLocation.remote) {
            return { score: 1.0, match: true, timezoneMatch: this.matchTimezone(candidateLocation.timezone, jobLocation.timezone) };
        }

        // Distance-based matching if coordinates are available
        if (candidateLocation.coordinates && jobLocation.coordinates) {
            const distance = this.calculateDistance(
                candidateLocation.coordinates,
                jobLocation.coordinates
            );

            const maxDistance = jobLocation.maxDistance || 50; // Default 50km

            if (distance <= maxDistance) {
                const score = Math.max(0.5, 1 - (distance / maxDistance) * 0.5);
                return {
                    score,
                    match: true,
                    distance,
                    timezoneMatch: this.matchTimezone(candidateLocation.timezone, jobLocation.timezone)
                };
            }
        }

        // Exact city match
        if (candidateLocation.city && jobLocation.city) {
            if (candidateLocation.city.toLowerCase() === jobLocation.city.toLowerCase()) {
                return {
                    score: 1.0,
                    match: true,
                    timezoneMatch: this.matchTimezone(candidateLocation.timezone, jobLocation.timezone)
                };
            }
        }

        // Region match
        if (candidateLocation.region && jobLocation.region) {
            if (candidateLocation.region.toLowerCase() === jobLocation.region.toLowerCase()) {
                return {
                    score: 0.8,
                    match: true,
                    timezoneMatch: this.matchTimezone(candidateLocation.timezone, jobLocation.timezone)
                };
            }
        }

        // Country match
        if (candidateLocation.country && jobLocation.country) {
            if (candidateLocation.country.toLowerCase() === jobLocation.country.toLowerCase()) {
                return {
                    score: 0.6,
                    match: true,
                    timezoneMatch: this.matchTimezone(candidateLocation.timezone, jobLocation.timezone)
                };
            }
        }

        return { score: 0.0, match: false, timezoneMatch: false };
    }    // Experience level matching
    matchByExperience(
        candidateYears: number,
        jobRequirement: { min?: number; max?: number }
    ): { score: number; match: boolean } {

        if (!jobRequirement.min && !jobRequirement.max) {
            return { score: 1.0, match: true };
        }

        const min = jobRequirement.min || 0;
        const max = jobRequirement.max || Infinity;

        if (candidateYears >= min && candidateYears <= max) {
            return { score: 1.0, match: true };
        }

        // Partial scoring for close matches
        if (candidateYears < min) {
            const gap = min - candidateYears;
            const score = Math.max(0, 1 - (gap / min) * 0.5);
            return { score, match: gap <= 1 };
        }

        if (candidateYears > max) {
            const excess = candidateYears - max;
            const score = Math.max(0, 1 - (excess / max) * 0.3);
            return { score, match: excess <= 2 };
        }

        return { score: 0.0, match: false };
    }

    // Salary matching
    matchBySalary(
        candidateExpectation: { min?: number; max?: number },
        jobOffer: { min?: number; max?: number }
    ): { score: number; match: boolean } {

        if (!candidateExpectation.min && !candidateExpectation.max) {
            return { score: 1.0, match: true };
        }

        if (!jobOffer.min && !jobOffer.max) {
            return { score: 1.0, match: true };
        }

        const candidateMin = candidateExpectation.min || 0;
        const candidateMax = candidateExpectation.max || Infinity;
        const jobMin = jobOffer.min || 0;
        const jobMax = jobOffer.max || Infinity;

        // Check for overlap
        const overlapMin = Math.max(candidateMin, jobMin);
        const overlapMax = Math.min(candidateMax, jobMax);

        if (overlapMin <= overlapMax) {
            // Calculate overlap percentage
            const candidateRange = candidateMax - candidateMin;
            const jobRange = jobMax - jobMin;
            const overlapRange = overlapMax - overlapMin;

            const score = overlapRange / Math.min(candidateRange, jobRange);
            return { score: Math.min(1.0, score), match: true };
        }

        return { score: 0.0, match: false };
    }

    // Hybrid matching with weighted scoring
    async matchCandidateToJob(
        candidateId: string,
        jobId: string,
        weights = {
            skills: 0.5,
            location: 0.2,
            experience: 0.2,
            salary: 0.1
        }
    ): Promise<MatchResult> {

        const supabase = getSupabase();

        // Fetch candidate and job data
        const [{ data: candidate }, { data: job }] = await Promise.all([
            supabase.from('candidates').select('*').eq('id', candidateId).single(),
            supabase.from('jobs').select('*').eq('id', jobId).single()
        ]);

        if (!candidate || !job) {
            throw new Error('Candidate or job not found');
        }

        // Skill matching
        const skillMatch = await this.matchBySkills(
            candidate.skills || [],
            job.required_skills || []
        );

        // Location matching
        const locationMatch = await this.matchByLocation(
            {
                city: candidate.location?.city,
                region: candidate.location?.region,
                country: candidate.location?.country,
                remote: candidate.remote_work
            },
            {
                city: job.location?.city,
                region: job.location?.region,
                country: job.location?.country,
                remote: job.remote
            }
        );

        // Experience matching
        const experienceMatch = this.matchByExperience(
            candidate.years_experience || 0,
            {
                min: job.min_experience,
                max: job.max_experience
            }
        );

        // Salary matching
        const salaryMatch = this.matchBySalary(
            {
                min: candidate.salary_expectation?.min,
                max: candidate.salary_expectation?.max
            },
            {
                min: job.salary_range?.min,
                max: job.salary_range?.max
            }
        );

        // Calculate weighted total score
        const totalScore =
            skillMatch.score * weights.skills +
            locationMatch.score * weights.location +
            experienceMatch.score * weights.experience +
            salaryMatch.score * weights.salary;

        return {
            candidateId,
            jobId,
            totalScore,
            skillScore: skillMatch.score,
            locationScore: locationMatch.score,
            experienceScore: experienceMatch.score,
            salaryScore: salaryMatch.score,
            breakdown: {
                matchedSkills: skillMatch.matches,
                locationMatch: locationMatch.match,
                experienceMatch: experienceMatch.match,
                salaryMatch: salaryMatch.match
            }
        };
    }

    // Batch matching for multiple candidates/jobs
    async batchMatch(
        candidateIds: string[],
        jobIds: string[],
        criteria?: MatchingCriteria
    ): Promise<MatchResult[]> {

        const results: MatchResult[] = [];

        // Use Promise.all with chunking to avoid overwhelming the system
        const chunkSize = 10;
        for (let i = 0; i < candidateIds.length; i += chunkSize) {
            const candidateChunk = candidateIds.slice(i, i + chunkSize);

            for (let j = 0; j < jobIds.length; j += chunkSize) {
                const jobChunk = jobIds.slice(j, j + chunkSize);

                const chunkPromises = candidateChunk.flatMap(candidateId =>
                    jobChunk.map(jobId => this.matchCandidateToJob(candidateId, jobId))
                );

                const chunkResults = await Promise.all(chunkPromises);
                results.push(...chunkResults);
            }
        }

        // Filter and sort results
        return results
            .filter(result => result.totalScore > 0.3) // Minimum threshold
            .sort((a, b) => b.totalScore - a.totalScore);
    }

    // Helper function for cosine similarity
    private cosineSimilarity(vecA: number[], vecB: number[]): number {
        if (vecA.length !== vecB.length) {
            throw new Error('Vectors must have the same length');
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }

        normA = Math.sqrt(normA);
        normB = Math.sqrt(normB);

        if (normA === 0 || normB === 0) {
            return 0;
        }

        return dotProduct / (normA * normB);
    }

    // Calculate distance between two coordinates using Haversine formula
    private calculateDistance(
        coord1: { lat: number; lng: number },
        coord2: { lat: number; lng: number }
    ): number {
        const R = 6371; // Earth's radius in kilometers
        const dLat = this.toRadians(coord2.lat - coord1.lat);
        const dLng = this.toRadians(coord2.lng - coord1.lng);

        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRadians(coord1.lat)) * Math.cos(this.toRadians(coord2.lat)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    private toRadians(degrees: number): number {
        return degrees * (Math.PI / 180);
    }

    // Check timezone compatibility
    private matchTimezone(candidateTimezone?: string, jobTimezone?: string): boolean {
        if (!candidateTimezone || !jobTimezone) {
            return true; // If no timezone specified, assume compatible
        }

        // Check for exact match
        if (candidateTimezone === jobTimezone) {
            return true;
        }

        // Check for timezone overlap (simplified - in production, use proper timezone library)
        const timezoneGroups = {
            'UTC': ['UTC', 'GMT'],
            'EST': ['EST', 'EDT', 'America/New_York'],
            'PST': ['PST', 'PDT', 'America/Los_Angeles'],
            'CET': ['CET', 'CEST', 'Europe/Berlin'],
            'JST': ['JST', 'Asia/Tokyo'],
            'IST': ['IST', 'Asia/Kolkata']
        };

        for (const [group, zones] of Object.entries(timezoneGroups)) {
            if (zones.includes(candidateTimezone) && zones.includes(jobTimezone)) {
                return true;
            }
        }

        return false;
    }

    // Enhanced availability matching with comprehensive filtering
    matchAvailability(
        candidateAvailability?: {
            startDate?: string;
            workingHours?: 'flexible' | 'fixed' | 'shift';
            remotePreference?: 'remote' | 'hybrid' | 'onsite';
        },
        jobAvailability?: {
            startDate?: string;
            workingHours?: 'flexible' | 'fixed' | 'shift';
            remotePreference?: 'remote' | 'hybrid' | 'onsite';
        }
    ): { score: number; match: boolean; details: string[] } {
        const details: string[] = [];
        let totalScore = 0;
        let factors = 0;

        if (!candidateAvailability || !jobAvailability) {
            return { score: 0.5, match: true, details: ['No availability requirements specified'] };
        }

        // Start date compatibility
        if (candidateAvailability.startDate && jobAvailability.startDate) {
            const candidateStart = new Date(candidateAvailability.startDate);
            const jobStart = new Date(jobAvailability.startDate);
            const daysDiff = Math.abs((candidateStart.getTime() - jobStart.getTime()) / (1000 * 60 * 60 * 24));

            let startScore = 0;
            if (daysDiff <= 7) {
                startScore = 1.0;
                details.push('Perfect start date alignment');
            } else if (daysDiff <= 30) {
                startScore = 0.8;
                details.push('Good start date compatibility');
            } else if (daysDiff <= 90) {
                startScore = 0.5;
                details.push('Acceptable start date difference');
            } else {
                startScore = 0.2;
                details.push('Significant start date gap');
            }

            totalScore += startScore;
            factors++;
        }

        // Working hours compatibility
        if (candidateAvailability.workingHours && jobAvailability.workingHours) {
            let hoursScore = 0;

            if (candidateAvailability.workingHours === jobAvailability.workingHours) {
                hoursScore = 1.0;
                details.push(`Perfect working hours match: ${candidateAvailability.workingHours}`);
            } else if (candidateAvailability.workingHours === 'flexible') {
                hoursScore = 0.9;
                details.push('Candidate offers flexible hours');
            } else if (jobAvailability.workingHours === 'flexible') {
                hoursScore = 0.8;
                details.push('Job offers flexible hours');
            } else {
                hoursScore = 0.3;
                details.push('Working hours mismatch');
            }

            totalScore += hoursScore;
            factors++;
        }

        // Remote work preference compatibility
        if (candidateAvailability.remotePreference && jobAvailability.remotePreference) {
            let remoteScore = 0;

            if (candidateAvailability.remotePreference === jobAvailability.remotePreference) {
                remoteScore = 1.0;
                details.push(`Perfect remote preference match: ${candidateAvailability.remotePreference}`);
            } else if (
                (candidateAvailability.remotePreference === 'hybrid' && jobAvailability.remotePreference === 'remote') ||
                (candidateAvailability.remotePreference === 'hybrid' && jobAvailability.remotePreference === 'onsite') ||
                (jobAvailability.remotePreference === 'hybrid')
            ) {
                remoteScore = 0.8;
                details.push('Good remote work compatibility');
            } else {
                remoteScore = 0.2;
                details.push('Remote preference mismatch');
            }

            totalScore += remoteScore;
            factors++;
        }

        const finalScore = factors > 0 ? totalScore / factors : 0.5;
        const isMatch = finalScore >= 0.4; // Threshold for acceptable availability match

        return {
            score: Math.round(finalScore * 100) / 100,
            match: isMatch,
            details
        };
    }

    // Enhanced region filtering with comprehensive geographic support
    filterByRegion(
        candidates: any[],
        regionFilters: {
            countries?: string[];
            regions?: string[];
            cities?: string[];
            maxDistance?: number;
            centerPoint?: { lat: number; lng: number };
            timezones?: string[];
        }
    ): { filtered: any[]; excluded: any[]; stats: any } {
        const filtered: any[] = [];
        const excluded: any[] = [];
        const stats = {
            totalCandidates: candidates.length,
            filteredCount: 0,
            excludedCount: 0,
            filterReasons: {} as Record<string, number>
        };

        for (const candidate of candidates) {
            let passesFilter = true;
            const exclusionReasons: string[] = [];

            // Country filter
            if (regionFilters.countries && regionFilters.countries.length > 0) {
                const candidateCountry = candidate.location?.country?.toLowerCase();
                const allowedCountries = regionFilters.countries.map(c => c.toLowerCase());

                if (!candidateCountry || !allowedCountries.includes(candidateCountry)) {
                    passesFilter = false;
                    exclusionReasons.push('country');
                }
            }

            // Region filter
            if (regionFilters.regions && regionFilters.regions.length > 0 && passesFilter) {
                const candidateRegion = candidate.location?.region?.toLowerCase();
                const allowedRegions = regionFilters.regions.map(r => r.toLowerCase());

                if (!candidateRegion || !allowedRegions.includes(candidateRegion)) {
                    passesFilter = false;
                    exclusionReasons.push('region');
                }
            }

            // City filter
            if (regionFilters.cities && regionFilters.cities.length > 0 && passesFilter) {
                const candidateCity = candidate.location?.city?.toLowerCase();
                const allowedCities = regionFilters.cities.map(c => c.toLowerCase());

                if (!candidateCity || !allowedCities.includes(candidateCity)) {
                    passesFilter = false;
                    exclusionReasons.push('city');
                }
            }

            // Distance filter
            if (regionFilters.maxDistance && regionFilters.centerPoint && passesFilter) {
                const candidateCoords = candidate.location?.coordinates;

                if (candidateCoords && candidateCoords.lat && candidateCoords.lng) {
                    const distance = this.calculateDistance(regionFilters.centerPoint, candidateCoords);

                    if (distance > regionFilters.maxDistance) {
                        passesFilter = false;
                        exclusionReasons.push('distance');
                    }
                } else {
                    // No coordinates available, exclude if distance is required
                    passesFilter = false;
                    exclusionReasons.push('no_coordinates');
                }
            }

            // Timezone filter
            if (regionFilters.timezones && regionFilters.timezones.length > 0 && passesFilter) {
                const candidateTimezone = candidate.location?.timezone;

                if (!candidateTimezone || !regionFilters.timezones.includes(candidateTimezone)) {
                    passesFilter = false;
                    exclusionReasons.push('timezone');
                }
            }

            if (passesFilter) {
                filtered.push(candidate);
                stats.filteredCount++;
            } else {
                excluded.push({ ...candidate, exclusionReasons });
                stats.excludedCount++;

                // Track exclusion reasons
                for (const reason of exclusionReasons) {
                    stats.filterReasons[reason] = (stats.filterReasons[reason] || 0) + 1;
                }
            }
        }

        return { filtered, excluded, stats };
    }
}

export const advancedMatcher = new AdvancedMatcher();
