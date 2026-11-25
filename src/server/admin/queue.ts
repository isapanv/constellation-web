/**
 * Очередь ручного подбора: роли, для которых алгоритм нашёл меньше двух кандидатов.
 * Заказчику обещан ответ за 24 часа (due_at). Подборщик берёт заявку, ищет людей,
 * приглашает их от имени платформы и закрывает заявку с итогом.
 */
import type { PoolClient } from "pg";
import { z } from "zod";
import type { MatchCandidate, MatchQueueFilter, MatchRequestDetail, MatchRequestItem, MatchRequestStatus } from "@/lib/api/admin-types";
import type { ProjectStatus } from "@/lib/api/types";
import type { InvitationStatus } from "@/lib/team-search/types";
import { one, q, tx } from "../db";
import { fail } from "../http";
import { type Staff, audit } from "./access";

const TTL_HOURS = 48; // как у обычных приглашений
const MAX_OPEN = 3;
/** Ручной подбор смотрит шире автоматического: уровень можно понизить на все ступени */
const RELAX_LEVELS = 3;

type Row = {
  id: string;
  status: MatchRequestStatus;
  reason: string;
  due_at: string;
  created_at: string;
  closed_at: string | null;
  result_note: string | null;
  assigned_to: string | null;
  assignee_name: string | null;
  project_id: string;
  title: string;
  project_status: ProjectStatus;
  city: string | null;
  client_name: string | null;
  slot_id: string;
  role: string;
  qty: number;
  level_min: string | null;
  slot_budget: number | null;
  shifts: number | null;
  accepted: number;
  current: boolean;
};

const BASE = `
  SELECT m.id, m.status, m.reason, m.due_at::text, m.created_at::text, m.closed_at::text, m.result_note,
         m.assigned_to, ap.display_name AS assignee_name,
         p.id AS project_id, p.title, p.status AS project_status, ci.name AS city,
         coalesce(cp.display_name, o.name) AS client_name,
         s.id AS slot_id, r.name AS role, s.qty, s.level_min::text, s.slot_budget, s.shifts,
         (SELECT count(*)::int FROM invitations i WHERE i.slot_id = s.id AND i.status = 'accepted') AS accepted,
         (s.project_version = p.version) AS current
  FROM manual_match_requests m
  JOIN projects p ON p.id = m.project_id
  JOIN role_slots s ON s.id = m.slot_id
  JOIN roles r ON r.id = s.role_id
  LEFT JOIN cities ci ON ci.id = p.city_id
  LEFT JOIN profiles cp ON cp.user_id = p.owner_user_id
  LEFT JOIN organizations o ON o.id = p.owner_org_id
  LEFT JOIN profiles ap ON ap.user_id = m.assigned_to`;

const toItem = (r: Row): MatchRequestItem => ({
  id: r.id,
  status: r.status,
  reason: r.reason,
  dueAt: r.due_at,
  createdAt: r.created_at,
  closedAt: r.closed_at,
  resultNote: r.result_note,
  assignee: r.assigned_to ? { id: r.assigned_to, name: r.assignee_name ?? "Сотрудник" } : null,
  project: { id: r.project_id, title: r.title, status: r.project_status, city: r.city, clientName: r.client_name ?? "—" },
  slot: {
    id: r.slot_id,
    role: r.role,
    qty: r.qty,
    levelMin: r.level_min,
    budget: r.slot_budget,
    shifts: r.shifts,
    accepted: r.accepted,
    current: r.current,
  },
});

export async function listQueue(userId: string, filter: MatchQueueFilter): Promise<MatchRequestItem[]> {
  const rows =
    filter === "closed"
      ? await q<Row>(`${BASE} WHERE m.status IN ('done', 'cancelled') ORDER BY m.closed_at DESC LIMIT 100`)
      : filter === "mine"
        ? await q<Row>(`${BASE} WHERE m.status = 'in_progress' AND m.assigned_to = $1 ORDER BY m.due_at`, [userId])
        : await q<Row>(`${BASE} WHERE m.status IN ('open', 'in_progress') ORDER BY m.due_at`);
  return rows.map(toItem);
}

export async function getRequest(id: string): Promise<MatchRequestDetail> {
  const r = await one<Row>(`${BASE} WHERE m.id = $1`, [id]);
  if (!r) fail(404, "Заявка не найдена");

  const brief = await one<{
    client_id: string;
    client_phone: string;
    format: string | null;
    goal: string | null;
    shoot_dates: string[];
    delivery_date: string | null;
    budget_max: number | null;
  }>(
    `SELECT p.created_by AS client_id, u.phone AS client_phone, f.name AS format, p.goal,
            p.shoot_dates::text[] AS shoot_dates, p.delivery_date::text, p.budget_max
     FROM projects p JOIN users u ON u.id = p.created_by LEFT JOIN formats f ON f.id = p.format_id
     WHERE p.id = $1`,
    [r!.project_id],
  );

  const invitations = await q<{ id: string; name: string; status: InvitationStatus; cost: number; sent_at: string }>(
    `SELECT i.id, pr.display_name AS name, i.status, i.cost, i.sent_at::text
     FROM invitations i JOIN profiles pr ON pr.user_id = i.specialist_id
     WHERE i.slot_id = $1 ORDER BY i.sent_at`,
    [r!.slot_id],
  );

  // Кандидаты — те же жёсткие фильтры, что у автоматического подбора, но с понижением уровня до упора
  const candidates = await q<{
    specialist_id: string;
    display_name: string;
    phone: string;
    level: string;
    cost: number;
    rate_min: number;
    rate_unit: string;
    relaxed: boolean;
    busy_share: string;
    open_inv: number;
    invited: InvitationStatus | null;
  }>(
    `SELECT c.specialist_id, c.display_name, u.phone, c.level::text, c.cost, c.rate_min, c.rate_unit::text, c.relaxed, c.busy_share::text,
            (SELECT count(*)::int FROM invitations i WHERE i.specialist_id = c.specialist_id AND i.status IN ('sent', 'viewed')) AS open_inv,
            (SELECT i.status FROM invitations i WHERE i.specialist_id = c.specialist_id AND i.slot_id = $1 ORDER BY i.sent_at DESC LIMIT 1) AS invited
     FROM candidates_for_slot($1, $2) c JOIN users u ON u.id = c.specialist_id
     ORDER BY c.relaxed, c.busy_share, c.cost
     LIMIT 50`,
    [r!.slot_id, RELAX_LEVELS],
  );

  return {
    ...toItem(r!),
    client: { id: brief!.client_id, name: r!.client_name ?? "—", phone: brief!.client_phone },
    brief: {
      format: brief!.format,
      goal: brief!.goal,
      shootDates: brief!.shoot_dates,
      deliveryDate: brief!.delivery_date,
      budgetMax: brief!.budget_max,
    },
    invitations: invitations.map((i) => ({ id: i.id, specialistName: i.name, status: i.status, cost: i.cost, sentAt: i.sent_at })),
    candidates: candidates.map(
      (c): MatchCandidate => ({
        specialistId: c.specialist_id,
        name: c.display_name,
        phone: c.phone,
        level: c.level,
        cost: c.cost,
        rateMin: c.rate_min,
        rateUnit: c.rate_unit,
        relaxed: c.relaxed,
        busyShare: Number(c.busy_share),
        openInvitations: c.open_inv,
        invited: c.invited,
      }),
    ),
  };
}

export const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("take") }),
  z.object({ action: z.literal("release") }),
  z.object({ action: z.literal("invite"), specialistId: z.uuid() }),
  z.object({ action: z.literal("done"), note: z.string().trim().min(5, "Опишите итог: кого нашли и как связались").max(1000) }),
  z.object({ action: z.literal("cancel"), note: z.string().trim().min(5, "Укажите причину отмены").max(1000) }),
]);
export type QueueAction = z.infer<typeof actionSchema>;

async function lock(c: PoolClient, id: string) {
  const r = await c.query<{ status: MatchRequestStatus; assigned_to: string | null; slot_id: string; project_id: string }>(
    `SELECT status, assigned_to, slot_id, project_id FROM manual_match_requests WHERE id = $1 FOR UPDATE`,
    [id],
  );
  if (!r.rowCount) fail(404, "Заявка не найдена");
  return r.rows[0];
}

export async function actOnRequest(staff: Staff, req: Request, id: string, a: QueueAction): Promise<void> {
  await tx(async (c) => {
    const m = await lock(c, id);
    const closed = m.status === "done" || m.status === "cancelled";
    if (closed) fail(409, "Заявка уже закрыта", "closed");
    const mineOrAdmin = m.assigned_to === staff.userId || staff.role === "admin";

    switch (a.action) {
      case "take": {
        if (m.status === "in_progress" && m.assigned_to !== staff.userId && staff.role !== "admin")
          fail(409, "Заявку уже взял другой сотрудник", "taken");
        await c.query(`UPDATE manual_match_requests SET status = 'in_progress', assigned_to = $2, assigned_at = now() WHERE id = $1`, [id, staff.userId]);
        await audit(staff, req, "match_request.take", "match_request", id, { previousAssignee: m.assigned_to }, c);
        return;
      }
      case "release": {
        if (m.status !== "in_progress" || !mineOrAdmin) fail(409, "Вернуть в очередь можно только свою заявку в работе", "not_yours");
        await c.query(`UPDATE manual_match_requests SET status = 'open', assigned_to = NULL, assigned_at = NULL WHERE id = $1`, [id]);
        await audit(staff, req, "match_request.release", "match_request", id, {}, c);
        return;
      }
      case "invite": {
        if (m.status !== "in_progress" || m.assigned_to !== staff.userId) fail(409, "Сначала возьмите заявку в работу", "not_taken");
        await inviteToSlot(c, m.project_id, m.slot_id, a.specialistId);
        await audit(staff, req, "match_request.invite", "match_request", id, { specialistId: a.specialistId }, c);
        return;
      }
      case "done":
      case "cancel": {
        if (m.status === "in_progress" && !mineOrAdmin) fail(409, "Заявка в работе у другого сотрудника", "not_yours");
        await c.query(
          `UPDATE manual_match_requests SET status = $2, closed_at = now(), result_note = $3,
                  assigned_to = coalesce(assigned_to, $4), assigned_at = coalesce(assigned_at, now())
           WHERE id = $1`,
          [id, a.action === "done" ? "done" : "cancelled", a.note, staff.userId],
        );
        await audit(staff, req, `match_request.${a.action}`, "match_request", id, { note: a.note }, c);
        return;
      }
    }
  });
}

/**
 * Приглашение от платформы. Цену и допуск берём из жёстких фильтров (как у заказчика),
 * лимит — те же 3 открытых приглашения у специалиста.
 */
async function inviteToSlot(c: PoolClient, projectId: string, slotId: string, specialistId: string) {
  const p = await c.query<{ status: ProjectStatus; current: boolean }>(
    `SELECT p.status, s.project_version = p.version AS current FROM projects p JOIN role_slots s ON s.id = $2 WHERE p.id = $1`,
    [projectId, slotId],
  );
  if (!p.rows[0]?.current) fail(409, "Заказчик изменил бриф — этот слот устарел. Закройте заявку", "stale");
  if (!["matching", "team_selected"].includes(p.rows[0].status)) fail(409, "Проект не в подборе — приглашать нельзя", "not_matching");

  const cand = await c.query<{ cost: number }>(`SELECT cost FROM candidates_for_slot($1, $2) WHERE specialist_id = $3`, [slotId, RELAX_LEVELS, specialistId]);
  if (!cand.rowCount) fail(409, "Специалист больше не подходит: занят, закрыл профиль или не та роль", "not_admitted");
  const open = await c.query<{ n: number }>(`SELECT count(*)::int AS n FROM invitations WHERE specialist_id = $1 AND status IN ('sent', 'viewed')`, [specialistId]);
  if (open.rows[0].n >= MAX_OPEN) fail(409, `У специалиста уже ${MAX_OPEN} открытых приглашения — пусть сначала ответит на них`, "too_many_open");

  const ins = await c.query(
    `INSERT INTO invitations (project_id, slot_id, specialist_id, cost, expires_at)
     VALUES ($1, $2, $3, $4, now() + make_interval(hours => $5))
     ON CONFLICT DO NOTHING`,
    [projectId, slotId, specialistId, cand.rows[0].cost, TTL_HOURS],
  );
  if (!ins.rowCount) fail(409, "Этого специалиста уже пригласили в эту роль", "already_invited");
  await c.query(
    `INSERT INTO recommendation_log (project_id, slot_id, specialist_id, event, payload) VALUES ($1, $2, $3, 'invited', '{"manual": true}')`,
    [projectId, slotId, specialistId],
  );
}
