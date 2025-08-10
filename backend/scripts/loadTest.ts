import { performance } from 'perf_hooks';

const BASE_URL = process.env.BASE_URL || 'http://localhost:4000';
const API_KEY = process.env.API_KEY;

interface LoadTestOptions {
    concurrency: number;
    duration: number; // seconds
    endpoint: string;
    method: 'GET' | 'POST';
    payload?: any;
}

interface LoadTestResult {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageLatency: number;
    p95Latency: number;
    p99Latency: number;
    requestsPerSecond: number;
}

async function makeRequest(endpoint: string, method: string, payload?: any): Promise<{ success: boolean; latency: number }> {
    const startTime = performance.now();

    try {
        const options: RequestInit = {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(API_KEY && { 'x-api-key': API_KEY })
            },
            ...(payload && { body: JSON.stringify(payload) })
        };

        const response = await fetch(`${BASE_URL}${endpoint}`, options);
        const endTime = performance.now();

        return {
            success: response.ok,
            latency: endTime - startTime
        };
    } catch (error) {
        const endTime = performance.now();
        return {
            success: false,
            latency: endTime - startTime
        };
    }
}

async function runLoadTest(options: LoadTestOptions): Promise<LoadTestResult> {
    const results: { success: boolean; latency: number }[] = [];
    const startTime = performance.now();
    const endTime = startTime + (options.duration * 1000);

    console.log(`Starting load test: ${options.concurrency} concurrent requests to ${options.endpoint} for ${options.duration}s`);

    const workers: Promise<void>[] = [];

    for (let i = 0; i < options.concurrency; i++) {
        workers.push(
            (async () => {
                while (performance.now() < endTime) {
                    const result = await makeRequest(options.endpoint, options.method, options.payload);
                    results.push(result);
                }
            })()
        );
    }

    await Promise.all(workers);

    const totalRequests = results.length;
    const successfulRequests = results.filter(r => r.success).length;
    const failedRequests = totalRequests - successfulRequests;
    const latencies = results.map(r => r.latency).sort((a, b) => a - b);

    const averageLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
    const p95Index = Math.floor(latencies.length * 0.95);
    const p99Index = Math.floor(latencies.length * 0.99);
    const p95Latency = latencies[p95Index] || 0;
    const p99Latency = latencies[p99Index] || 0;
    const requestsPerSecond = totalRequests / options.duration;

    return {
        totalRequests,
        successfulRequests,
        failedRequests,
        averageLatency,
        p95Latency,
        p99Latency,
        requestsPerSecond
    };
}

async function main() {
    const tests: LoadTestOptions[] = [
        {
            concurrency: 10,
            duration: 30,
            endpoint: '/healthz',
            method: 'GET'
        },
        {
            concurrency: 5,
            duration: 20,
            endpoint: '/api/interview/questions',
            method: 'POST',
            payload: {
                skills: ['JavaScript', 'Node.js'],
                context: 'Senior developer position'
            }
        }
    ];

    console.log('🚀 ProofSkill Load Testing\n');

    for (const test of tests) {
        const result = await runLoadTest(test);

        console.log(`\n📊 Results for ${test.method} ${test.endpoint}:`);
        console.log(`Total Requests: ${result.totalRequests}`);
        console.log(`Successful: ${result.successfulRequests} (${((result.successfulRequests / result.totalRequests) * 100).toFixed(1)}%)`);
        console.log(`Failed: ${result.failedRequests}`);
        console.log(`Average Latency: ${result.averageLatency.toFixed(2)}ms`);
        console.log(`P95 Latency: ${result.p95Latency.toFixed(2)}ms`);
        console.log(`P99 Latency: ${result.p99Latency.toFixed(2)}ms`);
        console.log(`Requests/sec: ${result.requestsPerSecond.toFixed(2)}`);
        console.log('─'.repeat(50));
    }
}

if (require.main === module) {
    main().catch(console.error);
}

export { runLoadTest, LoadTestOptions, LoadTestResult };
