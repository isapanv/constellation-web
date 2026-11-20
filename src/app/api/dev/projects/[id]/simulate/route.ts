import { requireUser } from "@/server/auth";
import { fail, handler, uuid } from "@/server/http";
import { simulateResponses } from "@/server/invitations";
import { getProjectDetail } from "@/server/projects";

/** Демо: ответы за специалистов. В продакшне выключено. */
export const POST = handler<{ id: string }>(async (_req, { id }) => {
  if (process.env.NODE_ENV === "production") fail(404, "Не найдено");
  const userId = await requireUser();
  const projectId = uuid.parse(id);
  await simulateResponses(userId, projectId);
  return Response.json(await getProjectDetail(userId, projectId));
});
