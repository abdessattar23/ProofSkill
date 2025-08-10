import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { enqueue, dequeue, getDLQJobs } from '../src/lib/queue';
import { redis } from '../src/lib/redis';

describe('Queue System', () => {
    beforeAll(async () => {
        // Clear test queues
        await redis.del('ps:queue:scoring');
        await redis.del('ps:queue:dlq');
    });

    afterAll(async () => {
        await redis.del('ps:queue:scoring');
        await redis.del('ps:queue:dlq');
        await redis.quit();
    });

    it('should enqueue and dequeue jobs', async () => {
        const jobId = await enqueue('test-job', { message: 'hello' });
        expect(jobId).toBeDefined();

        const job = await dequeue();
        expect(job).toBeDefined();
        expect(job?.type).toBe('test-job');
        expect(job?.payload.message).toBe('hello');
    });

    it('should return null when queue is empty', async () => {
        const job = await dequeue();
        expect(job).toBeNull();
    });

    it('should handle DLQ operations', async () => {
        const dlqJobs = await getDLQJobs();
        expect(Array.isArray(dlqJobs)).toBe(true);
    });
});
