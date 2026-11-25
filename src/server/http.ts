/**
 * Общие вещи для Route Handlers: ошибки, разбор тела запроса, защита от CSRF.
 */
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export const fail = (status: number, message: string, code?: string): never => {
  throw new HttpError(status, message, code);
};

type Ctx<P> = { params: Promise<P> };

/**
 * Обёртка обработчика: единый формат ошибок { error: { message, code } }.
 * Ошибки БД переводим в понятные статусы: уникальность → 409, проверки и триггеры → 422.
 */
export function handler<P = Record<string, never>>(fn: (req: Request, params: P) => Promise<Response>) {
  return async (req: Request, ctx: Ctx<P>): Promise<Response> => {
    try {
      if (req.method !== "GET") assertSameOrigin(req);
      return await fn(req, await ctx.params);
    } catch (e) {
      unstable_rethrow(e); // служебные исключения Next.js (например, при сборке) не перехватываем
      if (e instanceof HttpError) return Response.json({ error: { message: e.message, code: e.code } }, { status: e.status });
      if (e instanceof z.ZodError) {
        // Свои сообщения в схемах пишем по-русски — их и показываем; служебные английские заменяем общим текстом
        const own = e.issues.find((i) => /[а-яё]/i.test(i.message))?.message;
        return Response.json({ error: { message: own ?? "Проверьте данные формы", code: "validation", issues: e.issues } }, { status: 400 });
      }
      const pg = e as { code?: string; message?: string; constraint?: string };
      if (pg.code === "23505") return Response.json({ error: { message: "Такая запись уже есть", code: "conflict" } }, { status: 409 });
      if (pg.code === "23514" || pg.code === "23503")
        return Response.json({ error: { message: pg.message ?? "Данные не прошли проверку", code: pg.constraint ?? "check" } }, { status: 422 });
      console.error(e);
      return Response.json({ error: { message: "Внутренняя ошибка сервера" } }, { status: 500 });
    }
  };
}

/** Тело запроса в JSON по схеме zod. */
export async function readJson<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  if (!req.headers.get("content-type")?.includes("application/json")) fail(415, "Ожидается JSON");
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    fail(400, "Некорректный JSON");
  }
  return schema.parse(raw);
}

/**
 * Защита от CSRF: изменяющие запросы принимаем только со своего сайта.
 * Плюс cookie сессии SameSite=Lax и обязательный JSON — форма с чужого сайта так не отправит.
 */
function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return; // запросы не из браузера (curl, тесты)
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host || new URL(origin).host !== host) fail(403, "Запрос с чужого сайта");
}

export const uuid = z.uuid();
