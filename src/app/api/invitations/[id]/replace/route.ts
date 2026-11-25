import { requireUser } from "@/server/auth";
import { handler, uuid } from "@/server/http";
import { replaceInvitation } from "@/server/invitations";

/** Пригласить замену после отказа: следующий по баллу кандидат на ту же роль. */
export const POST = handler<{ id: string }>(async (_req, { id }) => {
  const userId = await requireUser();
  await replaceInvitation(userId, uuid.parse(id));
  return Response.json({ ok: true }, { status: 201 });
});
