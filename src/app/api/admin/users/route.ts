import { handler } from "@/server/http";
import { requireStaff } from "@/server/admin/access";
import { listSchema, listUsers } from "@/server/admin/users";

/** Поиск пользователей: ?q=имя|телефон|адрес&status=&kind=&page=. Телефоны в списке замаскированы. */
export const GET = handler(async (req) => {
  await requireStaff("users.read");
  const f = listSchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return Response.json(await listUsers(f));
});
