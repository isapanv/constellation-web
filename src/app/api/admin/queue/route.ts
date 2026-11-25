import { z } from "zod";
import { handler } from "@/server/http";
import { requireStaff } from "@/server/admin/access";
import { listQueue } from "@/server/admin/queue";

const filter = z.enum(["active", "mine", "closed"]).catch("active");

/** Очередь ручного подбора. ?filter=active (по умолчанию) | mine | closed */
export const GET = handler(async (req) => {
  const staff = await requireStaff("queue.read");
  const f = filter.parse(new URL(req.url).searchParams.get("filter") ?? "active");
  return Response.json({ requests: await listQueue(staff.userId, f) });
});
