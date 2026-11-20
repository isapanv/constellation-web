/**
 * Возврат после входа или регистрации: /signup?next=/u/anna → после кода снова /u/anna.
 * Читаем адрес в момент клика, а не при отрисовке: так не нужен useSearchParams
 * и обёртка <Suspense> на страницах входа.
 */

/** Только свои страницы: «/что-то», но не «//evil.ru» и не «/\evil.ru» (защита от открытого редиректа). */
export function safeNext(raw: string | null | undefined): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return null;
  if (/[\u0000-\u001f]/.test(raw)) return null;
  return raw;
}

function currentNext(search?: string): string | null {
  const s = search ?? (typeof window === "undefined" ? "" : window.location.search);
  return safeNext(new URLSearchParams(s).get("next"));
}

/** Куда вести после успешного шага: next из адреса, иначе fallback. */
export function getNextPath(fallback: string, search?: string): string {
  return currentNext(search) ?? fallback;
}

/** Передать next дальше по цепочке (регистрация → онбординг → профиль). */
export function withNext(path: string, search?: string): string {
  const next = currentNext(search);
  if (!next) return path;
  return `${path}${path.includes("?") ? "&" : "?"}next=${encodeURIComponent(next)}`;
}
