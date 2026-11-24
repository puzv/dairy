const WINDOW_MS = 15 * 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 1000;
const MAX_KEYS = 4096;
const MAX_ADDRESS_LENGTH = 128;
const USERNAME_LIMIT = 5;
const IP_LIMIT = 20;

type Bucket = {
  failures: number[];
  pending: number;
};

type Store = {
  usernames: Map<string, Bucket>;
  ips: Map<string, Bucket>;
  nextSweepAt: number;
};

type Outcome = "failure" | "success" | "ignored";
type LoginAttempt = { retryAfterMinutes: number } | { finish(outcome: Outcome): void };

// This is a single-instance in-memory limit. Multi-instance or serverless
// deployments need a shared store. The global also shares state across route
// bundles loaded in the same server process.
const runtime = globalThis as typeof globalThis & { shanjianLoginRateLimit?: Store };
const store = runtime.shanjianLoginRateLimit ??= {
  usernames: new Map(),
  ips: new Map(),
  nextSweepAt: 0,
};

export function readClientIp(headers: Pick<Headers, "get">): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
  const address = forwarded || headers.get("x-real-ip")?.trim() || "unknown";
  // IP keys must stay bounded even when a caller supplies an invalid header.
  return address.length <= MAX_ADDRESS_LENGTH ? address.toLowerCase() : "unknown";
}

function pruneBucket(bucket: Bucket, now: number) {
  let expired = 0;
  while (expired < bucket.failures.length && bucket.failures[expired] + WINDOW_MS <= now) {
    expired++;
  }
  if (expired > 0) bucket.failures.splice(0, expired);
}

function removeIfEmpty(buckets: Map<string, Bucket>, key: string, bucket: Bucket) {
  if (bucket.pending === 0 && bucket.failures.length === 0) buckets.delete(key);
}

function sweep(now: number) {
  if (now < store.nextSweepAt) return;
  store.nextSweepAt = now + SWEEP_INTERVAL_MS;
  for (const buckets of [store.usernames, store.ips]) {
    for (const [key, bucket] of buckets) {
      pruneBucket(bucket, now);
      removeIfEmpty(buckets, key, bucket);
    }
  }
}

function retryTime(buckets: Map<string, Bucket>, key: string, limit: number, now: number): number {
  const bucket = buckets.get(key);
  if (!bucket) {
    // Fail closed for new keys instead of evicting active buckets, which would
    // let a flood of new keys reset existing locks.
    return buckets.size >= MAX_KEYS ? 1 : 0;
  }

  pruneBucket(bucket, now);
  if (bucket.failures.length >= limit) {
    return Math.ceil((bucket.failures[0] + WINDOW_MS - now) / SWEEP_INTERVAL_MS);
  }
  return bucket.failures.length + bucket.pending >= limit ? 1 : 0;
}

function reserve(buckets: Map<string, Bucket>, key: string): Bucket {
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { failures: [], pending: 0 };
    buckets.set(key, bucket);
  }
  bucket.pending++;
  return bucket;
}

export function beginLoginAttempt(username: string | null, ip: string): LoginAttempt {
  const now = Date.now();
  sweep(now);
  const retryAfterMinutes = Math.max(
    username === null ? 0 : retryTime(store.usernames, username, USERNAME_LIMIT, now),
    retryTime(store.ips, ip, IP_LIMIT, now),
  );
  if (retryAfterMinutes > 0) return { retryAfterMinutes };

  // Reserve synchronously before any database query or scrypt. Concurrent
  // attempts cannot all pass the check before the first failure is recorded.
  const userBucket = username === null ? null : reserve(store.usernames, username);
  const ipBucket = reserve(store.ips, ip);
  let finished = false;

  return {
    finish(outcome) {
      if (finished) return;
      finished = true;
      const completedAt = Date.now();

      ipBucket.pending--;
      if (outcome === "failure") ipBucket.failures.push(completedAt);
      removeIfEmpty(store.ips, ip, ipBucket);

      if (username !== null && userBucket) {
        userBucket.pending--;
        if (outcome === "success") userBucket.failures = [];
        if (outcome === "failure") userBucket.failures.push(completedAt);
        removeIfEmpty(store.usernames, username, userBucket);
      }
    },
  };
}
