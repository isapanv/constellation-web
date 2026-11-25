/**
 * Аватар профиля: готовая медведица, своя картинка или ничего.
 * Старую свою картинку при смене аватара удаляем сразу: хранить фото человека дольше нужного незачем (ПДн).
 */
import { z } from "zod";
import { AVATAR_PRESET_IDS, type AvatarRef, avatarFromRow } from "@/lib/avatars";
import { tx } from "./db";
import { fail } from "./http";
import { assertCanUpload, insertMedia, processImage } from "./media";

export const presetSchema = z.object({ preset: z.enum(AVATAR_PRESET_IDS, { message: "Такого аватара нет" }).nullable() });

async function lockProfile(c: Parameters<Parameters<typeof tx>[0]>[0], userId: string) {
  const r = await c.query<{ avatar_media_id: string | null }>(`SELECT avatar_media_id FROM profiles WHERE user_id = $1 FOR UPDATE`, [userId]);
  if (!r.rowCount) fail(404, "Сначала создайте профиль", "no_profile");
  return r.rows[0].avatar_media_id;
}

/** Своя картинка: обрабатываем вне транзакции (это долго), сохраняем и подменяем внутри. */
export async function setAvatarUpload(userId: string, bytes: Buffer): Promise<AvatarRef> {
  await assertCanUpload(userId, "avatar");
  const img = await processImage(bytes, "avatar");
  return tx(async (c) => {
    const old = await lockProfile(c, userId);
    const id = await insertMedia(c, userId, "avatar", img);
    await c.query(`UPDATE profiles SET avatar_media_id = $2, avatar_preset = NULL WHERE user_id = $1`, [userId, id]);
    if (old) await c.query(`DELETE FROM media_files WHERE id = $1`, [old]);
    return avatarFromRow(null, id);
  });
}

/** Готовая медведица или null — убрать аватар совсем. */
export async function setAvatarPreset(userId: string, preset: string | null): Promise<AvatarRef> {
  return tx(async (c) => {
    const old = await lockProfile(c, userId);
    await c.query(`UPDATE profiles SET avatar_preset = $2, avatar_media_id = NULL WHERE user_id = $1`, [userId, preset]);
    if (old) await c.query(`DELETE FROM media_files WHERE id = $1`, [old]);
    return avatarFromRow(preset, null);
  });
}
