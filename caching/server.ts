import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import { cacheAside } from './strategies/cache-aside';
import { log } from './lib/log';
import { listKeys, pingRedis, redis } from './lib/redis';
import { dashboardHtml } from './lib/ui';

const app = express();
const PORT = Number(process.env.CACHE_PORT ?? 3100);

app.use(express.json());

app.get('/', (_req: Request, res: Response) => {
  res.type('html').send(dashboardHtml());
});

// Strategy modules. More get mounted here as each module is built.
app.use('/api/cache-aside', cacheAside);

// The dashboard polls this every ~800ms.
app.get('/api/state', async (req: Request, res: Response) => {
  const after = Number(req.query.after ?? 0) || 0;

  let ping: number | null = null;
  let keys: Awaited<ReturnType<typeof listKeys>> = [];

  try {
    ping = await pingRedis();
    keys = await listKeys('aside:*');
  } catch {
    ping = null;
  }

  res.json({
    now: Date.now(),
    redis: { status: redis.status, ping },
    stats: { aside: log.stats('aside') },
    logs: log.since(after),
    keys,
  });
});

app.post('/api/reset', async (_req: Request, res: Response) => {
  const response = await fetch(`http://127.0.0.1:${PORT}/api/cache-aside/reset`, { method: 'POST' });
  res.status(response.status).json(await response.json().catch(() => ({ ok: false })));
});

// Central error handler so a crash in one strategy never kills the lab.
app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[error]', error);
  log.error('system', error.message);
  res.status(500).json({ error: error.message });
});

app.listen(PORT, () => {
  console.log('');
  console.log('  Redis Caching Lab');
  console.log(`  Dashboard -> http://localhost:${PORT}`);
  console.log(`  Redis     -> ${process.env.REDIS_URL ?? 'redis://127.0.0.1:6379'}`);
  console.log('');
});
