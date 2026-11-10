/**
 * Shared Redis client + JSON helpers.
 *
 * Design notes that matter for the lesson:
 *  - `enableOfflineQueue: false`  -> when Redis is down, commands FAIL FAST
 *    instead of hanging forever. That is what a real read path should do:
 *    catch the error and fall back to the database.
 *  - `retryStrategy`             -> keeps trying to reconnect forever, so the
 *    lab self-heals when you start Redis after the app.
 */

import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';

export const redis = new Redis(REDIS_URL, {
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
  retryStrategy: (attempt) => Math.min(attempt * 300, 3000),
});

let lastError = '';

redis.on('error', (error: Error) => {
  // ioredis emits on every retry; only print when the message changes.
  if (error.message !== lastError) {
    lastError = error.message;
    console.error(`[redis] ${error.message}`);
  }
});

redis.on('ready', () => {
  lastError = '';
  console.log(`[redis] connected to ${REDIS_URL}`);
});

export async function cacheGet<T>(key: string): Promise<T | null> {
  const raw = await redis.get(key);
  return raw === null ? null : (JSON.parse(raw) as T);
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
}

export async function cacheDel(key: string): Promise<void> {
  await redis.del(key);
}

export async function pingRedis(): Promise<number | null> {
  if (redis.status !== 'ready') return null;
  const started = Date.now();
  await redis.ping();
  return Date.now() - started;
}

export interface KeyInfo {
  key: string;
  ttl: number;
  size: number;
  value: string;
}

/** Used only by the dashboard: list keys, their TTL and a value preview. */
export async function listKeys(pattern: string): Promise<KeyInfo[]> {
  if (redis.status !== 'ready') return [];

  const keys = await redis.keys(pattern);
  if (keys.length === 0) return [];

  const pipeline = redis.pipeline();
  for (const key of keys) {
    pipeline.ttl(key);
    pipeline.get(key);
  }

  const results = await pipeline.exec();
  if (!results) return [];

  const info: KeyInfo[] = [];
  for (let i = 0; i < keys.length; i += 1) {
    const ttl = (results[i * 2]?.[1] as number) ?? -1;
    const raw = (results[i * 2 + 1]?.[1] as string | null) ?? '';
    info.push({
      key: keys[i],
      ttl,
      size: raw.length,
      value: raw.length > 90 ? `${raw.slice(0, 90)}…` : raw,
    });
  }

  return info.sort((a, b) => a.key.localeCompare(b.key));
}
