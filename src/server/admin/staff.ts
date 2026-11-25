/**
 * Роли сотрудников. Выдаёт и отзывает только админ.
 * Защита от «запереть всех снаружи»: админ не может снять роль с себя, и последний админ остаётся.
 */
import { z } from "zod";
import { STAFF_ROLES, type StaffRole, maskPhone } from "@/lib/admin";
import type { StaffMemberItem } from "@/lib/api/admin-types";
import { normalizePhone } from "../auth";
import { q, tx } from "../db";
import { fail } from "../http";
import { type Staff, audit } from "./access";

export async function listStaff(): Promise<StaffMemberItem[]> {
  const rows = await q<{
    id: string;
    user_id: string;
    name: string | null;
    phone: string | null;
    role: StaffRole;
    granted_at: string;
    granted_by: string | null;
    revoked_at: string | null;
    revoked_by: string | null;
  }>(
    `SELECT s.id, s.user_id, p.display_name AS name, u.phone, s.role, s.granted_at::text, g.display_name AS granted_by,
            s.revoked_at::text, rv.display_name AS revoked_by
     FROM staff_members s
     JOIN users u ON u.id = s.user_id
     LEFT JOIN profiles p ON p.user_id = s.user_id
     LEFT JOIN profiles g ON g.user_id = s.granted_by
     LEFT JOIN profiles rv ON rv.user_id = s.revoked_by
     ORDER BY s.revoked_at IS NOT NULL, s.granted_at DESC
     LIMIT 200`,
  );
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    name: r.name,
    phoneMasked: maskPhone(r.phone),
    role: r.role,
    grantedAt: r.granted_at,
    grantedBy: r.granted_by ?? "консоль (скрипт)",
    revokedAt: r.revoked_at,
    revokedBy: r.revoked_by,
  }));
}

export const grantSchema = z.object({ phone: z.string().min(10).max(30), role: z.enum(STAFF_ROLES) });

/** Выдать или поменять роль. Человек должен быть уже зарегистрирован. */
export async function grantRole(staff: Staff, req: Request, rawPhone: string, role: StaffRole): Promise<void> {
  const phone = normalizePhone(rawPhone);
  await tx(async (c) => {
    const u = await c.query<{ id: string; status: string }>(`SELECT id, status FROM users WHERE phone = $1`, [phone]);
    if (!u.rowCount) fail(404, "С этим номером никто не зарегистрирован. Попросите человека сначала войти на сайт", "no_account");
    if (u.rows[0].status !== "active") fail(409, "Аккаунт заблокирован или удалён", "not_active");
    const userId = u.rows[0].id;
    if (userId === staff.userId) fail(409, "Свою роль поменять нельзя — попросите другого админа", "self");

    const old = await c.query<{ role: StaffRole }>(
      `UPDATE staff_members SET revoked_at = now(), revoked_by = $2 WHERE user_id = $1 AND revoked_at IS NULL RETURNING role`,
      [userId, staff.userId],
    );
    if (old.rows[0]?.role === role) fail(409, "У человека уже эта роль", "same_role");
    await c.query(`INSERT INTO staff_members (user_id, role, granted_by) VALUES ($1, $2, $3)`, [userId, role, staff.userId]);
    await audit(staff, req, "staff.grant", "staff", userId, { role, previous: old.rows[0]?.role ?? null }, c);
  });
}

export async function revokeRole(staff: Staff, req: Request, userId: string): Promise<void> {
  if (userId === staff.userId) fail(409, "Свою роль снять нельзя — попросите другого админа", "self");
  await tx(async (c) => {
    // Блокируем строки админов, чтобы два одновременных отзыва не оставили систему без админа
    await c.query(`SELECT id FROM staff_members WHERE role = 'admin' AND revoked_at IS NULL FOR UPDATE`);
    const r = await c.query<{ role: StaffRole }>(
      `UPDATE staff_members SET revoked_at = now(), revoked_by = $2 WHERE user_id = $1 AND revoked_at IS NULL RETURNING role`,
      [userId, staff.userId],
    );
    if (!r.rowCount) fail(404, "У человека нет роли сотрудника");
    const admins = await c.query<{ n: number }>(`SELECT count(*)::int AS n FROM staff_members WHERE role = 'admin' AND revoked_at IS NULL`);
    if (admins.rows[0].n === 0) fail(409, "Нельзя отозвать роль у последнего админа", "last_admin");
    await audit(staff, req, "staff.revoke", "staff", userId, { role: r.rows[0].role }, c);
  });
}
