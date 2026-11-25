/** Сводка для главной админки и чтение журнала действий. */
import type { AdminSummary, AuditEntry } from "@/lib/api/admin-types";
import type { ProjectStatus } from "@/lib/api/types";
import { one, q } from "../db";

export async function getSummary(userId: string): Promise<AdminSummary> {
  const queue = await one<{ open: number; in_progress: number; overdue: number; mine: number }>(
    `SELECT count(*) FILTER (WHERE status = 'open')::int AS open,
            count(*) FILTER (WHERE status = 'in_progress')::int AS in_progress,
            count(*) FILTER (WHERE due_at < now())::int AS overdue,
            count(*) FILTER (WHERE assigned_to = $1 AND status = 'in_progress')::int AS mine
     FROM manual_match_requests WHERE status IN ('open', 'in_progress')`,
    [userId],
  );
  const users = await one<{ total: number; blocked: number; new7d: number; staff: number }>(
    `SELECT count(*) FILTER (WHERE status <> 'deleted')::int AS total,
            count(*) FILTER (WHERE status = 'blocked')::int AS blocked,
            count(*) FILTER (WHERE status <> 'deleted' AND created_at > now() - interval '7 days')::int AS new7d,
            (SELECT count(*)::int FROM staff_members WHERE revoked_at IS NULL) AS staff
     FROM users`,
  );
  const byStatus = await q<{ status: ProjectStatus; n: number }>(`SELECT status, count(*)::int AS n FROM projects GROUP BY status`);
  const projects: Record<ProjectStatus, number> = { draft: 0, matching: 0, team_selected: 0, in_progress: 0, delivered: 0, cancelled: 0 };
  byStatus.forEach((r) => (projects[r.status] = r.n));
  const avatars = await one<{ n: number }>(`SELECT count(*)::int AS n FROM (${PENDING_AVATARS_SQL}) x`);

  return {
    queue: { open: queue!.open, inProgress: queue!.in_progress, overdue: queue!.overdue, mine: queue!.mine },
    users: users!,
    projects,
    avatarsPending: avatars!.n,
  };
}

/** Свои фото в аватаре, по которым ещё не было решения модератора после загрузки. */
export const PENDING_AVATARS_SQL = `
  SELECT p.user_id FROM profiles p JOIN media_files m ON m.id = p.avatar_media_id
  WHERE NOT EXISTS (
    SELECT 1 FROM moderation_events e
    WHERE e.entity_type = 'profile' AND e.entity_id = p.user_id AND e.created_at >= m.created_at
  )`;

type AuditRow = {
  id: string;
  created_at: string;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown>;
};

const toEntry = (r: AuditRow): AuditEntry => ({
  id: r.id,
  at: r.created_at,
  actor: r.actor_id ? { id: r.actor_id, name: r.actor_name ?? "Без профиля" } : null,
  action: r.action,
  entityType: r.entity_type,
  entityId: r.entity_id,
  details: r.details,
});

export type AuditFilter = { entityType?: string; entityId?: string; actorId?: string; before?: string; limit?: number; skipViews?: boolean };

export async function readAudit(f: AuditFilter): Promise<AuditEntry[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, v: unknown) => {
    params.push(v);
    where.push(sql.replace("?", `$${params.length}`));
  };
  if (f.entityType) add("a.entity_type = ?", f.entityType);
  if (f.entityId) add("a.entity_id = ?", f.entityId);
  if (f.actorId) add("a.actor_id = ?", f.actorId);
  if (f.before) add("a.id < ?", f.before);
  if (f.skipViews) where.push(`a.action NOT LIKE '%.view'`);
  params.push(Math.min(f.limit ?? 100, 200));
  const rows = await q<AuditRow>(
    `SELECT a.id::text, a.created_at::text, a.actor_id, p.display_name AS actor_name, a.action, a.entity_type, a.entity_id, a.details
     FROM admin_audit_log a LEFT JOIN profiles p ON p.user_id = a.actor_id
     ${where.length ? "WHERE " + where.join(" AND ") : ""}
     ORDER BY a.id DESC LIMIT $${params.length}`,
    params,
  );
  return rows.map(toEntry);
}
