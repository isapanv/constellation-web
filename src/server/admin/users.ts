/**
 * Пользователи в админке: поиск, карточка, блокировка.
 * В списке телефон замаскирован; целиком — только в карточке, и каждый её просмотр пишется в журнал (152-ФЗ).
 */
import { z } from "zod";
import { type StaffRole, maskPhone } from "@/lib/admin";
import type { AdminUserDetail, AdminUserListItem, UserStatus } from "@/lib/api/admin-types";
import type { ProjectStatus } from "@/lib/api/types";
import { avatarFromRow, avatarUrl } from "@/lib/avatars";
import { one, q, tx } from "../db";
import { fail } from "../http";
import { type Staff, audit } from "./access";
import { readAudit } from "./overview";

export const PAGE = 50;

export const listSchema = z.object({
  q: z.string().trim().max(80).optional(),
  status: z.enum(["active", "blocked", "deleted", "all"]).default("all"),
  kind: z.enum(["all", "client", "specialist", "staff"]).default("all"),
  page: z.coerce.number().int().min(0).max(1000).default(0),
});

export async function listUsers(f: z.infer<typeof listSchema>): Promise<{ users: AdminUserListItem[]; hasMore: boolean }> {
  const where: string[] = [];
  const params: unknown[] = [];
  const p = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };
  if (f.status !== "all") where.push(`u.status = ${p(f.status)}`);
  if (f.kind === "client") where.push(`pr.client_mode`);
  if (f.kind === "specialist") where.push(`pr.specialist_mode`);
  if (f.kind === "staff") where.push(`sm.role IS NOT NULL`);
  if (f.q) {
    const digits = f.q.replace(/\D/g, "");
    // Телефон ищем по цифрам (от 4), имя и адрес профиля — по подстроке
    const byPhone = digits.length >= 4 ? ` OR u.phone LIKE ${p("%" + digits.replace(/^8(?=\d{10}$)/, "7") + "%")}` : "";
    where.push(`(pr.display_name ILIKE ${p("%" + f.q + "%")} OR pr.slug ILIKE ${p("%" + f.q + "%")}${byPhone})`);
  }
  const rows = await q<{
    id: string;
    display_name: string | null;
    phone: string | null;
    status: UserStatus;
    created_at: string;
    last_seen: string | null;
    client_mode: boolean | null;
    specialist_mode: boolean | null;
    primary_role: string | null;
    staff_role: StaffRole | null;
  }>(
    `SELECT u.id, pr.display_name, u.phone, u.status, u.created_at::text,
            (SELECT max(s.last_seen_at)::text FROM sessions s WHERE s.user_id = u.id) AS last_seen,
            pr.client_mode, pr.specialist_mode,
            (SELECT r.name FROM specialist_roles sr JOIN roles r ON r.id = sr.role_id WHERE sr.user_id = u.id AND sr.is_primary) AS primary_role,
            sm.role AS staff_role
     FROM users u
     LEFT JOIN profiles pr ON pr.user_id = u.id
     LEFT JOIN staff_members sm ON sm.user_id = u.id AND sm.revoked_at IS NULL
     ${where.length ? "WHERE " + where.join(" AND ") : ""}
     ORDER BY u.created_at DESC, u.id
     LIMIT ${PAGE + 1} OFFSET ${f.page * PAGE}`,
    params,
  );
  return {
    hasMore: rows.length > PAGE,
    users: rows.slice(0, PAGE).map((r) => ({
      id: r.id,
      name: r.display_name,
      phoneMasked: maskPhone(r.phone),
      status: r.status,
      createdAt: r.created_at,
      lastSeenAt: r.last_seen,
      client: !!r.client_mode,
      specialist: !!r.specialist_mode,
      primaryRole: r.primary_role,
      staffRole: r.staff_role,
    })),
  };
}

export async function getUser(staff: Staff, req: Request, id: string): Promise<AdminUserDetail> {
  const u = await one<{
    id: string;
    display_name: string | null;
    slug: string | null;
    phone: string | null;
    status: UserStatus;
    blocked_at: string | null;
    block_reason: string | null;
    blocked_by_name: string | null;
    created_at: string;
    signup_source: string | null;
    client_mode: boolean | null;
    specialist_mode: boolean | null;
    city: string | null;
    avatar_preset: string | null;
    avatar_media_id: string | null;
    staff_role: StaffRole | null;
    last_seen: string | null;
  }>(
    `SELECT u.id, pr.display_name, pr.slug, u.phone, u.status, u.blocked_at::text, u.block_reason, bp.display_name AS blocked_by_name,
            u.created_at::text, u.signup_source, pr.client_mode, pr.specialist_mode, ci.name AS city,
            pr.avatar_preset, pr.avatar_media_id, sm.role AS staff_role,
            (SELECT max(s.last_seen_at)::text FROM sessions s WHERE s.user_id = u.id) AS last_seen
     FROM users u
     LEFT JOIN profiles pr ON pr.user_id = u.id
     LEFT JOIN cities ci ON ci.id = pr.city_id
     LEFT JOIN profiles bp ON bp.user_id = u.blocked_by
     LEFT JOIN staff_members sm ON sm.user_id = u.id AND sm.revoked_at IS NULL
     WHERE u.id = $1`,
    [id],
  );
  if (!u) fail(404, "Пользователь не найден");

  const roles = await q<{ name: string; level: string; rate_min: number; rate_unit: string; is_primary: boolean }>(
    `SELECT r.name, sr.level::text, sr.rate_min, sr.rate_unit::text, sr.is_primary
     FROM specialist_roles sr JOIN roles r ON r.id = sr.role_id WHERE sr.user_id = $1 ORDER BY sr.is_primary DESC, r.name`,
    [id],
  );
  const stats = await one<{ owned: number; inv: number; accepted: number; open_inv: number; sessions: number }>(
    `SELECT (SELECT count(*)::int FROM projects WHERE created_by = $1) AS owned,
            (SELECT count(*)::int FROM invitations WHERE specialist_id = $1) AS inv,
            (SELECT count(*)::int FROM invitations WHERE specialist_id = $1 AND status = 'accepted') AS accepted,
            (SELECT count(*)::int FROM invitations WHERE specialist_id = $1 AND status IN ('sent', 'viewed')) AS open_inv,
            (SELECT count(*)::int FROM sessions WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now()) AS sessions`,
    [id],
  );
  const projects = await q<{ id: string; title: string; status: ProjectStatus; part: "client" | "specialist" }>(
    `(SELECT id, title, status, 'client' AS part, created_at FROM projects WHERE created_by = $1)
     UNION ALL
     (SELECT DISTINCT ON (p.id) p.id, p.title, p.status, 'specialist', p.created_at
      FROM invitations i JOIN projects p ON p.id = i.project_id WHERE i.specialist_id = $1)
     ORDER BY created_at DESC LIMIT 20`,
    [id],
  );

  await audit(staff, req, "user.view", "user", id);
  const history = await readAudit({ entityType: "user", entityId: id, limit: 20, skipViews: true });

  return {
    id: u!.id,
    name: u!.display_name,
    slug: u!.slug,
    phone: u!.phone,
    status: u!.status,
    blocked: u!.blocked_at ? { at: u!.blocked_at, reason: u!.block_reason ?? "", by: u!.blocked_by_name } : null,
    createdAt: u!.created_at,
    lastSeenAt: u!.last_seen,
    signupSource: u!.signup_source,
    client: !!u!.client_mode,
    specialist: !!u!.specialist_mode,
    city: u!.city,
    avatarUrl: avatarUrl(avatarFromRow(u!.avatar_preset, u!.avatar_media_id)),
    staffRole: u!.staff_role,
    roles: roles.map((r) => ({ name: r.name, level: r.level, rateMin: r.rate_min, rateUnit: r.rate_unit, isPrimary: r.is_primary })),
    stats: { projectsOwned: stats!.owned, invitations: stats!.inv, accepted: stats!.accepted, openInvitations: stats!.open_inv, activeSessions: stats!.sessions },
    projects: projects.map((p) => ({ id: p.id, title: p.title, status: p.status, part: p.part })),
    history,
  };
}

export const reasonSchema = z.object({ reason: z.string().trim().min(3, "Укажите причину").max(500, "Причина — до 500 символов") });

/**
 * Блокировка: сессии отзываются сразу, открытые приглашения специалиста отзываются,
 * чтобы заказчики не ждали ответа от заблокированного. Принятые приглашения не трогаем —
 * это решение по конкретному проекту, его принимает сотрудник отдельно.
 */
export async function blockUser(staff: Staff, req: Request, id: string, reason: string): Promise<{ withdrawn: number }> {
  if (id === staff.userId) fail(409, "Нельзя заблокировать себя", "self");
  return tx(async (c) => {
    const r = await c.query<{ status: UserStatus }>(`SELECT status FROM users WHERE id = $1 FOR UPDATE`, [id]);
    if (!r.rowCount) fail(404, "Пользователь не найден");
    if (r.rows[0].status !== "active") fail(409, "Заблокировать можно только активного пользователя", "not_active");
    const isStaff = await c.query(`SELECT 1 FROM staff_members WHERE user_id = $1 AND revoked_at IS NULL`, [id]);
    if (isStaff.rowCount) fail(409, "Это сотрудник. Сначала отзовите его роль", "is_staff");

    await c.query(`UPDATE users SET status = 'blocked', blocked_at = now(), blocked_by = $2, block_reason = $3 WHERE id = $1`, [id, staff.userId, reason]);
    await c.query(`UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [id]);
    const w = await c.query(`UPDATE invitations SET status = 'withdrawn' WHERE specialist_id = $1 AND status IN ('sent', 'viewed')`, [id]);
    await audit(staff, req, "user.block", "user", id, { reason, withdrawnInvitations: w.rowCount }, c);
    return { withdrawn: w.rowCount ?? 0 };
  });
}

export async function unblockUser(staff: Staff, req: Request, id: string, reason: string): Promise<void> {
  await tx(async (c) => {
    const r = await c.query<{ status: UserStatus; block_reason: string | null }>(`SELECT status, block_reason FROM users WHERE id = $1 FOR UPDATE`, [id]);
    if (!r.rowCount) fail(404, "Пользователь не найден");
    if (r.rows[0].status !== "blocked") fail(409, "Пользователь не заблокирован", "not_blocked");
    await c.query(`UPDATE users SET status = 'active', blocked_at = NULL, blocked_by = NULL, block_reason = NULL WHERE id = $1`, [id]);
    await audit(staff, req, "user.unblock", "user", id, { reason, previousReason: r.rows[0].block_reason }, c);
  });
}
