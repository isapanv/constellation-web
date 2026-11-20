import { requireUser } from "@/server/auth";
import { handler, readJson } from "@/server/http";
import { getMyWorkStyle, saveMyWorkStyle, workStyleSchema } from "@/server/profile";

/** Мой стиль работы: заявленные предпочтения (не психотест) и условия тестовых заданий. */
export const GET = handler(async () => {
  const userId = await requireUser();
  return Response.json({ workStyle: await getMyWorkStyle(userId) });
});

export const PUT = handler(async (req) => {
  const userId = await requireUser();
  return Response.json({ workStyle: await saveMyWorkStyle(userId, await readJson(req, workStyleSchema)) });
});
