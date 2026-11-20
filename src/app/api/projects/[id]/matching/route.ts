import { requireUser } from "@/server/auth";
import { handler, uuid } from "@/server/http";
import { runMatching } from "@/server/matching";

/** Подобрать три состава по текущей версии брифа. */
export const POST = handler<{ id: string }>(async (_req, { id }) => {
  const userId = await requireUser();
  return Response.json(await runMatching(userId, uuid.parse(id)));
});
