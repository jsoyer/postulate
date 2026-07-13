/**
 * Client-side rate limiter with a sliding window and exponential-backoff retry.
 *
 * Designed for use in browser contexts — no Node.js APIs required.
 */

// ---------------------------------------------------------------------------
// withRetry — standalone exponential-backoff helper
// ---------------------------------------------------------------------------

/**
 * Retry `fn` up to `retries` times on failure, waiting `baseDelayMs * 2^attempt`
 * milliseconds between each attempt.
 *
 * Throws the last error if all attempts are exhausted.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  baseDelayMs = 500
): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt < retries) {
        const delay = baseDelayMs * Math.pow(2, attempt)
        await sleep(delay)
      }
    }
  }
  throw lastError
}

// ---------------------------------------------------------------------------
// RateLimiter
// ---------------------------------------------------------------------------

/**
 * Sliding-window rate limiter.
 *
 * Tracks call timestamps within the last `windowMs` milliseconds.  When the
 * limit is exceeded, `throttle()` waits with exponential backoff before
 * retrying — rather than failing immediately — which suits burst-heavy UI
 * patterns (e.g. rapid stage changes triggering API calls).
 */
export class RateLimiter {
  /** Timestamps of calls made within the current window. */
  private calls: number[] = []

  constructor(
    /** Maximum number of calls allowed within `windowMs`. */
    private readonly maxCalls: number,
    /** Rolling window duration in milliseconds. */
    private readonly windowMs: number
  ) {}

  /**
   * Returns true when a new call can be made without exceeding the rate limit.
   * Prunes stale timestamps as a side-effect.
   */
  canCall(): boolean {
    this.prune()
    return this.calls.length < this.maxCalls
  }

  /**
   * Execute `fn` if the rate limit allows, otherwise wait with exponential
   * backoff and retry.  Throws `RateLimitError` after `retries` failed waits.
   */
  async throttle<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
    let lastError: unknown
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (this.canCall()) {
        this.calls.push(Date.now())
        return fn()
      }

      lastError = new RateLimitError(
        `Rate limit exceeded (${this.maxCalls} calls / ${this.windowMs}ms)`
      )

      if (attempt < retries) {
        const delay = 500 * Math.pow(2, attempt)
        await sleep(delay)
      }
    }
    throw lastError
  }

  /** Remove call timestamps that have fallen outside the current window. */
  private prune(): void {
    const cutoff = Date.now() - this.windowMs
    this.calls = this.calls.filter((ts) => ts > cutoff)
  }
}

// ---------------------------------------------------------------------------
// RateLimitError
// ---------------------------------------------------------------------------

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "RateLimitError"
  }
}

// ---------------------------------------------------------------------------
// Shared singleton — 60 calls per minute
// ---------------------------------------------------------------------------

export const apiRateLimiter = new RateLimiter(60, 60_000)

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
