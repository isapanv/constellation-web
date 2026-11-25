import { requireUser } from "@/server/auth";
import { presetSchema, setAvatarPreset, setAvatarUpload } from "@/server/avatar";
import { handler, readJson } from "@/server/http";
import { readUpload } from "@/server/media";
import { avatarUrl } from "@/lib/avatars";

/** Загрузить свою картинку в аватар: multipart/form-data, поле file. */
export const POST = handler(async (req) => {
  const userId = await requireUser();
  const { bytes } = await readUpload(req);
  const avatar = await setAvatarUpload(userId, bytes);
  return Response.json({ avatar, avatarUrl: avatarUrl(avatar) });
});

/** Выбрать готовую медведицу ({ preset: "director" }) или убрать аватар ({ preset: null }). */
export const PUT = handler(async (req) => {
  const userId = await requireUser();
  const { preset } = await readJson(req, presetSchema);
  const avatar = await setAvatarPreset(userId, preset);
  return Response.json({ avatar, avatarUrl: avatarUrl(avatar) });
});
