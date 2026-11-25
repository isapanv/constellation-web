import { z } from "zod";
import { handler, readJson, uuid } from "@/server/http";
import { requireStaff } from "@/server/admin/access";
import { approveAvatar, resetAvatar } from "@/server/admin/avatars";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("reset"), reason: z.string().trim().min(3, "Укажите причину").max(500) }),
]);

/** Решение по фото: approve — оставить; reset — удалить фото, причина обязательна. */
export const POST = handler<{ userId: string }>(async (req, { userId }) => {
  const staff = await requireStaff("avatars.moderate");
  const id = uuid.parse(userId);
  const b = await readJson(req, schema);
  if (b.action === "approve") await approveAvatar(staff, req, id);
  else await resetAvatar(staff, req, id, b.reason);
  return Response.json({ ok: true });
});
