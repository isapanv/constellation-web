/**
 * Доступ к админке и журнал действий сотрудников.
 *
 * Не сотрудник (или не вошёл) — 404, а не 401/403: не подтверждаем, что админка существует.
 * Сотрудник без нужного права — 403 с понятным текстом.
 */
import type { PoolClient } from "pg";
import { type Permission, type StaffRole, can } from "@/lib/admin";
import { clientIp, currentUserId } from "../auth";
import { one, q } from "../db";
import { fail } from "../http";

export type Staff = { userId: string; role: StaffRole };

export async function staffRoleOf(userId: string): Promise<StaffRole | null> {
  const r = await one<{ role: StaffRole }>(`SELECT role FROM staff_members WHERE user_id = $1 AND revoked_at IS NULL`, [userId]);
  return r?.role ?? null;
}

export async function requireStaff(perm: Permission): Promise<Staff> {
  const userId = await currentUserId();
  const role = userId ? await staffRoleOf(userId) : null;
  if (!userId || !role) fail(404, "Не найдено", "not_found");
  if (!can(role, perm)) fail(403, "Для этого действия нужна другая роль сотрудника", "forbidden");
  return { userId: userId!, role: role! };
}

export type EntityType = "user" | "project" | "match_request" | "staff" | "avatar";

/**
 * Запись в журнал. Внутри транзакции передавайте её клиент: тогда действие и запись
 * о нём сохраняются вместе или не сохраняются вовсе.
 * В details не кладём телефоны и тексты брифа — только причины и «было/стало».
 */
export async function audit(
  actor: Staff,
  req: Request,
  action: string,
  entityType: EntityType,
  entityId: string | null,
  details: Record<string, unknown> = {},
  c?: PoolClient,
): Promise<void> {
  await q(
    `INSERT INTO admin_audit_log (actor_id, action, entity_type, entity_id, details, ip) VALUES ($1, $2, $3, $4, $5, $6)`,
    [actor.userId, action, entityType, entityId, JSON.stringify(details), clientIp(req)],
    c,
  );
}
