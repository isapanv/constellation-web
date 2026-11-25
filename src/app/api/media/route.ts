import { requireUser } from "@/server/auth";
import { tx } from "@/server/db";
import { fail, handler } from "@/server/http";
import { assertCanUpload, insertMedia, processImage, readUpload } from "@/server/media";

/**
 * Загрузить картинку для портфолио: multipart/form-data, поля file и purpose=portfolio.
 * Аватар загружается отдельно — POST /api/me/avatar.
 * TODO: привязка к работе портфолио (portfolio_media.media_id), когда портфолио переедет с моков на API.
 */
export const POST = handler(async (req) => {
  const userId = await requireUser();
  const { bytes, form } = await readUpload(req);
  if (form.get("purpose") !== "portfolio") fail(400, "Укажите purpose=portfolio. Аватар загружается через /api/me/avatar");
  await assertCanUpload(userId, "portfolio");
  const img = await processImage(bytes, "portfolio");
  const id = await tx((c) => insertMedia(c, userId, "portfolio", img));
  return Response.json({ media: { id, url: `/api/media/${id}`, width: img.width, height: img.height } }, { status: 201 });
});
