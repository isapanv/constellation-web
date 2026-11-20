/**
 * Справочники из БД: перевод кодов фронта (director, ad, fashion…) в id и обратно.
 * Справочники маленькие и меняются миграциями — держим в памяти процесса.
 */
import { q } from "./db";

type Dict = { byCode: Map<string, number>; byId: Map<number, string> };
export type Dicts = { roles: Dict; formats: Dict; tags: Dict; cities: { byName: Map<string, number>; byId: Map<number, string> } };

let cache: Promise<Dicts> | null = null;

async function load(): Promise<Dicts> {
  const mk = (rows: { id: number; code: string }[]): Dict => ({
    byCode: new Map(rows.map((r) => [r.code, r.id])),
    byId: new Map(rows.map((r) => [r.id, r.code])),
  });
  const [roles, formats, tags, cities] = await Promise.all([
    q<{ id: number; code: string }>(`SELECT id, code FROM roles`),
    q<{ id: number; code: string }>(`SELECT id, code FROM formats`),
    q<{ id: number; code: string }>(`SELECT id, code FROM style_tags`),
    q<{ id: number; name: string }>(`SELECT id, name FROM cities`),
  ]);
  return {
    roles: mk(roles),
    formats: mk(formats),
    tags: mk(tags),
    cities: { byName: new Map(cities.map((c) => [c.name, c.id])), byId: new Map(cities.map((c) => [c.id, c.name])) },
  };
}

export function dicts(): Promise<Dicts> {
  cache ??= load().catch((e) => {
    cache = null;
    throw e;
  });
  return cache;
}
