import { requireUser } from "@/server/auth";
import { handler, readJson, uuid } from "@/server/http";
import { briefSchema, getProjectDetail, updateProject } from "@/server/projects";

type P = { id: string };

export const GET = handler<P>(async (_req, { id }) => {
  const userId = await requireUser();
  return Response.json(await getProjectDetail(userId, uuid.parse(id)));
});

/** Сохранить бриф. После подбора создаётся новая версия брифа, проект возвращается в черновик. */
export const PUT = handler<P>(async (req, { id }) => {
  const userId = await requireUser();
  const brief = await readJson(req, briefSchema);
  await updateProject(userId, uuid.parse(id), brief);
  return Response.json(await getProjectDetail(userId, id));
});
