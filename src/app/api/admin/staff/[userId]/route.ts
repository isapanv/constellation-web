import { handler, uuid } from "@/server/http";
import { requireStaff } from "@/server/admin/access";
import { listStaff, revokeRole } from "@/server/admin/staff";

/** Отозвать роль сотрудника. */
export const DELETE = handler<{ userId: string }>(async (req, { userId }) => {
  const me = await requireStaff("staff.manage");
  await revokeRole(me, req, uuid.parse(userId));
  return Response.json({ staff: await listStaff() });
});
