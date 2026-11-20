/**
 * Проекты и бриф: создание, правка с версиями, чтение, список «Мои проекты».
 * Правило версий (db-structure.md, вопрос №1): пока по версии брифа не было подбора,
 * слоты правятся на месте; после подбора правка брифа создаёт version+1 со своими слотами.
 */
import type { PoolClient } from "pg";
import { z } from "zod";
import type { InvitationView, ProjectDetail, ProjectListItem, ProjectStatus } from "@/lib/api/types";
import { formatName, roleName } from "@/lib/team-search/dictionaries";
import type { Brief, Level, RoleSlot, Tier } from "@/lib/team-search/types";
import { one, q, tx } from "./db";
import { dicts } from "./dictionaries";
import { fail } from "./http";

const date = z.union([z.literal(""), z.iso.date()]);

export const briefSchema = z.object({
  title: z.string().trim().max(120),
  city: z.string().max(80),
  formatId: z.string().max(40),
  goal: z.string().max(4000),
  prepStart: date,
  shootDates: z.array(z.iso.date()).max(30),
  deliveryDate: date,
  slots: z
    .array(
      z.object({
        key: z.string().max(64),
        roleId: z.string().max(40),
        levelMin: z.enum(["any", "junior", "middle", "senior", "lead"]),
        qty: z.number().int().min(1).max(20),
        shifts: z.number().int().min(0).max(60),
        budget: z.number().int().positive().max(100_000_000).nullable(),
        mustHave: z.boolean(),
      }),
    )
    .max(20),
  budgetMin: z.number().int().min(0).max(1_000_000_000).nullable(),
  budgetMax: z.number().int().positive().max(1_000_000_000).nullable(),
  budgetFlex: z.enum(["strict", "pm15", "negotiable"]),
  budgetScope: z.enum(["fees", "fees_equipment"]),
  legal: z.array(z.enum(["self_employed", "ip", "ooo", "individual"])).max(4),
  styleTagIds: z.array(z.string().max(40)).max(5),
  references: z.array(z.object({ url: z.string().max(500), comment: z.string().max(300) })).max(10),
  workStyle: z.object({
    revisions: z.enum(["1", "2-3", "4+"]),
    involvement: z.enum(["freedom", "stages", "every_step"]),
    channel: z.enum(["telegram", "email", "calls"]),
    pace: z.enum(["fast", "thorough"]),
  }),
  consent: z.boolean(),
});

type ProjectRow = {
  id: string;
  owner_user_id: string | null;
  title: string;
  format_id: number | null;
  goal: string | null;
  city_id: number | null;
  prep_start: string | null;
  shoot_dates: string[];
  delivery_date: string | null;
  budget_min: number | null;
  budget_max: number | null;
  budget_flex: Brief["budgetFlex"];
  budget_scope: Brief["budgetScope"];
  style_tag_ids: number[];
  expected_revisions: Brief["workStyle"]["revisions"] | null;
  client_involvement: Brief["workStyle"]["involvement"] | null;
  comm_channel: Brief["workStyle"]["channel"] | null;
  pace: Brief["workStyle"]["pace"] | null;
  required_legal_status: Brief["legal"];
  status: ProjectStatus;
  version: number;
};

/** Колонки проекта; даты — текстом (без сдвига часового пояса). a — псевдоним таблицы. */
const cols = (a = "") => {
  const t = a ? `${a}.` : "";
  return `${t}id, ${t}owner_user_id, ${t}title, ${t}format_id, ${t}goal, ${t}city_id, ${t}prep_start::text AS prep_start,
  ${t}shoot_dates::text[] AS shoot_dates, ${t}delivery_date::text AS delivery_date, ${t}budget_min, ${t}budget_max, ${t}budget_flex,
  ${t}budget_scope, ${t}style_tag_ids, ${t}expected_revisions, ${t}client_involvement, ${t}comm_channel, ${t}pace,
  ${t}required_legal_status::text[] AS required_legal_status, ${t}status, ${t}version`;
};
const PROJECT_COLS = cols();

/** Проект, который принадлежит пользователю (как заказчику). Иначе 404 — чужие проекты не раскрываем. */
async function ownProject(userId: string, id: string, c?: PoolClient): Promise<ProjectRow> {
  const row = await one<ProjectRow>(`SELECT ${PROJECT_COLS} FROM projects WHERE id = $1 AND owner_user_id = $2`, [id, userId], c);
  if (!row) fail(404, "Проект не найден");
  return row!;
}

async function briefFromDb(p: ProjectRow, c?: PoolClient): Promise<Brief> {
  const d = await dicts();
  const slots = await q<{ id: string; role_id: number; level_min: Level | null; qty: number; shifts: number | null; slot_budget: number | null; must_have: boolean }>(
    `SELECT id, role_id, level_min, qty, shifts, slot_budget, must_have FROM role_slots
     WHERE project_id = $1 AND project_version = $2 ORDER BY sort_order`,
    [p.id, p.version],
    c,
  );
  const refs = await q<{ url: string; comment: string | null }>(`SELECT url, comment FROM project_references WHERE project_id = $1 ORDER BY sort_order`, [p.id], c);
  return {
    title: p.title === "Без названия" ? "" : p.title,
    city: (p.city_id && d.cities.byId.get(p.city_id)) || "Санкт-Петербург",
    formatId: (p.format_id && d.formats.byId.get(p.format_id)) || "",
    goal: p.goal ?? "",
    prepStart: p.prep_start ?? "",
    shootDates: p.shoot_dates ?? [],
    deliveryDate: p.delivery_date ?? "",
    slots: slots.map(
      (s): RoleSlot => ({
        key: s.id,
        roleId: d.roles.byId.get(s.role_id)!,
        levelMin: s.level_min ?? "any",
        qty: s.qty,
        shifts: s.shifts ?? 0,
        budget: s.slot_budget,
        mustHave: s.must_have,
      }),
    ),
    budgetMin: p.budget_min,
    budgetMax: p.budget_max,
    budgetFlex: p.budget_flex,
    budgetScope: p.budget_scope,
    legal: p.required_legal_status,
    styleTagIds: p.style_tag_ids.map((id) => d.tags.byId.get(id)!).filter(Boolean),
    references: refs.length ? refs.map((r) => ({ url: r.url, comment: r.comment ?? "" })) : [{ url: "", comment: "" }],
    workStyle: {
      revisions: p.expected_revisions ?? "2-3",
      involvement: p.client_involvement ?? "stages",
      channel: p.comm_channel ?? "telegram",
      pace: p.pace ?? "fast",
    },
    consent: true,
  };
}

/** Перевод брифа в значения колонок projects с проверкой кодов справочников. */
async function briefColumns(b: Brief) {
  const d = await dicts();
  const formatId = b.formatId ? (d.formats.byCode.get(b.formatId) ?? fail(400, "Неизвестный формат")) : null;
  const cityId = d.cities.byName.get(b.city) ?? fail(400, "Неизвестный город");
  const tagIds = b.styleTagIds.map((t) => d.tags.byCode.get(t) ?? fail(400, `Неизвестный тег «${t}»`));
  return [
    b.title.trim() || "Без названия",
    formatId,
    b.goal || null,
    cityId,
    b.prepStart || null,
    b.shootDates,
    b.deliveryDate || null,
    b.budgetMin,
    b.budgetMax,
    b.budgetFlex,
    b.budgetScope,
    tagIds,
    b.workStyle.revisions,
    b.workStyle.involvement,
    b.workStyle.channel,
    b.workStyle.pace,
    b.legal,
  ];
}

async function insertSlots(c: PoolClient, projectId: string, version: number, b: Brief) {
  const d = await dicts();
  for (const [i, s] of b.slots.entries()) {
    const roleId = d.roles.byCode.get(s.roleId) ?? fail(400, `Неизвестная роль «${s.roleId}»`);
    const perShift = ["director", "dop", "gaffer", "sound", "art"].includes(s.roleId);
    await c.query(
      `INSERT INTO role_slots (project_id, project_version, role_id, qty, level_min, shifts, slot_budget, budget_estimated, must_have, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [projectId, version, roleId, s.qty, s.levelMin === "any" ? null : s.levelMin, perShift ? Math.max(1, s.shifts) : null, s.budget, s.budget == null, s.mustHave, i],
    );
  }
}

async function insertReferences(c: PoolClient, projectId: string, b: Brief) {
  await c.query(`DELETE FROM project_references WHERE project_id = $1`, [projectId]);
  for (const [i, r] of b.references.filter((x) => /^https?:\/\//i.test(x.url.trim())).entries())
    await c.query(`INSERT INTO project_references (project_id, url, comment, sort_order) VALUES ($1, $2, $3, $4)`, [projectId, r.url.trim(), r.comment || null, i]);
}

export async function createProject(userId: string, b: Brief): Promise<string> {
  const cols = await briefColumns(b);
  return tx(async (c) => {
    const { rows } = await c.query<{ id: string }>(
      `INSERT INTO projects (owner_user_id, created_by, title, format_id, goal, city_id, prep_start, shoot_dates, delivery_date,
         budget_min, budget_max, budget_flex, budget_scope, style_tag_ids, expected_revisions, client_involvement, comm_channel, pace,
         required_legal_status, status)
       VALUES ($1, $1, $2, $3, $4, $5, $6, $7::date[], $8, $9, $10, $11, $12, $13::smallint[], $14, $15, $16, $17, $18::legal_status[], 'draft')
       RETURNING id`,
      [userId, ...cols],
    );
    const id = rows[0].id;
    await c.query(`INSERT INTO project_versions (project_id, version, snapshot) VALUES ($1, 1, $2)`, [id, JSON.stringify(b)]);
    await insertSlots(c, id, 1, b);
    await insertReferences(c, id, b);
    return id;
  });
}

export async function updateProject(userId: string, id: string, b: Brief): Promise<void> {
  const cols = await briefColumns(b);
  await tx(async (c) => {
    const p = await ownProject(userId, id, c);
    if (!["draft", "matching"].includes(p.status)) fail(409, "Команда уже выбрана — бриф больше не меняется", "locked");
    const invited = await one<{ n: number }>(`SELECT count(*)::int AS n FROM invitations WHERE project_id = $1`, [id], c);
    if (invited!.n > 0) fail(409, "Приглашения уже отправлены — бриф больше не меняется", "locked");
    const hadMatching = await one<{ n: number }>(`SELECT count(*)::int AS n FROM team_configurations WHERE project_id = $1 AND project_version = $2`, [id, p.version], c);

    let version = p.version;
    if (hadMatching!.n > 0) {
      // По этой версии уже был подбор — новая версия брифа со своими слотами
      version = p.version + 1;
      await c.query(`INSERT INTO project_versions (project_id, version, snapshot) VALUES ($1, $2, $3)`, [id, version, JSON.stringify(b)]);
    } else {
      await c.query(`DELETE FROM role_slots WHERE project_id = $1 AND project_version = $2`, [id, version]);
      await c.query(`UPDATE project_versions SET snapshot = $3 WHERE project_id = $1 AND version = $2`, [id, version, JSON.stringify(b)]);
    }
    await c.query(
      `UPDATE projects SET title = $2, format_id = $3, goal = $4, city_id = $5, prep_start = $6, shoot_dates = $7::date[], delivery_date = $8,
         budget_min = $9, budget_max = $10, budget_flex = $11, budget_scope = $12, style_tag_ids = $13::smallint[], expected_revisions = $14,
         client_involvement = $15, comm_channel = $16, pace = $17, required_legal_status = $18::legal_status[], version = $19, status = 'draft'
       WHERE id = $1`,
      [id, ...cols, version],
    );
    await insertSlots(c, id, version, b);
    await insertReferences(c, id, b);
  });
}

export async function getBrief(userId: string, id: string): Promise<{ row: ProjectRow; brief: Brief }> {
  const row = await ownProject(userId, id);
  return { row, brief: await briefFromDb(row) };
}

export async function getProjectDetail(userId: string, id: string): Promise<ProjectDetail> {
  const { row, brief } = await getBrief(userId, id);
  const inv = await q<{
    id: string;
    slot_id: string;
    specialist_id: string;
    display_name: string;
    phone: string | null;
    cost: number;
    status: InvitationView["status"];
    sent_at: string;
    expires_at: string;
    decline_reason: string | null;
    replaces_id: string | null;
  }>(
    `SELECT i.id, i.slot_id, i.specialist_id, p.display_name, u.phone, i.cost, i.status,
            i.sent_at::text, i.expires_at::text, coalesce(i.decline_reason, i.cancel_reason) AS decline_reason, i.replaces_id
     FROM invitations i
     JOIN role_slots s ON s.id = i.slot_id AND s.project_version = $2
     JOIN profiles p ON p.user_id = i.specialist_id
     JOIN users u ON u.id = i.specialist_id
     WHERE i.project_id = $1 ORDER BY i.sent_at, i.id`,
    [id, row.version],
  );
  const tier = await one<{ tier: Tier }>(
    `SELECT tier FROM team_configurations WHERE project_id = $1 AND project_version = $2 AND chosen_at IS NOT NULL`,
    [id, row.version],
  );
  const manual = await q<{ slot_id: string }>(
    `SELECT m.slot_id FROM manual_match_requests m JOIN role_slots s ON s.id = m.slot_id
     WHERE m.project_id = $1 AND s.project_version = $2 AND m.status IN ('open', 'in_progress')`,
    [id, row.version],
  );
  return {
    id,
    status: row.status,
    version: row.version,
    brief,
    tier: tier?.tier,
    manualSlots: manual.map((m) => m.slot_id),
    invitations: inv.map((i) => ({
      id: i.id,
      slotKey: i.slot_id,
      specialistId: i.specialist_id,
      specialistName: i.display_name,
      cost: i.cost,
      status: i.status,
      sentAt: i.sent_at,
      expiresAt: i.expires_at,
      declineReason: i.decline_reason ?? undefined,
      replacesId: i.replaces_id ?? undefined,
      // контакты — только после принятия приглашения
      phone: i.status === "accepted" ? (i.phone ?? undefined) : undefined,
    })),
  };
}

/** «Мои проекты»: где я заказчик и куда меня пригласили специалистом. */
export async function listProjects(userId: string): Promise<ProjectListItem[]> {
  const d = await dicts();
  const own = await q<ProjectRow & { team_total: number; team_filled: number }>(
    `SELECT ${cols("p")},
       (SELECT coalesce(sum(qty), 0)::int FROM role_slots s WHERE s.project_id = p.id AND s.project_version = p.version) AS team_total,
       (SELECT count(*)::int FROM invitations i JOIN role_slots s ON s.id = i.slot_id
         WHERE i.project_id = p.id AND s.project_version = p.version AND i.status = 'accepted') AS team_filled
     FROM projects p WHERE p.owner_user_id = $1 AND p.title NOT LIKE 'Архивный демо-проект%' ORDER BY p.created_at DESC`,
    [userId],
  );
  const invited = await q<ProjectRow & { inv_id: string; inv_status: InvitationView["status"]; role_id: number; team_total: number; team_filled: number }>(
    `SELECT ${cols("p")}, i.id AS inv_id, i.status AS inv_status, s.role_id,
       (SELECT coalesce(sum(qty), 0)::int FROM role_slots x WHERE x.project_id = p.id AND x.project_version = p.version) AS team_total,
       (SELECT count(*)::int FROM invitations y WHERE y.project_id = p.id AND y.status = 'accepted') AS team_filled
     FROM invitations i JOIN projects p ON p.id = i.project_id JOIN role_slots s ON s.id = i.slot_id
     WHERE i.specialist_id = $1 AND i.status IN ('sent', 'viewed', 'accepted') ORDER BY i.sent_at DESC`,
    [userId],
  );
  const base = (p: ProjectRow) => ({
    id: p.id,
    title: p.title,
    format: p.format_id ? formatName(d.formats.byId.get(p.format_id)!) : "Формат не выбран",
    city: (p.city_id && d.cities.byId.get(p.city_id)) || "—",
    status: p.status,
    prepStart: p.prep_start ?? undefined,
    shootDates: p.shoot_dates ?? [],
    deliveryDate: p.delivery_date ?? undefined,
  });
  return [
    ...own.map((p) => ({ ...base(p), myPart: "client" as const, budgetMax: p.budget_max ?? undefined, teamFilled: p.team_filled, teamTotal: p.team_total })),
    ...invited.map((p) => ({
      ...base(p),
      myPart: "specialist" as const,
      myRole: roleName(d.roles.byId.get(p.role_id)!),
      teamFilled: p.team_filled,
      teamTotal: p.team_total,
      myInvitation: { id: p.inv_id, status: p.inv_status },
    })),
  ];
}
