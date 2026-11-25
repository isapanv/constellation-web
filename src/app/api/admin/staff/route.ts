import { handler, readJson } from "@/server/http";
import { requireStaff } from "@/server/admin/access";
import { grantRole, grantSchema, listStaff } from "@/server/admin/staff";

/** Сотрудники: действующие и бывшие. */
export const GET = handler(async () => {
  await requireStaff("staff.manage");
  return Response.json({ staff: await listStaff() });
});

/** Выдать или поменять роль по телефону: { phone, role }. */
export const POST = handler(async (req) => {
  const me = await requireStaff("staff.manage");
  const b = await readJson(req, grantSchema);
  await grantRole(me, req, b.phone, b.role);
  return Response.json({ staff: await listStaff() }, { status: 201 });
});
