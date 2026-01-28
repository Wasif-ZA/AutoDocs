import { describe, it, expect } from 'vitest';
import { parallelWithLimit, withRetry } from '../utils/concurrency.js';

describe('parallelWithLimit', () => {
  it('processes items in parallel up to the limit', async () => {
    const items = [1, 2, 3, 4, 5];
    const concurrentCalls: number[] = [];
    let maxConcurrent = 0;
    let currentConcurrent = 0;

    const results = await parallelWithLimit(items, 2, async (item) => {
      currentConcurrent++;
      maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
      concurrentCalls.push(item);

      await new Promise(resolve => setTimeout(resolve, 50));

      currentConcurrent--;
      return item * 2;
    });

    expect(maxConcurrent).toBeLessThanOrEqual(2);
    expect(results).toHaveLength(5);
    expect(results.every(r => r.error === null)).toBe(true);
  });

  it('captures errors without stopping other items', async () => {
    const items = [1, 2, 3];

    const results = await parallelWithLimit(items, 3, async (item) => {
      if (item === 2) {
        throw new Error('Item 2 failed');
      }
      return item * 2;
    });

    const successful = results.filter(r => r.result !== null);
    const failed = results.filter(r => r.error !== null);

    expect(successful).toHaveLength(2);
    expect(failed).toHaveLength(1);
    expect(failed[0].error?.message).toBe('Item 2 failed');
  });

  it('handles empty array', async () => {
    const results = await parallelWithLimit([], 2, async (item) => item);

    expect(results).toHaveLength(0);
  });

  it('handles limit larger than array', async () => {
    const items = [1, 2];

    const results = await parallelWithLimit(items, 10, async (item) => item * 2);

    expect(results).toHaveLength(2);
    expect(results.every(r => r.error === null)).toBe(true);
  });
});

describe('withRetry', () => {
  it('succeeds on first attempt', async () => {
    let attempts = 0;

    const result = await withRetry(
      async () => {
        attempts++;
        return 'success';
      },
      { retries: 3, delay: 10 }
    );

    expect(result).toBe('success');
    expect(attempts).toBe(1);
  });

  it('retries on failure and eventually succeeds', async () => {
    let attempts = 0;

    const result = await withRetry(
      async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Not ready yet');
        }
        return 'success';
      },
      { retries: 3, delay: 10 }
    );

    expect(result).toBe('success');
    expect(attempts).toBe(3);
  });

  it('throws after exhausting retries', async () => {
    let attempts = 0;

    await expect(
      withRetry(
        async () => {
          attempts++;
          throw new Error('Always fails');
        },
        { retries: 2, delay: 10 }
      )
    ).rejects.toThrow('Always fails');

    expect(attempts).toBe(3); // Initial + 2 retries
  });

  it('respects shouldRetry predicate', async () => {
    let attempts = 0;

    await expect(
      withRetry(
        async () => {
          attempts++;
          throw new Error('fatal error');
        },
        {
          retries: 3,
          delay: 10,
          shouldRetry: (error) => !error.message.includes('fatal'),
        }
      )
    ).rejects.toThrow('fatal error');

    expect(attempts).toBe(1); // No retries due to predicate
  });

  it('uses exponential backoff', async () => {
    let attempts = 0;
    const timestamps: number[] = [];

    await expect(
      withRetry(
        async () => {
          attempts++;
          timestamps.push(Date.now());
          throw new Error('fail');
        },
        { retries: 2, delay: 50, backoff: 2 }
      )
    ).rejects.toThrow('fail');

    expect(attempts).toBe(3);

    // Check that delays increased
    const delay1 = timestamps[1] - timestamps[0];
    const delay2 = timestamps[2] - timestamps[1];

    expect(delay1).toBeGreaterThanOrEqual(45); // ~50ms
    expect(delay2).toBeGreaterThanOrEqual(90); // ~100ms (50 * 2)
  });
});
