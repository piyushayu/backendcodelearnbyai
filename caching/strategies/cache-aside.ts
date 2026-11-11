/**
 * MODULE 1 — CACHE-ASIDE (a.k.a. lazy loading)
 *
 * The application owns the cache. Redis sits *beside* it.
 *
 *   READ : GET key -> HIT  -> return cached JSON
 *                   -> MISS -> SELECT from DB -> SET key EX ttl -> return
 *
 *   WRITE: UPDATE database first, then DEL the key.
 *
 * Why DEL and not SET on write? Two concurrent writes can reach the cache out
 * of order and leave a permanently stale value. A DEL has no value that can
 * arrive out of order, and the next read repopulates from the source of truth.
 */

import { Router } from 'express';
import { cacheDel, cacheGet, cacheSet } from '../lib/redis';
import { db, User } from '../lib/db';
import { log } from '../lib/log';

const now = () => performance.now();
const elapsed = (startedAt: number) => Math.round((performance.now() - startedAt) * 10) / 10;

export const NS = 'aside';
const TTL_SECONDS = 60;
const keyFor = (id: string) => `${NS}:user:${id}`;

export const cacheAside = Router();

// --------------------------------------------------------------------------
// LIST: GET /api/cache-aside/users  (fast, un-cached — used by the dropdown)
// --------------------------------------------------------------------------
cacheAside.get('/users', (_req, res) => {
  res.json({ users: db.listUsers() });
});

// --------------------------------------------------------------------------
// READ: GET /api/cache-aside/users/:id
// --------------------------------------------------------------------------
cacheAside.get('/users/:id', async (req, res) => {
  const started = now();
  const id = req.params.id;
  const key = keyFor(id);

  // 1. Always ask the cache first.
  let cached: User | null = null;
  try {
    cached = await cacheGet<User>(key);
  } catch {
    // The cache is a performance layer, NOT a dependency. If Redis is down we
    // keep serving traffic from the DB instead of returning a 500.
    log.error(NS, 'Redis unavailable on read — falling back to the database');
  }

  if (cached) {
    log.hit(NS, key, elapsed(started));
    const ms = elapsed(started);
    log.request(NS, ms);
    return res.json({ source: 'cache', user: cached, ms });
  }

  log.miss(NS, key, elapsed(started));

  // 2. Cache missed (or Redis is down) -> pay the database price.
  const user = await db.findUser(NS, id);
  if (!user) {
    const ms = elapsed(started);
    log.request(NS, ms);
    return res.status(404).json({ error: `User ${id} not found`, ms });
  }

  // 3. Lazily fill the cache for the next reader.
  const setStarted = now();
  try {
    await cacheSet(key, user, TTL_SECONDS);
    log.set(NS, key, TTL_SECONDS, elapsed(setStarted));
  } catch {
    log.error(NS, 'Redis unavailable on write — response still served from DB');
  }

  const ms = elapsed(started);
  log.request(NS, ms);
  return res.json({ source: 'db', user, ms });
});

// --------------------------------------------------------------------------
// WRITE: PUT /api/cache-aside/users/:id
// --------------------------------------------------------------------------
cacheAside.put('/users/:id', async (req, res) => {
  const started = now();
  const id = req.params.id;

  const current = await db.findUser(NS, id);
  if (!current) {
    const ms = elapsed(started);
    log.request(NS, ms);
    return res.status(404).json({ error: `User ${id} not found`, ms });
  }

  const updated: User = {
    ...current,
    ...(req.body as Partial<User>),
    id,
    updatedAt: new Date().toISOString(),
  };

  // 1. Source of truth first.
  await db.saveUser(NS, updated);

  // 2. Then invalidate — the next GET will refill from the DB.
  try {
    const delStarted = now();
    await cacheDel(keyFor(id));
    log.del(NS, keyFor(id), elapsed(delStarted));
  } catch {
    log.error(NS, 'Redis unavailable on invalidate — key will expire by TTL');
  }

  const ms = elapsed(started);
  log.request(NS, ms);
  return res.json({ user: updated, invalidated: keyFor(id), ms });
});

// --------------------------------------------------------------------------
// DEMO: another service writes straight to the DB, bypassing this API.
// Nothing invalidates Redis -> the stale window becomes visible.
// --------------------------------------------------------------------------
cacheAside.post('/dev/direct-db-write/:id', async (req, res) => {
  const started = now();
  const id = req.params.id;

  const current = await db.findUser(NS, id);
  if (!current) {
    const ms = elapsed(started);
    log.request(NS, ms);
    return res.status(404).json({ error: `User ${id} not found`, ms });
  }

  const updated: User = {
    ...current,
    ...(req.body as Partial<User>),
    id,
    updatedAt: new Date().toISOString(),
  };

  // Deliberately does NOT touch Redis. This is the classic cache-aside bug.
  await db.saveUser(NS, updated);
  log.info(NS, 'DB written directly — cache NOT invalidated (stale window starts now)');

  const ms = elapsed(started);
  log.request(NS, ms);
  return res.json({
    user: updated,
    cacheStaleUntilTtl: keyFor(id),
    note: 'The next GET will return the OLD cached value until the 60s TTL expires.',
    ms,
  });
});

// --------------------------------------------------------------------------
// Manual eviction (handy when demonstrating the stale window)
// --------------------------------------------------------------------------
cacheAside.delete('/cache/:id', async (req, res) => {
  const key = keyFor(req.params.id);
  try {
    const delStarted = now();
    await cacheDel(key);
    log.del(NS, key, elapsed(delStarted));
    return res.json({ evicted: key, note: 'Next GET will be a MISS and read fresh data.' });
  } catch {
    return res.status(503).json({ error: 'Redis unavailable' });
  }
});

// --------------------------------------------------------------------------
// Reset everything for this module
// --------------------------------------------------------------------------
cacheAside.post('/reset', async (_req, res) => {
  try {
    const keys = await cacheKeys();
    if (keys.length > 0) await Promise.all(keys.map((key) => cacheDel(key)));
  } catch {
    // Redis down: nothing to clear.
  }
  db.reset();
  log.resetNamespace(NS);
  log.info(NS, 'Lab reset — DB reseeded, cache flushed');
  res.json({ ok: true });
});

/** Small helper so /reset does not need the redis client directly. */
async function cacheKeys(): Promise<string[]> {
  const { redis } = await import('../lib/redis');
  if (redis.status !== 'ready') return [];
  return redis.keys(`${NS}:*`);
}
