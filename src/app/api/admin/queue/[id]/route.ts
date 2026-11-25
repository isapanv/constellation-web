import { handler, readJson, uuid } from "@/server/http";
import { audit, requireStaff } from "@/server/admin/access";
import { actOnRequest, actionSchema, getRequest } from "@/server/admin/queue";

type P = { id: string };

/** Заявка: бриф, приглашения в роль и кандидаты с телефонами. Просмотр пишется в журнал. */
export const GET = handler<P>(async (req, { id }) => {
  const staff = await requireStaff("queue.read");
  const request = await getRequest(uuid.parse(id));
  await audit(staff, req, "match_request.view", "match_request", request.id);
  return Response.json({ request });
});

/** Действие: take | release | invite (specialistId) | done (note) | cancel (note). */
export const POST = handler<P>(async (req, { id }) => {
  const staff = await requireStaff("queue.work");
  const requestId = uuid.parse(id);
  await actOnRequest(staff, req, requestId, await readJson(req, actionSchema));
  return Response.json({ request: await getRequest(requestId) });
});
