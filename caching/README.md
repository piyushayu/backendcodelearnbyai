# Redis Caching Lab

Four caching strategies, one at a time, each with a live dashboard showing every
cache decision and the real latency cost.

| # | Pattern | Governs | Status |
| :- | :--- | :--- | :--- |
| 1 | [Cache-Aside](docs/01-cache-aside.md) | reads | ✅ built |
| 2 | [Read-Through](docs/02-read-through.md) | reads | ✅ built |
| 3 | Write-Through | writes | ⏳ next |
| 4 | Write-Behind | writes | ⏳ |

> These are not four versions of the same thing. Cache-aside vs read-through is
> about **who owns the miss**; write-through vs write-behind is about **when the
> DB is written**. Real systems pick one read strategy *and* one write strategy.

---

## Setup

Docker Desktop must be running.

```bash
npm run cache:redis     # redis:7-alpine on 127.0.0.1:6379
npm run cache:dev       # dashboard on http://localhost:3100
```

```bash
npm run cache:redis:stop   # stop Redis
```

Env (optional, sane defaults are baked in):

```env
REDIS_URL=redis://127.0.0.1:6379
CACHE_PORT=3100
```

---

## Layout

```text
caching/
├── docker-compose.yml
├── server.ts                  # Express app + dashboard on :3100
├── lib/
│   ├── db.ts                  # fake slow DB (JSON file, ~260ms per query)
│   ├── redis.ts               # ioredis client + JSON helpers
│   ├── log.ts                 # in-memory event log + per-module counters
│   └── ui.ts                  # dashboard HTML
├── strategies/
│   ├── cache-aside.ts
│   └── read-through.ts
├── docs/
│   ├── 01-cache-aside.md
│   └── 02-read-through.md
└── .data/db.json              # git-ignored fake database
```

The "database" is a JSON file on purpose: the lesson is caching, not SQL. Every
read is artificially slowed to ~260 ms so a cache hit (~1 ms) is impossible to
miss.

---

## Troubleshooting

**Dashboard says `redis: reconnecting` / `redis: down`**

Check the container first:

```bash
docker compose -f caching/docker-compose.yml ps
docker port caching-lab-redis
docker exec caching-lab-redis redis-cli ping
```

- No output from `docker port` means the container lost its **host port mapping**
  (a known Docker Desktop quirk after a reboot / Docker restart). The container is
  healthy inside, but nothing on your PC can reach `127.0.0.1:6379`.

  Fix — recreate it:

  ```bash
  docker rm -f caching-lab-redis
  npm run cache:redis
  docker port caching-lab-redis     # expect 6379/tcp -> 0.0.0.0:6379
  ```

- `PONG` inside the container + a working `docker port` means Redis is fine and the
  app just needs a restart.

**After a machine reboot:** start Docker Desktop → `npm run cache:redis` →
`npm run cache:dev`. The app retries forever, so it reconnects on its own once
Redis is reachable again.

**Redis answers, but every command takes 10–300 ms (erratic)**

The container can end up in a slow networking state in Docker Desktop. A plain
restart usually fixes it:

```bash
docker restart caching-lab-redis
```

Expected: `ping` ≈ 1–2 ms. If it stays in the hundreds of ms, restart Docker Desktop.

---

## API (module 1 — cache-aside)

| Method | Route | Purpose |
| :--- | :--- | :--- |
| GET | `/api/cache-aside/users` | list users (for the dropdown) |
| GET | `/api/cache-aside/users/:id` | cached read |
| PUT | `/api/cache-aside/users/:id` | write DB → `DEL` key |
| POST | `/api/cache-aside/dev/direct-db-write/:id` | bypass the API, simulate another service |
| DELETE | `/api/cache-aside/cache/:id` | manual eviction |
| POST | `/api/cache-aside/reset` | reseed DB + flush cache |
| GET | `/api/state` | dashboard state (logs, stats, keys) |

## API (module 2 — read-through)

Same routes, different prefix:

| Method | Route | Purpose |
| :--- | :--- | :--- |
| GET | `/api/read-through/users` | list users |
| GET | `/api/read-through/users/:id` | read via `provider.getOrLoad()` |
| PUT | `/api/read-through/users/:id` | write DB → `provider.invalidate()` |
| POST | `/api/read-through/dev/direct-db-write/:id` | bypass the API |
| DELETE | `/api/read-through/cache/:id` | manual eviction |
| POST | `/api/read-through/reset` | reseed DB + flush the `rt:*` keys |

Keys are namespaced per module (`aside:user:1`, `rt:user:1`), so both tabs can
share one Redis and one database without colliding.
