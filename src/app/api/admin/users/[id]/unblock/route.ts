import { handler, readJson, uuid } from "@/server/http";
import { requireStaff } from "@/server/admin/access";
import { getUser, reasonSchema, unblockUser } from "@/server/admin/users";

/** Разблокировать: { reason }. */
export const POST = handler<{ id: string }>(async (req, { id }) => {
  const staff = await requireStaff("users.block");
  const userId = uuid.parse(id);
  const { reason } = await readJson(req, reasonSchema);
  await unblockUser(staff, req, userId, reason);
  return Response.json({ user: await getUser(staff, req, userId) });
});
