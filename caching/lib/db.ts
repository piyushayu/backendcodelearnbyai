/**
 * A deliberately SLOW fake database.
 *
 * There is no Postgres here on purpose: the lesson is about caching, not SQL.
 * Every read takes ~260ms and every write ~240ms (plus jitter), and both are
 * persisted to caching/.data/db.json so you can still see the data after a
 * server restart.
 *
 * If this were instant, cache hits would not feel impressive. 260ms is roughly
 * a real-world indexed query + network round trip.
 */

import fs from 'node:fs';
import path from 'node:path';
import { log } from './log';

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  updatedAt: string;
}

const DATA_DIR = path.join(__dirname, '..', '.data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const READ_LATENCY_MS = 260;
const WRITE_LATENCY_MS = 240;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const jitter = (base: number) => base + Math.floor(Math.random() * 40) - 20;

let rows: Record<string, User> | null = null;

/** Serialises writes so two concurrent requests can't corrupt the JSON file. */
let writeQueue: Promise<unknown> = Promise.resolve();
function withWriteLock<T>(fn: () => T): Promise<T> {
  const run = writeQueue.then(fn, fn);
  writeQueue = run.catch(() => undefined);
  return run;
}

function seed(): Record<string, User> {
  const now = new Date().toISOString();
  return {
    '1': { id: '1', name: 'Piyush Singh', email: 'piyush@example.com', role: 'admin', updatedAt: now },
    '2': { id: '2', name: 'Ada Lovelace', email: 'ada@example.com', role: 'user', updatedAt: now },
    '3': { id: '3', name: 'Linus Torvalds', email: 'linus@example.com', role: 'user', updatedAt: now },
  };
}

function persist(): void {
  if (!rows) return;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(rows, null, 2));
}

function load(): Record<string, User> {
  if (rows) return rows;

  if (fs.existsSync(DB_FILE)) {
    try {
      rows = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) as Record<string, User>;
      return rows;
    } catch {
      // corrupted file -> fall through and reseed
    }
  }

  rows = seed();
  persist();
  return rows;
}

export const db = {
  async findUser(ns: string, id: string): Promise<User | null> {
    const started = Date.now();
    await sleep(jitter(READ_LATENCY_MS));

    const row = load()[id] ?? null;
    log.dbRead(ns, `users WHERE id = '${id}'`, Date.now() - started);

    return row ? { ...row } : null;
  },

  async saveUser(ns: string, user: User): Promise<User> {
    const started = Date.now();
    await sleep(jitter(WRITE_LATENCY_MS));

    await withWriteLock(() => {
      const data = load();
      data[user.id] = { ...user };
      persist();
    });

    log.dbWrite(ns, `users SET name = '${user.name}' WHERE id = '${user.id}'`, Date.now() - started);
    return { ...user };
  },

  /** Fast, un-logged read used by the dashboard to fill its user dropdown. */
  listUsers(): User[] {
    return Object.values(load())
      .map((user) => ({ ...user }))
      .sort((a, b) => a.id.localeCompare(b.id));
  },

  /** Not exposed over HTTP: used by the reset button to restore the fixtures. */
  reset(): void {
    rows = seed();
    persist();
  },
};
