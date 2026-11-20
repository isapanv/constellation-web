import { z } from "zod";
import { loadMe, requireUser } from "@/server/auth";
import { tx } from "@/server/db";
import { fail, handler, readJson } from "@/server/http";
import { uniqueSlug } from "@/server/slug";

const schema = z.object({
  displayName: z.string().trim().min(2, "Имя — от 2 символов").max(80),
  client: z.boolean(),
  specialist: z.boolean(),
});

/** Создать профиль после регистрации: имя, адрес страницы и режимы. Повторный вызов обновляет режимы. */
export const POST = handler(async (req) => {
  const userId = await requireUser();
  const b = await readJson(req, schema);
  if (!b.client && !b.specialist) fail(422, "Выберите хотя бы один режим");
  await tx(async (c) => {
    const exists = await c.query(`SELECT 1 FROM profiles WHERE user_id = $1`, [userId]);
    if (exists.rowCount) {
      await c.query(`UPDATE profiles SET display_name = $2, client_mode = $3, specialist_mode = $4 WHERE user_id = $1`, [userId, b.displayName, b.client, b.specialist]);
    } else {
      const slug = await uniqueSlug(c, b.displayName);
      await c.query(
        `INSERT INTO profiles (user_id, display_name, slug, client_mode, specialist_mode) VALUES ($1, $2, $3, $4, $5)`,
        [userId, b.displayName, slug, b.client, b.specialist],
      );
    }
  });
  return Response.json({ me: await loadMe(userId) });
});
