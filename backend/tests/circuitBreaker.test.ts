import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { CircuitBreaker } from '../src/lib/circuitBreaker';

describe('Circuit Breaker', () => {
    let mockFn: any;
    let circuitBreaker: CircuitBreaker<[], string>;

    beforeAll(() => {
        mockFn = async () => 'success';
        circuitBreaker = new CircuitBreaker(mockFn, {
            failureThreshold: 3,
            resetTimeout: 100
        });
    });

    it('should be closed initially', () => {
        expect(circuitBreaker.getState().state).toBe('CLOSED');
    });

    it('should open after failure threshold', async () => {
        const failingFn = async () => { throw new Error('fail'); };
        const cb = new CircuitBreaker(failingFn, {
            failureThreshold: 2,
            resetTimeout: 100
        });

        try { await cb.execute(); } catch { }
        try { await cb.execute(); } catch { }

        expect(cb.getState().state).toBe('OPEN');
    });

    it('should transition to half-open after timeout', async () => {
        const failingFn = async () => { throw new Error('fail'); };
        const cb = new CircuitBreaker(failingFn, {
            failureThreshold: 1,
            resetTimeout: 50
        });

        try { await cb.execute(); } catch { }
        expect(cb.getState().state).toBe('OPEN');

        await new Promise(resolve => setTimeout(resolve, 60));

        // The circuit breaker should transition to HALF_OPEN on the next call
        // Since our function still fails, it should go back to OPEN
        try { await cb.execute(); } catch { }
        expect(cb.getState().state).toBe('OPEN');
    });
});
