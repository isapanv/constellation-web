import { loadMe, requireUser } from "@/server/auth";
import { handler, readJson } from "@/server/http";
import { getMyProfile, profileSchema, saveMyProfile } from "@/server/profile";

/** Мой профиль: основное, режимы, роли и ставки специалиста. */
export const GET = handler(async () => {
  const userId = await requireUser();
  return Response.json({ profile: await getMyProfile(userId) });
});

export const PUT = handler(async (req) => {
  const userId = await requireUser();
  const profile = await saveMyProfile(userId, await readJson(req, profileSchema));
  return Response.json({ profile, me: await loadMe(userId) });
});
