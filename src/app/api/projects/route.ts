import { requireUser } from "@/server/auth";
import { handler, readJson } from "@/server/http";
import { briefSchema, createProject, listProjects } from "@/server/projects";

/** «Мои проекты»: где я заказчик и куда меня пригласили. */
export const GET = handler(async () => {
  const userId = await requireUser();
  return Response.json({ projects: await listProjects(userId) });
});

/** Новый проект-черновик из брифа. */
export const POST = handler(async (req) => {
  const userId = await requireUser();
  const brief = await readJson(req, briefSchema);
  const id = await createProject(userId, brief);
  return Response.json({ id }, { status: 201 });
});
