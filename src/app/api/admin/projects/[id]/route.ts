import { handler, uuid } from "@/server/http";
import { requireStaff } from "@/server/admin/access";
import { getProject } from "@/server/admin/projects";

/** Проект глазами сотрудника: роли, приглашения, ручной подбор, история действий. */
export const GET = handler<{ id: string }>(async (req, { id }) => {
  const staff = await requireStaff("projects.read");
  return Response.json({ project: await getProject(staff, req, uuid.parse(id)) });
});
