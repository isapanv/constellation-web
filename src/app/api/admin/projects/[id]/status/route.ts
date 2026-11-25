import { handler, readJson, uuid } from "@/server/http";
import { requireStaff } from "@/server/admin/access";
import { getProject, setProjectStatus, statusSchema } from "@/server/admin/projects";

/** Сменить статус вручную: { status, reason }. Только админ. */
export const POST = handler<{ id: string }>(async (req, { id }) => {
  const staff = await requireStaff("projects.status");
  const projectId = uuid.parse(id);
  const b = await readJson(req, statusSchema);
  await setProjectStatus(staff, req, projectId, b.status, b.reason);
  return Response.json({ project: await getProject(staff, req, projectId) });
});
