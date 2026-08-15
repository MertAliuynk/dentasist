// In-memory fixed-window rate limiter. Sufficient for a single-instance
// deployment (see deployment README / project memory on 150-200
// concurrent users, no Redis needed at this scale). If the app ever
// scales to multiple instances behind a load balancer, this must move to
// a shared store (Redis) since each instance would otherwise track its
// own counters.

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Periodically drop expired buckets so this map can't grow unbounded.
setInterval(
  () => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  },
  5 * 60 * 1000,
).unref?.();

export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterMs: number };

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterMs: 0 };
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, retryAfterMs: existing.resetAt - now };
  }

  existing.count += 1;
  return { allowed: true, remaining: limit - existing.count, retryAfterMs: 0 };
}
