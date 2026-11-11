/**
 * Tiny in-memory event log + per-namespace counters.
 *
 * The dashboard polls /api/state and renders whatever is in here, so every
 * cache decision the code makes becomes visible in the browser.
 */

export type LogType =
  | 'hit'
  | 'miss'
  | 'set'
  | 'del'
  | 'db-read'
  | 'db-write'
  | 'info'
  | 'error';

export interface LogEntry {
  id: number;
  ts: number;
  type: LogType;
  ns: string;
  msg: string;
  ms?: number;
}

export interface NsStats {
  hits: number;
  misses: number;
  sets: number;
  dels: number;
  dbReads: number;
  dbWrites: number;
  requests: number;
  totalMs: number;
  lastMs: number;
}

const MAX_ENTRIES = 400;

const buffer: LogEntry[] = [];
const stats = new Map<string, NsStats>();
let nextId = 1;

function counters(ns: string): NsStats {
  let value = stats.get(ns);
  if (!value) {
    value = {
      hits: 0,
      misses: 0,
      sets: 0,
      dels: 0,
      dbReads: 0,
      dbWrites: 0,
      requests: 0,
      totalMs: 0,
      lastMs: 0,
    };
    stats.set(ns, value);
  }
  return value;
}

function emit(type: LogType, ns: string, msg: string, ms?: number): void {
  buffer.push({ id: nextId++, ts: Date.now(), type, ns, msg, ms });
  if (buffer.length > MAX_ENTRIES) buffer.splice(0, buffer.length - MAX_ENTRIES);
}

export const log = {
  hit(ns: string, key: string, ms: number): void {
    emit('hit', ns, `GET ${key} -> HIT`, ms);
    counters(ns).hits++;
  },

  miss(ns: string, key: string, ms: number): void {
    emit('miss', ns, `GET ${key} -> MISS`, ms);
    counters(ns).misses++;
  },

  set(ns: string, key: string, ttl: number, ms: number): void {
    emit('set', ns, `SET ${key} EX ${ttl}`, ms);
    counters(ns).sets++;
  },

  del(ns: string, key: string, ms: number): void {
    emit('del', ns, `DEL ${key}`, ms);
    counters(ns).dels++;
  },

  dbRead(ns: string, sql: string, ms: number): void {
    emit('db-read', ns, `SELECT ${sql}`, ms);
    counters(ns).dbReads++;
  },

  dbWrite(ns: string, sql: string, ms: number): void {
    emit('db-write', ns, `UPDATE ${sql}`, ms);
    counters(ns).dbWrites++;
  },

  info(ns: string, msg: string): void {
    emit('info', ns, msg);
  },

  error(ns: string, msg: string): void {
    emit('error', ns, msg);
  },

  /** Records end-to-end request time (used for the "avg latency" card). */
  request(ns: string, ms: number): void {
    const c = counters(ns);
    c.requests++;
    c.totalMs += ms;
    c.lastMs = ms;
  },

  since(afterId: number): LogEntry[] {
    return buffer.filter((entry) => entry.id > afterId);
  },

  stats(ns: string): NsStats {
    return { ...counters(ns) };
  },

  reset(): void {
    buffer.length = 0;
    stats.clear();
    nextId = 1;
  },

  /** Clears one module's log lines and counters, leaving the others intact. */
  resetNamespace(ns: string): void {
    for (let i = buffer.length - 1; i >= 0; i -= 1) {
      if (buffer[i].ns === ns) buffer.splice(i, 1);
    }
    stats.delete(ns);
  },
};
