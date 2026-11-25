/**
 * Приглашения: отправка составу, замена после отказа, ответ специалиста, фиксация команды.
 * Стоимость и допуск каждого кандидата сервер проверяет сам (candidates_for_slot), не доверяя фронту.
 */
import type { PoolClient } from "pg";
import type { SendInvitationsRequest } from "@/lib/api/types";
import { matchSlots } from "@/lib/team-search/matching";
import { one, q, tx } from "./db";
import { fail } from "./http";
import { loadPool } from "./matching";
import { getBrief } from "./projects";

const TTL_HOURS = 48;
const MAX_OPEN = 3;

/** Цена и допуск кандидата на слот по жёстким фильтрам БД (с ослаблением на ступень). */
async function admitted(c: PoolClient, slotId: string, specialistId: string): Promise<{ cost: number; name: string } | null> {
  const r = await c.query<{ cost: number; display_name: string }>(
    `SELECT cost, display_name FROM candidates_for_slot($1, 1) WHERE specialist_id = $2`,
    [slotId, specialistId],
  );
  return r.rows[0] ? { cost: r.rows[0].cost, name: r.rows[0].display_name } : null;
}

async function openCount(c: PoolClient, specialistId: string): Promise<number> {
  const r = await c.query<{ n: number }>(`SELECT count(*)::int AS n FROM invitations WHERE specialist_id = $1 AND status IN ('sent', 'viewed')`, [specialistId]);
  return r.rows[0].n;
}

export async function sendInvitations(userId: string, projectId: string, body: SendInvitationsRequest): Promise<void> {
  const { row } = await getBrief(userId, projectId);
  if (row.status !== "matching") fail(409, "Сначала подберите команду", "not_matching");
  if (!body.members.length) fail(422, "В составе нет участников");

  await tx(async (c) => {
    const slots = await c.query<{ id: string }>(`SELECT id FROM role_slots WHERE project_id = $1 AND project_version = $2`, [projectId, row.version]);
    const slotIds = new Set(slots.rows.map((s) => s.id));
    const cfg = await c.query<{ id: string }>(
      `SELECT id FROM team_configurations WHERE project_id = $1 AND project_version = $2 AND tier = $3`,
      [projectId, row.version, body.tier],
    );
    if (!cfg.rowCount) fail(409, "Подборка устарела — обновите страницу", "stale");

    const busy: string[] = [];
    for (const m of body.members) {
      if (!slotIds.has(m.slotKey)) fail(409, "Подборка устарела — обновите страницу", "stale");
      const ok = await admitted(c, m.slotKey, m.specialistId);
      if (!ok) fail(409, "Кто-то из кандидатов больше не подходит (занят или закрыл профиль) — обновите подборку", "not_admitted");
      if ((await openCount(c, m.specialistId)) >= MAX_OPEN) {
        busy.push(ok!.name);
        continue;
      }
      await c.query(
        `INSERT INTO invitations (project_id, slot_id, configuration_id, specialist_id, cost, expires_at)
         VALUES ($1, $2, $3, $4, $5, now() + make_interval(hours => $6))
         ON CONFLICT DO NOTHING`,
        [projectId, m.slotKey, cfg.rows[0].id, m.specialistId, ok!.cost, TTL_HOURS],
      );
      await c.query(`INSERT INTO recommendation_log (project_id, configuration_id, slot_id, specialist_id, event) VALUES ($1, $2, $3, $4, 'invited')`, [
        projectId,
        cfg.rows[0].id,
        m.slotKey,
        m.specialistId,
      ]);
    }
    if (busy.length) fail(409, `У ${busy.join(", ")} уже ${MAX_OPEN} открытых приглашения — замените их в подборке`, "too_many_open");
    await c.query(`UPDATE team_configurations SET chosen_at = now() WHERE id = $1`, [cfg.rows[0].id]);
  });
}

/** Следующий по баллу кандидат на ту же роль, которого в этом проекте ещё не приглашали. */
export async function replaceInvitation(userId: string, invitationId: string): Promise<void> {
  const inv = await one<{ project_id: string; slot_id: string; status: string }>(`SELECT project_id, slot_id, status FROM invitations WHERE id = $1`, [invitationId]);
  if (!inv) fail(404, "Приглашение не найдено");
  const { brief } = await getBrief(userId, inv!.project_id); // заодно проверка, что проект мой
  if (!["declined", "expired", "cancelled"].includes(inv!.status)) fail(409, "Замена нужна только после отказа", "not_declined");

  const pool = await loadPool(brief.slots.map((s) => s.roleId));
  const slotResult = matchSlots(brief, pool).find((r) => r.slot.key === inv!.slot_id);
  if (!slotResult) fail(409, "Роль больше не в брифе", "stale");

  await tx(async (c) => {
    const invited = await c.query<{ specialist_id: string; status: string }>(`SELECT specialist_id, status FROM invitations WHERE slot_id = $1`, [inv!.slot_id]);
    const live = invited.rows.filter((r) => ["sent", "viewed", "accepted"].includes(r.status)).length;
    if (live >= slotResult!.slot.qty) fail(409, "Замена уже приглашена", "already_replaced");
    const tried = new Set(invited.rows.map((r) => r.specialist_id));
    for (const cand of slotResult!.candidates) {
      if (tried.has(cand.specialist.id)) continue;
      const ok = await admitted(c, inv!.slot_id, cand.specialist.id);
      if (!ok || (await openCount(c, cand.specialist.id)) >= MAX_OPEN) continue;
      await c.query(
        `INSERT INTO invitations (project_id, slot_id, specialist_id, replaces_id, cost, expires_at)
         VALUES ($1, $2, $3, $4, $5, now() + make_interval(hours => $6))`,
        [inv!.project_id, inv!.slot_id, cand.specialist.id, invitationId, ok.cost, TTL_HOURS],
      );
      return;
    }
    fail(409, "Свободных кандидатов на эту роль не осталось — передадим в ручной подбор", "no_candidates");
  });
}

/** Ответ на приглашение. Специалист отвечает сам; asUserId = null — демо-режим от лица специалиста. */
export async function respond(asUserId: string | null, invitationId: string, accept: boolean, reason?: string): Promise<void> {
  await tx(async (c) => {
    const r = await c.query<{ specialist_id: string; status: string; project_id: string; slot_id: string; qty: number; dates: string[] }>(
      `SELECT i.specialist_id, i.status, i.project_id, i.slot_id, s.qty, p.shoot_dates::text[] AS dates
       FROM invitations i JOIN role_slots s ON s.id = i.slot_id JOIN projects p ON p.id = i.project_id
       WHERE i.id = $1 FOR UPDATE OF i`,
      [invitationId],
    );
    const inv = r.rows[0];
    if (!inv || (asUserId && inv.specialist_id !== asUserId)) fail(404, "Приглашение не найдено");
    if (!["sent", "viewed"].includes(inv.status)) fail(409, "На это приглашение уже ответили", "answered");

    if (!accept) {
      await c.query(`UPDATE invitations SET status = 'declined', responded_at = now(), decline_reason = $2 WHERE id = $1`, [invitationId, reason ?? null]);
    } else {
      await c.query(`UPDATE invitations SET status = 'accepted', responded_at = now() WHERE id = $1`, [invitationId]);
      // Даты съёмки блокируются в календаре специалиста
      for (const d of inv.dates)
        await c.query(`INSERT INTO availability (user_id, date_from, date_to, status, source, project_id) VALUES ($1, $2, $2, 'busy', 'platform_project', $3)`, [
          inv.specialist_id,
          d,
          inv.project_id,
        ]);
      const filled = await c.query<{ n: number }>(`SELECT count(*)::int AS n FROM invitations WHERE slot_id = $1 AND status = 'accepted'`, [inv.slot_id]);
      if (filled.rows[0].n >= inv.qty) await c.query(`UPDATE role_slots SET status = 'filled' WHERE id = $1`, [inv.slot_id]);
    }
    await c.query(`INSERT INTO recommendation_log (project_id, slot_id, specialist_id, event) VALUES ($1, $2, $3, $4)`, [
      inv.project_id,
      inv.slot_id,
      inv.specialist_id,
      accept ? "accepted" : "declined",
    ]);
  });
}

/** Команда собрана: все роли, кроме ушедших в ручной подбор, закрыты принятыми приглашениями. */
export async function confirmTeam(userId: string, projectId: string): Promise<void> {
  const { row } = await getBrief(userId, projectId);
  if (row.status !== "matching") fail(409, "Команда уже зафиксирована или подбор не начат", "not_matching");
  const open = await q<{ id: string }>(
    `SELECT s.id FROM role_slots s
     WHERE s.project_id = $1 AND s.project_version = $2
       AND NOT EXISTS (SELECT 1 FROM manual_match_requests m WHERE m.slot_id = s.id AND m.status IN ('open', 'in_progress'))
       AND (SELECT count(*) FROM invitations i WHERE i.slot_id = s.id AND i.status = 'accepted') < s.qty`,
    [projectId, row.version],
  );
  if (open.length) fail(409, "Ещё не все роли закрыты", "not_filled");
  await q(`UPDATE projects SET status = 'team_selected' WHERE id = $1`, [projectId]);
}

/** Демо: ответы за специалистов — все принимают, кроме второго. Только не в продакшне. */
export async function simulateResponses(userId: string, projectId: string): Promise<void> {
  await getBrief(userId, projectId);
  const open = await q<{ id: string }>(`SELECT id FROM invitations WHERE project_id = $1 AND status IN ('sent', 'viewed') ORDER BY sent_at, id`, [projectId]);
  for (const [i, inv] of open.entries()) {
    const decline = open.length >= 3 && i === 1;
    await respond(null, inv.id, !decline, decline ? "Не совпадают даты подготовки" : undefined);
  }
}
