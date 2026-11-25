import { currentUserId, requireUser } from "@/server/auth";
import { handler, uuid } from "@/server/http";
import { deleteMedia, getMedia } from "@/server/media";

type P = { id: string };

const notFound = () => Response.json({ error: { message: "Файл не найден" } }, { status: 404 });

/**
 * Отдать картинку. Аватары видны всем (их показывают в подборке и на публичном профиле).
 * Картинки портфолио — пока только владельцу.
 * TODO: открыть по portfolio_items.visibility, когда портфолио переедет на API.
 */
export const GET = handler<P>(async (req, { id }) => {
  const parsed = uuid.safeParse(id);
  if (!parsed.success) return notFound();
  const m = await getMedia(parsed.data);
  if (!m) return notFound();
  const isPublic = m.purpose === "avatar";
  if (!isPublic && (await currentUserId()) !== m.ownerId) return notFound(); // 404, а не 403: не подтверждаем, что файл есть

  const headers = {
    "content-type": m.mime,
    // id файла не переиспользуется: новый аватар = новый id, поэтому кэшируем «навсегда»
    "cache-control": isPublic ? "public, max-age=31536000, immutable" : "private, max-age=3600",
    etag: m.etag,
    "x-content-type-options": "nosniff",
    "content-security-policy": "default-src 'none'; sandbox",
  };
  if (req.headers.get("if-none-match") === m.etag) return new Response(null, { status: 304, headers });
  return new Response(new Uint8Array(m.data), { headers });
});

export const DELETE = handler<P>(async (_req, { id }) => {
  const userId = await requireUser();
  await deleteMedia(userId, uuid.parse(id));
  return new Response(null, { status: 204 });
});
