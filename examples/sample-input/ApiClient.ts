const DEFAULT_TIMEOUT_MS = 5_000;
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 300;

const sleep = async (durationMs: number): Promise<void> => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, durationMs);
  });
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const mergeAbortSignals = (signals: AbortSignal[]): AbortSignal => {
  const controller = new AbortController();

  const abortFromSignal = (source: AbortSignal): void => {
    if (source.aborted) {
      controller.abort(source.reason);
      return;
    }

    source.addEventListener(
      'abort',
      () => {
        controller.abort(source.reason);
      },
      { once: true }
    );
  };

  signals.forEach(abortFromSignal);
  return controller.signal;
};

export class ApiError extends Error {
  public readonly status: number;
  public readonly endpoint: string;
  public readonly details?: string;

  public constructor(message: string, status: number, endpoint: string, details?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.endpoint = endpoint;
    this.details = details;
  }
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  public constructor(baseUrl: string, timeoutMs = DEFAULT_TIMEOUT_MS) {
    if (baseUrl.trim().length === 0) {
      throw new RangeError('baseUrl must be a non-empty URL string.');
    }

    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      throw new RangeError('timeoutMs must be a positive number.');
    }

    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.timeoutMs = timeoutMs;
  }

  public async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (endpoint.trim().length === 0) {
      throw new RangeError('endpoint must be a non-empty string.');
    }

    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const timeoutController = new AbortController();
      const timeoutHandle = setTimeout(() => {
        timeoutController.abort(new Error(`Request timeout after ${this.timeoutMs}ms`));
      }, this.timeoutMs);

      const signal = options.signal
        ? mergeAbortSignals([options.signal, timeoutController.signal])
        : timeoutController.signal;

      try {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
          ...options,
          signal,
          headers: {
            Accept: 'application/json',
            ...options.headers
          }
        });

        if (!response.ok) {
          const details = await response.text();
          throw new ApiError(
            `Request failed with status ${response.status}`,
            response.status,
            endpoint,
            details
          );
        }

        const payload: unknown = await response.json();
        if (!isRecord(payload) && !Array.isArray(payload)) {
          throw new ApiError('Response payload must be a JSON object or array.', response.status, endpoint);
        }

        return payload as T;
      } catch (error: unknown) {
        const knownError = error instanceof Error ? error : new Error('Unknown request error.');
        lastError = knownError;

        if (knownError instanceof ApiError && knownError.status < 500) {
          throw knownError;
        }

        if (attempt >= MAX_ATTEMPTS) {
          break;
        }

        await sleep(BASE_BACKOFF_MS * 2 ** (attempt - 1));
      } finally {
        clearTimeout(timeoutHandle);
      }
    }

    if (lastError instanceof ApiError) {
      throw lastError;
    }

    throw new ApiError(lastError?.message ?? 'Request failed.', 503, endpoint);
  }
}
