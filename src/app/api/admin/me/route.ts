import { one } from "@/server/db";
import { handler } from "@/server/http";
import { requireStaff } from "@/server/admin/access";

/** Кто я в админке. Не сотрудник — 404: админку не показываем и не подтверждаем, что она есть. */
export const GET = handler(async () => {
  const staff = await requireStaff("dashboard.read");
  const p = await one<{ display_name: string }>(`SELECT display_name FROM profiles WHERE user_id = $1`, [staff.userId]);
  return Response.json({ staff: { userId: staff.userId, role: staff.role, displayName: p?.display_name ?? "Сотрудник" } });
});
