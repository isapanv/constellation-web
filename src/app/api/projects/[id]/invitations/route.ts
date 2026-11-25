import { z } from "zod";
import { requireUser } from "@/server/auth";
import { handler, readJson, uuid } from "@/server/http";
import { sendInvitations } from "@/server/invitations";
import { getProjectDetail } from "@/server/projects";

const schema = z.object({
  tier: z.enum(["economy", "optimum", "premium"]),
  members: z.array(z.object({ slotKey: z.uuid(), specialistId: z.uuid() })).min(1).max(60),
});

/** Отправить приглашения выбранному составу. */
export const POST = handler<{ id: string }>(async (req, { id }) => {
  const userId = await requireUser();
  const projectId = uuid.parse(id);
  await sendInvitations(userId, projectId, await readJson(req, schema));
  return Response.json(await getProjectDetail(userId, projectId), { status: 201 });
});
