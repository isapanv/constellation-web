import { handler } from "@/server/http";
import { requireStaff } from "@/server/admin/access";
import { getSummary } from "@/server/admin/overview";

/** Сводка: очередь ручного подбора, пользователи, проекты по статусам, аватары на проверке. */
export const GET = handler(async () => {
  const staff = await requireStaff("dashboard.read");
  return Response.json({ summary: await getSummary(staff.userId) });
});
