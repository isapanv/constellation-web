import { handler } from "@/server/http";
import { requireStaff } from "@/server/admin/access";
import { listProjects, listSchema } from "@/server/admin/projects";

/** Все проекты: ?q=название|заказчик&status=&page= */
export const GET = handler(async (req) => {
  await requireStaff("projects.read");
  const f = listSchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return Response.json(await listProjects(f));
});
