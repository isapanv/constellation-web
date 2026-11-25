import { z } from "zod";
import { requireUser } from "@/server/auth";
import { handler, readJson, uuid } from "@/server/http";
import { respond } from "@/server/invitations";

const schema = z.object({ accept: z.boolean(), reason: z.string().trim().max(300).optional() });

/** Ответ специалиста на приглашение: принять или отказаться. */
export const POST = handler<{ id: string }>(async (req, { id }) => {
  const userId = await requireUser();
  const b = await readJson(req, schema);
  await respond(userId, uuid.parse(id), b.accept, b.reason);
  return Response.json({ ok: true });
});
