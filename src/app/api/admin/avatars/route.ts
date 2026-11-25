import { handler } from "@/server/http";
import { requireStaff } from "@/server/admin/access";
import { listAvatars } from "@/server/admin/avatars";

/** Свои фото в аватарах. ?all=1 — вместе с уже проверенными. */
export const GET = handler(async (req) => {
  await requireStaff("avatars.moderate");
  const all = new URL(req.url).searchParams.get("all") === "1";
  return Response.json({ avatars: await listAvatars(!all) });
});
