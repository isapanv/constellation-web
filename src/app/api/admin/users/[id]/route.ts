import { handler, uuid } from "@/server/http";
import { requireStaff } from "@/server/admin/access";
import { getUser } from "@/server/admin/users";

/** Карточка пользователя с полным телефоном. Каждый просмотр — запись в журнал. */
export const GET = handler<{ id: string }>(async (req, { id }) => {
  const staff = await requireStaff("users.read");
  return Response.json({ user: await getUser(staff, req, uuid.parse(id)) });
});
