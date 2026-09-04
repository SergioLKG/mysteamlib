/**
 * Minimal in-process rate limiter to avoid hammering external APIs during a
 * sync run. Serverless invocations are short-lived, so this only needs to
 * throttle within a single run (not across runs).
 */
export class RateLimiter {
  private minIntervalMs: number;
  private lastCall = 0;

  constructor(minIntervalMs: number) {
    this.minIntervalMs = minIntervalMs;
  }

  async next(): Promise<void> {
    const now = Date.now();
    const wait = Math.max(0, this.lastCall + this.minIntervalMs - now);
    if (wait > 0) {
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
    this.lastCall = Date.now();
  }
}

/** Sleep helper. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
