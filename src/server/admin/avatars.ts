/**
 * Модерация аватаров. Сейчас своё фото публикуется сразу (открытый вопрос №13),
 * поэтому это постмодерация: сотрудник просматривает новые фото и сбрасывает неподходящие.
 * Решение пишем и в moderation_events (история сущности), и в журнал сотрудников.
 */
import type { AvatarReviewItem } from "@/lib/api/admin-types";
import { q, tx } from "../db";
import { fail } from "../http";
import { type Staff, audit } from "./access";

export async function listAvatars(onlyPending: boolean): Promise<AvatarReviewItem[]> {
  const rows = await q<{ user_id: string; display_name: string; slug: string; media_id: string; uploaded_at: string; decision: "approve" | "reject" | null }>(
    `SELECT p.user_id, p.display_name, p.slug, m.id AS media_id, m.created_at::text AS uploaded_at,
            (SELECT e.action::text FROM moderation_events e
             WHERE e.entity_type = 'profile' AND e.entity_id = p.user_id AND e.created_at >= m.created_at
             ORDER BY e.created_at DESC LIMIT 1) AS decision
     FROM profiles p JOIN media_files m ON m.id = p.avatar_media_id
     JOIN users u ON u.id = p.user_id AND u.status <> 'deleted'
     ORDER BY m.created_at DESC
     LIMIT 200`,
  );
  return rows
    .filter((r) => !onlyPending || !r.decision)
    .map((r) => ({ userId: r.user_id, name: r.display_name, slug: r.slug, url: `/api/media/${r.media_id}`, uploadedAt: r.uploaded_at, decision: r.decision }));
}

export async function approveAvatar(staff: Staff, req: Request, userId: string): Promise<void> {
  await tx(async (c) => {
    const r = await c.query<{ avatar_media_id: string | null }>(`SELECT avatar_media_id FROM profiles WHERE user_id = $1`, [userId]);
    if (!r.rows[0]?.avatar_media_id) fail(409, "У пользователя уже нет своего фото", "no_photo");
    await c.query(`INSERT INTO moderation_events (entity_type, entity_id, moderator_id, action) VALUES ('profile', $1, $2, 'approve')`, [userId, staff.userId]);
    await audit(staff, req, "avatar.approve", "avatar", userId, {}, c);
  });
}

/** Сброс: фото удаляется физически (это ПДн), вместо него — пустой аватар с инициалами. */
export async function resetAvatar(staff: Staff, req: Request, userId: string, reason: string): Promise<void> {
  await tx(async (c) => {
    const r = await c.query<{ avatar_media_id: string | null }>(`SELECT avatar_media_id FROM profiles WHERE user_id = $1 FOR UPDATE`, [userId]);
    const mediaId = r.rows[0]?.avatar_media_id;
    if (!mediaId) fail(409, "У пользователя уже нет своего фото", "no_photo");
    await c.query(`UPDATE profiles SET avatar_media_id = NULL, avatar_preset = NULL WHERE user_id = $1`, [userId]);
    await c.query(`DELETE FROM media_files WHERE id = $1`, [mediaId]);
    await c.query(`INSERT INTO moderation_events (entity_type, entity_id, moderator_id, action, comment) VALUES ('profile', $1, $2, 'reject', $3)`, [
      userId,
      staff.userId,
      reason,
    ]);
    await audit(staff, req, "avatar.reset", "avatar", userId, { reason }, c);
  });
}
