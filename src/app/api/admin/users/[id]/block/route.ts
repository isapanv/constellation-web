import { handler, readJson, uuid } from "@/server/http";
import { requireStaff } from "@/server/admin/access";
import { blockUser, getUser, reasonSchema } from "@/server/admin/users";

/** Заблокировать: { reason }. Сессии и открытые приглашения специалиста отзываются. */
export const POST = handler<{ id: string }>(async (req, { id }) => {
  const staff = await requireStaff("users.block");
  const userId = uuid.parse(id);
  const { reason } = await readJson(req, reasonSchema);
  const { withdrawn } = await blockUser(staff, req, userId, reason);
  return Response.json({ withdrawn, user: await getUser(staff, req, userId) });
});
