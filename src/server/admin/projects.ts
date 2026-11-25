/**
 * Проекты в админке: список, карточка, ручная смена статуса.
 * До подключения договоров и оплаты «Команда собрана → В работе → Сдан» переводит сотрудник.
 */
import { z } from "zod";
import type { AdminProjectDetail, AdminProjectListItem, MatchRequestStatus } from "@/lib/api/admin-types";
import type { ProjectStatus } from "@/lib/api/types";
import type { InvitationStatus } from "@/lib/team-search/types";
import { one, q, tx } from "../db";
import { fail } from "../http";
import { type Staff, audit } from "./access";
import { readAudit } from "./overview";

export const PAGE = 50;
const STATUSES = ["draft", "matching", "team_selected", "in_progress", "delivered", "cancelled"] as const;

/** Ручные переходы. Остальные делает сам продукт (подбор, фиксация команды). */
const NEXT: Record<ProjectStatus, ProjectStatus[]> = {
  draft: ["cancelled"],
  matching: ["cancelled"],
  team_selected: ["in_progress", "cancelled"],
  in_progress: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

export const listSchema = z.object({
  q: z.string().trim().max(80).optional(),
  status: z.enum([...STATUSES, "all"]).default("all"),
  page: z.coerce.number().int().min(0).max(1000).default(0),
});

export async function listProjects(f: z.infer<typeof listSchema>): Promise<{ projects: AdminProjectListItem[]; hasMore: boolean }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (f.status !== "all") {
    params.push(f.status);
    where.push(`p.status = $${params.length}`);
  }
  if (f.q) {
    params.push(`%${f.q}%`);
    where.push(`(p.title ILIKE $${params.length} OR cp.display_name ILIKE $${params.length})`);
  }
  const rows = await q<{
    id: string;
    title: string;
    status: ProjectStatus;
    client_name: string | null;
    city: string | null;
    format: string | null;
    created_at: string;
    shoot_from: string | null;
    slots: number;
    filled: number;
    manual_open: number;
  }>(
    `SELECT p.id, p.title, p.status, coalesce(cp.display_name, o.name) AS client_name, ci.name AS city, f.name AS format,
            p.created_at::text, (SELECT min(d)::text FROM unnest(p.shoot_dates) d) AS shoot_from,
            (SELECT coalesce(sum(s.qty), 0)::int FROM role_slots s WHERE s.project_id = p.id AND s.project_version = p.version) AS slots,
            (SELECT count(*)::int FROM invitations i JOIN role_slots s ON s.id = i.slot_id
              WHERE i.project_id = p.id AND s.project_version = p.version AND i.status = 'accepted') AS filled,
            (SELECT count(*)::int FROM manual_match_requests m WHERE m.project_id = p.id AND m.status IN ('open', 'in_progress')) AS manual_open
     FROM projects p
     LEFT JOIN profiles cp ON cp.user_id = p.owner_user_id
     LEFT JOIN organizations o ON o.id = p.owner_org_id
     LEFT JOIN cities ci ON ci.id = p.city_id
     LEFT JOIN formats f ON f.id = p.format_id
     ${where.length ? "WHERE " + where.join(" AND ") : ""}
     ORDER BY p.updated_at DESC, p.id
     LIMIT ${PAGE + 1} OFFSET ${f.page * PAGE}`,
    params,
  );
  return {
    hasMore: rows.length > PAGE,
    projects: rows.slice(0, PAGE).map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      clientName: r.client_name ?? "—",
      city: r.city,
      format: r.format,
      createdAt: r.created_at,
      shootFrom: r.shoot_from,
      slots: r.slots,
      filled: r.filled,
      manualOpen: r.manual_open,
    })),
  };
}

export async function getProject(staff: Staff, req: Request, id: string): Promise<AdminProjectDetail> {
  const p = await one<{
    id: string;
    title: string;
    status: ProjectStatus;
    version: number;
    client_id: string;
    client_name: string | null;
    client_phone: string | null;
    format: string | null;
    city: string | null;
    goal: string | null;
    shoot_dates: string[];
    delivery_date: string | null;
    budget_min: number | null;
    budget_max: number | null;
    created_at: string;
  }>(
    `SELECT p.id, p.title, p.status, p.version, p.created_by AS client_id, coalesce(cp.display_name, o.name) AS client_name, u.phone AS client_phone,
            f.name AS format, ci.name AS city, p.goal, p.shoot_dates::text[] AS shoot_dates, p.delivery_date::text,
            p.budget_min, p.budget_max, p.created_at::text
     FROM projects p
     JOIN users u ON u.id = p.created_by
     LEFT JOIN profiles cp ON cp.user_id = p.owner_user_id
     LEFT JOIN organizations o ON o.id = p.owner_org_id
     LEFT JOIN cities ci ON ci.id = p.city_id
     LEFT JOIN formats f ON f.id = p.format_id
     WHERE p.id = $1`,
    [id],
  );
  if (!p) fail(404, "Проект не найден");

  const slots = await q<{
    id: string;
    role: string;
    qty: number;
    level_min: string | null;
    slot_budget: number | null;
    status: string;
    accepted: number;
    manual_id: string | null;
    manual_status: MatchRequestStatus | null;
  }>(
    `SELECT s.id, r.name AS role, s.qty, s.level_min::text, s.slot_budget, s.status::text,
            (SELECT count(*)::int FROM invitations i WHERE i.slot_id = s.id AND i.status = 'accepted') AS accepted,
            m.id AS manual_id, m.status AS manual_status
     FROM role_slots s JOIN roles r ON r.id = s.role_id
     LEFT JOIN LATERAL (SELECT id, status FROM manual_match_requests WHERE slot_id = s.id ORDER BY created_at DESC LIMIT 1) m ON true
     WHERE s.project_id = $1 AND s.project_version = $2 ORDER BY s.sort_order`,
    [id, p!.version],
  );
  const invitations = await q<{
    id: string;
    slot_id: string;
    specialist_id: string;
    name: string;
    status: InvitationStatus;
    cost: number;
    sent_at: string;
    reason: string | null;
  }>(
    `SELECT i.id, i.slot_id, i.specialist_id, pr.display_name AS name, i.status, i.cost, i.sent_at::text, coalesce(i.decline_reason, i.cancel_reason) AS reason
     FROM invitations i JOIN role_slots s ON s.id = i.slot_id AND s.project_version = $2
     JOIN profiles pr ON pr.user_id = i.specialist_id
     WHERE i.project_id = $1 ORDER BY i.sent_at, i.id`,
    [id, p!.version],
  );

  await audit(staff, req, "project.view", "project", id);
  const history = await readAudit({ entityType: "project", entityId: id, limit: 20, skipViews: true });

  return {
    id: p!.id,
    title: p!.title,
    status: p!.status,
    version: p!.version,
    client: { id: p!.client_id, name: p!.client_name ?? "—", phone: p!.client_phone },
    format: p!.format,
    city: p!.city,
    goal: p!.goal,
    shootDates: p!.shoot_dates,
    deliveryDate: p!.delivery_date,
    budgetMin: p!.budget_min,
    budgetMax: p!.budget_max,
    createdAt: p!.created_at,
    slots: slots.map((s) => ({
      id: s.id,
      role: s.role,
      qty: s.qty,
      levelMin: s.level_min,
      budget: s.slot_budget,
      status: s.status,
      accepted: s.accepted,
      manual: s.manual_id ? { id: s.manual_id, status: s.manual_status! } : null,
    })),
    invitations: invitations.map((i) => ({
      id: i.id,
      slotId: i.slot_id,
      specialistId: i.specialist_id,
      specialistName: i.name,
      status: i.status,
      cost: i.cost,
      sentAt: i.sent_at,
      reason: i.reason,
    })),
    nextStatuses: NEXT[p!.status],
    history,
  };
}

export const statusSchema = z.object({
  status: z.enum(STATUSES),
  reason: z.string().trim().min(3, "Укажите причину смены статуса").max(500),
});

/**
 * Смена статуса вручную. Отмена проекта убирает хвосты, иначе специалисты остаются «заняты»:
 * открытые приглашения → отозваны, принятые → отменены с причиной, занятость в календарях снимается,
 * заявки ручного подбора закрываются.
 */
export async function setProjectStatus(staff: Staff, req: Request, id: string, to: ProjectStatus, reason: string): Promise<void> {
  await tx(async (c) => {
    const r = await c.query<{ status: ProjectStatus }>(`SELECT status FROM projects WHERE id = $1 FOR UPDATE`, [id]);
    if (!r.rowCount) fail(404, "Проект не найден");
    const from = r.rows[0].status;
    if (!NEXT[from].includes(to)) fail(409, "Такой переход статуса недоступен", "bad_transition");

    const effects: Record<string, number> = {};
    if (to === "cancelled") {
      const w = await c.query(`UPDATE invitations SET status = 'withdrawn' WHERE project_id = $1 AND status IN ('sent', 'viewed')`, [id]);
      const a = await c.query(
        `UPDATE invitations SET status = 'cancelled', cancelled_at = now(), cancel_reason = $2 WHERE project_id = $1 AND status = 'accepted'`,
        [id, `Проект отменён: ${reason}`],
      );
      const b = await c.query(`DELETE FROM availability WHERE project_id = $1 AND source = 'platform_project'`, [id]);
      const m = await c.query(
        `UPDATE manual_match_requests SET status = 'cancelled', closed_at = now(), result_note = 'Проект отменён'
         WHERE project_id = $1 AND status IN ('open', 'in_progress')`,
        [id],
      );
      Object.assign(effects, { withdrawn: w.rowCount, cancelledAccepted: a.rowCount, freedDays: b.rowCount, closedRequests: m.rowCount });
    }
    await c.query(`UPDATE projects SET status = $2 WHERE id = $1`, [id, to]);
    await audit(staff, req, "project.status", "project", id, { from, to, reason, ...effects }, c);
  });
}
