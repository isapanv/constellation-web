/**
 * Подключение к PostgreSQL. Строка подключения — в .env.local:
 *   DATABASE_URL=postgres://postgres:ПАРОЛЬ@localhost:5432/sozvezdie
 * Только для серверного кода (Route Handlers в src/app/api).
 */
import { Pool, type PoolClient, type QueryResultRow } from "pg";

const g = globalThis as unknown as { __szPool?: Pool };

/** Пул создаём при первом запросе: так сборка не требует базы. В dev переживает горячую перезагрузку. */
function pool(): Pool {
  if (!g.__szPool) {
    if (!process.env.DATABASE_URL) throw new Error("Не задан DATABASE_URL в .env.local");
    g.__szPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
  }
  return g.__szPool;
}

type Queryable = Pool | PoolClient;

/** Все строки. Даты в запросах отдаём как text (::text), чтобы не было сдвига часового пояса. */
export async function q<T extends QueryResultRow>(text: string, params: unknown[] = [], c: Queryable = pool()): Promise<T[]> {
  const r = await c.query<T>(text, params);
  return r.rows;
}

/** Одна строка или null. */
export async function one<T extends QueryResultRow>(text: string, params: unknown[] = [], c: Queryable = pool()): Promise<T | null> {
  const rows = await q<T>(text, params, c);
  return rows[0] ?? null;
}

/** Транзакция: всё внутри fn либо применяется целиком, либо откатывается. */
export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool().connect();
  try {
    await c.query("BEGIN");
    const res = await fn(c);
    await c.query("COMMIT");
    return res;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
