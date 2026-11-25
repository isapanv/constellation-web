import { z } from "zod";
import { handler } from "@/server/http";
import { requireStaff } from "@/server/admin/access";
import { readAudit } from "@/server/admin/overview";

const schema = z.object({
  entityType: z.enum(["user", "project", "match_request", "staff", "avatar"]).optional(),
  entityId: z.uuid().optional(),
  actorId: z.uuid().optional(),
  before: z.string().regex(/^\d+$/).optional(),
  views: z.enum(["0", "1"]).default("1"),
});

/** Журнал действий сотрудников, новые сверху, по 100. ?before=<id> — следующая страница; ?views=0 — без просмотров. */
export const GET = handler(async (req) => {
  await requireStaff("audit.read");
  const f = schema.parse(Object.fromEntries(new URL(req.url).searchParams));
  const entries = await readAudit({ ...f, skipViews: f.views === "0", limit: 100 });
  return Response.json({ entries, nextBefore: entries.length === 100 ? entries[entries.length - 1].id : null });
});
