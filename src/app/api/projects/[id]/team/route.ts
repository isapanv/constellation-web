import { requireUser } from "@/server/auth";
import { handler, uuid } from "@/server/http";
import { confirmTeam } from "@/server/invitations";
import { getProjectDetail } from "@/server/projects";

/** Зафиксировать команду, когда все роли закрыты. */
export const POST = handler<{ id: string }>(async (_req, { id }) => {
  const userId = await requireUser();
  const projectId = uuid.parse(id);
  await confirmTeam(userId, projectId);
  return Response.json(await getProjectDetail(userId, projectId));
});
