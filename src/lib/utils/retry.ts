/**
 * Retry utility with exponential backoff
 * For use in frontend API calls
 */

interface RetryOptions {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    onRetry?: (attempt: number, error: unknown) => void;
}

/**
 * Execute a function with retry logic and exponential backoff
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const {
        maxRetries = 3,
        baseDelayMs = 1000,
        maxDelayMs = 10000,
        onRetry,
    } = options;

    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            if (attempt < maxRetries) {
                // Exponential backoff: 1s, 2s, 4s, etc. capped at maxDelayMs
                const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);

                if (onRetry) {
                    onRetry(attempt + 1, error);
                }

                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    throw lastError;
}

/**
 * API fetch with automatic retry and idempotency key
 */
export async function fetchWithRetry<T>(
    url: string,
    options: RequestInit & {
        retryOptions?: RetryOptions;
        generateIdempotencyKey?: boolean;
    } = {}
): Promise<{ success: boolean; data?: T; error?: { code: string; message: string } }> {
    const { retryOptions, generateIdempotencyKey = true, ...fetchOptions } = options;

    // Generate idempotency key for POST/PUT requests
    const headers = new Headers(fetchOptions.headers);
    if (generateIdempotencyKey && ['POST', 'PUT'].includes(fetchOptions.method || 'GET')) {
        if (!headers.has('Idempotency-Key')) {
            headers.set('Idempotency-Key', crypto.randomUUID());
        }
    }

    return withRetry(
        async () => {
            const response = await fetch(url, {
                ...fetchOptions,
                headers,
            });

            const data = await response.json();

            if (!response.ok) {
                // Throw for retry on server errors (5xx)
                if (response.status >= 500) {
                    throw new Error(data.error?.message || 'Server error');
                }
                // Don't retry client errors (4xx)
                return { success: false, error: data.error };
            }

            return data;
        },
        retryOptions
    );
}
