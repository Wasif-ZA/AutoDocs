import { logger } from './logger.js';

interface RateLimitConfig {
  requestsPerMinute: number;
  tokensPerMinute: number;
}

export class RateLimiter {
  private requestTimes: number[] = [];
  private tokenCounts: number[] = [];
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  async waitForSlot(estimatedTokens: number = 1000): Promise<void> {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Clean old entries
    this.requestTimes = this.requestTimes.filter(t => t > oneMinuteAgo);
    this.tokenCounts = this.tokenCounts.filter((_, i) => this.requestTimes[i] !== undefined && this.requestTimes[i] > oneMinuteAgo);

    // Check request limit
    if (this.requestTimes.length >= this.config.requestsPerMinute) {
      const waitTime = this.requestTimes[0] - oneMinuteAgo + 100;
      logger.debug(`Rate limit: waiting ${waitTime}ms for request slot`);
      await sleep(waitTime);
      return this.waitForSlot(estimatedTokens);
    }

    // Check token limit
    const totalTokens = this.tokenCounts.reduce((a, b) => a + b, 0);
    if (totalTokens + estimatedTokens > this.config.tokensPerMinute) {
      const waitTime = this.requestTimes[0] - oneMinuteAgo + 100;
      logger.debug(`Rate limit: waiting ${waitTime}ms for token budget`);
      await sleep(waitTime);
      return this.waitForSlot(estimatedTokens);
    }
  }

  recordRequest(tokens: number): void {
    this.requestTimes.push(Date.now());
    this.tokenCounts.push(tokens);
  }
}

// Controlled parallel execution
export async function parallelWithLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<Array<{ item: T; result: R | null; error: Error | null }>> {
  const results: Array<{ item: T; result: R | null; error: Error | null }> = [];
  const executing: Set<Promise<void>> = new Set();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    const promise = (async () => {
      try {
        const result = await fn(item, i);
        results.push({ item, result, error: null });
      } catch (error) {
        results.push({ item, result: null, error: error as Error });
      }
    })();

    executing.add(promise);
    promise.then(() => executing.delete(promise));

    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
  return results;
}

// Retry with exponential backoff
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    retries: number;
    delay: number;
    backoff?: number;
    shouldRetry?: (error: Error) => boolean;
  }
): Promise<T> {
  const { retries, delay, backoff = 2, shouldRetry = () => true } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === retries || !shouldRetry(lastError)) {
        throw lastError;
      }

      const waitTime = delay * Math.pow(backoff, attempt);
      logger.debug(`Retry ${attempt + 1}/${retries} after ${waitTime}ms`, {
        error: lastError.message,
      });

      await sleep(waitTime);
    }
  }

  throw lastError!;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
