import { currentUserId, loadMe } from "@/server/auth";
import { handler } from "@/server/http";

/** Кто вошёл. Гостю — { me: null }, а не 401: так проще шапке и публичным страницам. */
export const GET = handler(async () => {
  const id = await currentUserId();
  return Response.json({ me: id ? await loadMe(id) : null });
});
