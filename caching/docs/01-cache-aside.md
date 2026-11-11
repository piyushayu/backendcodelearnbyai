# Module 1 — Cache-Aside (Lazy Loading)

> Code: [`strategies/cache-aside.ts`](../strategies/cache-aside.ts) · Dashboard tab 1 · Port `3100`

---

## 1. Mental model

**Your application is the only thing that knows the cache exists.**

Redis is not a proxy, not middleware, not in front of the DB. It is a key/value box
sitting *beside* your handler, and your handler decides:

- when to look in it,
- when to fill it,
- when to throw a key away.

That is the whole pattern. Everything else is details.

---

## 2. The flow

### Read — `GET /api/cache-aside/users/:id`

```
client
  │
  ├─▶ GET aside:user:1
  │      │
  │      ├─ HIT  ──────────────────────────▶ return JSON   (~1 ms)
  │      │
  │      └─ MISS
  │             │
  │             ├─▶ SELECT users WHERE id = 1   (~260 ms)
  │             │
  │             ├─▶ SET aside:user:1 EX 60      (fill for the next reader)
  │             │
  │             └────────────────────────────▶ return JSON   (~265 ms)
```

### Write — `PUT /api/cache-aside/users/:id`

```
client
  │
  ├─▶ UPDATE users SET ...        (source of truth first)
  │
  ├─▶ DEL aside:user:1            (invalidate, do NOT overwrite)
  │
  └────────────────────────────▶ 200
```

The next read is a miss, reads the fresh row, and refills the cache.
**That `DEL` is the entire consistency strategy.**

---

## 3. The code, annotated

```ts
// strategies/cache-aside.ts
export const NS = 'aside';
const TTL_SECONDS = 60;
const keyFor = (id: string) => `${NS}:user:${id}`;
```

`NS` namespaces the keys (`aside:user:1`) so the four modules can share one Redis
without colliding. `TTL_SECONDS` is how long a wrong value is allowed to survive.

### Read path

```ts
cacheAside.get('/users/:id', async (req, res) => {
  const started = Date.now();
  const key = keyFor(req.params.id);

  // 1. always ask the cache first
  let cached: User | null = null;
  try {
    cached = await cacheGet<User>(key);
  } catch {
    log.error(NS, 'Redis unavailable on read — falling back to the database');
  }

  if (cached) {
    log.hit(NS, key, Date.now() - started);
    return res.json({ source: 'cache', user: cached, ms: Date.now() - started });
  }

  log.miss(NS, key, Date.now() - started);

  // 2. miss -> pay the DB price
  const user = await db.findUser(NS, req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // 3. lazily fill the cache
  try {
    await cacheSet(key, user, TTL_SECONDS);
    log.set(NS, key, TTL_SECONDS, 0);
  } catch {
    log.error(NS, 'Redis unavailable on write — response still served from DB');
  }

  return res.json({ source: 'db', user, ms: Date.now() - started });
});
```

Four decisions worth memorising:

| Decision | Why |
| --- | --- |
| `get` before `db.findUser` | a hit is ~1 ms vs ~260 ms. That gap *is* the point of caching. |
| fill **after** the miss | "lazy": a cold key costs one slow request, then it is warm. Data nobody reads is never cached. |
| `EX 60` on every `SET` | the TTL is the **safety net**. If invalidation has a bug, the data self-heals in ≤ 60 s. |
| `try/catch` around Redis | a cache is a *performance* layer, never a *dependency*. Redis down ⇒ degrade to the DB, not 500. |

### Write path

```ts
cacheAside.put('/users/:id', async (req, res) => {
  const current = await db.findUser(NS, req.params.id);
  const updated = { ...current, ...req.body, id: req.params.id };

  await db.saveUser(NS, updated);   // 1. source of truth first
  await cacheDel(keyFor(id));       // 2. invalidate
  log.del(NS, keyFor(id), 0);
  return res.json({ user: updated, invalidated: keyFor(id) });
});
```

### Why `DEL` and not `SET` with the new value?

The cached value is **a claim about the database**. Once the DB changes, that
claim is *invalid*. So the write path does not try to "fix" the value — it throws
the claim away and says **"I don't know anymore"**. The next reader asks the DB.

That is the whole idea. `DEL` = *mark as unknown*. `SET` = *guess the new value*.

#### What goes wrong with `SET`

Two requests update the same row. The DB resolves them in one order, but the
cache writes can land in the opposite order:

```
        DB (source of truth)                 Redis (a copy)

t0   A: UPDATE name='A'   -> DB = A
t1   B: UPDATE name='B'   -> DB = B        (B wins in the DB)
t2                                        B: SET cache = 'B'     (still correct)
t3                                        A: SET cache = 'A'     ← A's cache write
                                                                   lands LAST
     DB = 'B'                             cache = 'A'            ← permanently wrong
```

Why can A's cache write land after B's, if A's DB write happened first? A and B
are separate requests. Between A's `await db.saveUser()` and A's
`await redis.set()` the process can be paused (GC, network, another `await`).
**There is no ordering guarantee between two requests.**

Nothing repairs that mismatch — not the next read (it hits the wrong value), not
the next write. Only the TTL eventually saves you. If TTL is long, this is a
silent data bug.

#### What `DEL` guarantees

```
t2   B: DEL key        -> key absent
t3   A: DEL key        -> key absent     (same state, no harm)
```

`DEL` has **no value**, so there is nothing to arrive "out of order":

- it is **idempotent** — deleting twice = deleting once,
- it is **order-independent** — any interleaving ends in "absent",
- "absent" can never be *wrong*: the next reader reloads from the DB.

Two more practical reasons:

1. You often don't have the full object at write time (partial updates, `UPDATE
   ... SET last_login=...`). `SET` would need a complete, serialisable snapshot;
   `DEL` needs nothing.
2. The DB may apply extra logic (triggers, defaults, computed columns). Re-reading
   is the only way to cache the *actual* stored row.

**The cost:** the next read is a miss (one slow ~260ms request). You are trading
one slow read for correctness. The TTL does not fix that miss — it only bounds how
long a *wrong* value could ever live.

> **Honest caveat:** `DEL` still has a tiny race. A reader whose `GET` missed just
> before the `DEL` can write its old copy into the cache *after* the `DEL`. The
> window is microseconds. If you cannot tolerate it: delayed double-delete,
> versioned keys, or write-through.

**Analogy:** if you're unsure of a number on the whiteboard, you don't write down
what you *think* the new number is — you erase it. Whoever needs it walks to the
ledger (the DB). Erasing twice is harmless. Writing a wrong number twice is not.

---

## 4. Run it

```bash
# 1. Redis (Docker Desktop must be running)
npm run cache:redis

# 2. dashboard
npm run cache:dev
# -> http://localhost:3100
```

Stop Redis with `npm run cache:redis:stop`.

---

## 5. The experiment (real output from this repo)

```
1 GET (cold)                   489ms  source=db    name=Piyush Singh
2 GET (warm)                     6ms  source=cache name=Piyush Singh
3 PUT rename                   581ms  (DB write + DEL)
4 GET (after invalidate)       263ms  source=db    name=Piyush Cached
5 GET (warm again)               8ms  source=cache name=Piyush Cached
6 direct DB write              521ms  (another service bypassed the API)
7 GET (STALE)                    7ms  source=cache name=Piyush Cached   ← old value!
8 evict key                      7ms
9 GET (fresh)                  296ms  source=db    name=Changed Behind Cache
```

Step 7 is the **stale window**. The DB says `Changed Behind Cache`, but Redis
still holds `Piyush Cached` and the app happily serves it, because nothing told
the cache that a write happened.

Bound it with a TTL. In the dashboard, wait for the key's TTL to hit `0` and the
next GET is automatically fresh again — no code, just expiry.

### Try these in the dashboard

1. **Read twice.** Watch `MISS → 260ms` become `HIT → ~1ms`. Watch the stats'
   hit rate climb.
2. **Rename, then read twice.** Watch `DEL` turn the next read into a miss.
3. **Direct DB write, then read.** Watch the stale value come back from cache.
4. **DELETE cache key, then read.** Stale value gone.
5. **Wait 60 s, then read.** TTL expired on its own — the safety net works.
6. **Stop Redis** (`npm run cache:redis:stop`) and read. The API still answers
   from the DB in ~260 ms. Restart Redis and the client reconnects on its own.

---

## 6. Failure modes you must know

| Situation | What cache-aside does | Mitigation |
| --- | --- | --- |
| Redis is down | every read misses → DB takes full load | try/catch + degrade; never 500 because of cache |
| Key expires during a spike | N requests miss together → N DB queries (**stampede**) | single-flight / mutex (not in this lab) |
| Another service writes the DB | stale until TTL | short TTL, pub/sub invalidation, or write-through |
| Write-heavy table | `DEL` churn ⇒ constant misses | write-through may fit better |
| Very hot key, huge value | network + deserialisation cost | compress, split keys, local L1 cache |

---

## 7. Production notes

- **TTL is a policy, not a number to copy.** Pick *how stale you can tolerate*.
  Profile data: 5–60 min is fine. Prices: seconds. Balances: don't cache this way.
- **Add jitter to TTLs** (`60 + rand(0..10)`) so a batch of keys does not all
  expire at the same second and stampede the DB.
- **Never cache `null`/404 blindly** — or do it deliberately ("negative caching")
  with a very short TTL to stop cache penetration on bogus IDs.
- **Serialize first, cache second.** The cached payload is a snapshot; keep it
  small and version it (`v1:user:1`) if the shape can change.
- **Instrument hit rate.** In this lab it is on the dashboard. In production it
  belongs in your metrics; a cache with a 5 % hit rate is just extra latency.

---

## 8. When to use it

✅ Read-heavy, can tolerate a short stale window, data can be re-fetched:
user profiles, product pages, settings, feed pages, search results.

❌ Must be exact on every read: balances, inventory counts, OTPs, permissions
that change instantly.

---

## 9. Two questions to check yourself

1. Why does the write path delete instead of overwrite the key?
2. Another service writes the row directly. How long can a client see old data,
   and what are the two ways to shorten that window?

Next module: **Read-Through** — same read behaviour, different *ownership*.
