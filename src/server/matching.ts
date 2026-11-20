/**
 * Подбор на сервере: специалисты из БД → те же правила, что в src/lib/team-search/matching.ts →
 * три состава сохраняются в team_configurations / configuration_members.
 */
import type { MatchingResponse } from "@/lib/api/types";
import { buildConfigurations, matchSlots, recommendedTier } from "@/lib/team-search/matching";
import type { Level, LegalStatus, Specialist, Tier, WorkStyle } from "@/lib/team-search/types";
import { q, tx } from "./db";
import { dicts } from "./dictionaries";
import { fail } from "./http";
import { getBrief } from "./projects";

export const ALGORITHM_VERSION = "rules-v1";

/** Специалисты нужных ролей в формате, который понимает алгоритм подбора. */
export async function loadPool(roleCodes: string[]): Promise<Specialist[]> {
  const d = await dicts();
  const roleIds = roleCodes.map((c) => d.roles.byCode.get(c)).filter((x): x is number => x != null);
  if (!roleIds.length) return [];

  const rows = await q<{
    id: string;
    name: string;
    role_id: number;
    level: Level;
    years: number;
    rate_min: number;
    rate_unit: string;
    equipment: string | null;
    city: string;
    travel_ready: boolean;
    open_to_work: boolean;
    legal_status: LegalStatus;
    style_tag_ids: number[];
    verification_level: number;
    response_rate: number | null;
    median_response_h: number | null;
    calendar_days: number | null;
    comm_channel: WorkStyle["channel"] | null;
    revisions: WorkStyle["revisions"] | null;
    involvement: WorkStyle["involvement"] | null;
    pace: WorkStyle["pace"] | null;
    reviews: number;
    q_avg: number | null;
    d_avg: number | null;
    c_avg: number | null;
    quote: string | null;
  }>(
    `SELECT u.id, p.display_name AS name, sr.role_id, sr.level, sr.years, sr.rate_min, sr.rate_unit::text,
            sr.role_attrs->>'equipment' AS equipment, c.name AS city, ss.travel_ready, ss.open_to_work, ss.legal_status,
            ss.style_tag_ids, ss.verification_level, ss.response_rate::float8, ss.median_response_h::float8,
            extract(day FROM now() - ss.calendar_updated_at)::int AS calendar_days,
            ws.comm_channel, ws.revisions, ws.involvement, ws.pace,
            r.n AS reviews, r.q AS q_avg, r.d AS d_avg, r.c AS c_avg, r.quote
     FROM specialist_roles sr
     JOIN users u ON u.id = sr.user_id AND u.status = 'active'
     JOIN profiles p ON p.user_id = u.id
     JOIN specialist_settings ss ON ss.user_id = u.id
     LEFT JOIN cities c ON c.id = p.city_id
     LEFT JOIN work_style ws ON ws.user_id = u.id
     LEFT JOIN LATERAL (
       SELECT count(DISTINCT project_id)::int AS n, avg(quality)::float8 AS q, avg(deadlines)::float8 AS d, avg(communication)::float8 AS c,
              (array_agg(comment ORDER BY created_at DESC) FILTER (WHERE comment IS NOT NULL AND comment_moderation = 'approved'))[1] AS quote
       FROM reviews WHERE target_id = u.id AND direction = 'client_to_specialist'
     ) r ON true
     WHERE sr.role_id = ANY($1::smallint[])`,
    [roleIds],
  );
  if (!rows.length) return [];
  const ids = [...new Set(rows.map((r) => r.id))];

  const [busy, works, edges] = await Promise.all([
    q<{ user_id: string; day: string }>(
      `SELECT a.user_id, gs::date::text AS day FROM availability a,
         generate_series(greatest(a.date_from, current_date - 30), least(a.date_to, current_date + 400), interval '1 day') gs
       WHERE a.user_id = ANY($1::uuid[]) AND a.status = 'busy'`,
      [ids],
    ),
    q<{ user_id: string; title: string; format_id: number | null; year: number | null; style_tag_ids: number[] }>(
      `SELECT user_id, title, format_id, year, style_tag_ids FROM portfolio_items
       WHERE user_id = ANY($1::uuid[]) AND moderation_status = 'approved' AND visibility = 'public' ORDER BY sort_order`,
      [ids],
    ),
    q<{ a: string; b: string; a_name: string; b_name: string; a_role: number | null; b_role: number | null }>(
      `SELECT e.user_a AS a, e.user_b AS b, pa.display_name AS a_name, pb.display_name AS b_name,
              (SELECT role_id FROM specialist_roles WHERE user_id = e.user_a AND is_primary) AS a_role,
              (SELECT role_id FROM specialist_roles WHERE user_id = e.user_b AND is_primary) AS b_role
       FROM collaboration_edges e
       JOIN profiles pa ON pa.user_id = e.user_a JOIN profiles pb ON pb.user_id = e.user_b
       WHERE e.user_a = ANY($1::uuid[]) OR e.user_b = ANY($1::uuid[])`,
      [ids],
    ),
  ]);

  const group = <T extends { user_id: string }>(xs: T[]) => {
    const m = new Map<string, T[]>();
    xs.forEach((x) => m.set(x.user_id, [...(m.get(x.user_id) ?? []), x]));
    return m;
  };
  const busyBy = group(busy);
  const worksBy = group(works);
  const tag = (id: number) => d.tags.byId.get(id)!;

  // Один человек может прийти несколькими строками (основная и доп. роли): основную берём как roleId, остальные — extraRoles
  const byUser = new Map<string, typeof rows>();
  rows.forEach((r) => byUser.set(r.id, [...(byUser.get(r.id) ?? []), r]));

  return [...byUser.values()].map((list) => {
    const r = list[0];
    const rating = r.reviews > 0 && r.q_avg != null ? { quality: r.q_avg, deadlines: r.d_avg ?? r.q_avg, communication: r.c_avg ?? r.q_avg } : null;
    return {
      id: r.id,
      name: r.name,
      roleId: d.roles.byId.get(r.role_id)!,
      extraRoles: list.slice(1).map((x) => d.roles.byId.get(x.role_id)!),
      level: r.level,
      years: r.years,
      city: r.city ?? "",
      travelReady: r.travel_ready,
      openToWork: r.open_to_work,
      legal: r.legal_status,
      rate: r.rate_min,
      rateUnit: r.rate_unit === "project" ? "project" : "shift",
      styleTags: r.style_tag_ids.map(tag).filter(Boolean),
      portfolio: (worksBy.get(r.id) ?? []).map((w) => ({
        title: w.title,
        formatId: w.format_id ? d.formats.byId.get(w.format_id)! : "",
        year: w.year ?? 0,
        tags: w.style_tag_ids.map(tag).filter(Boolean),
      })),
      busy: (busyBy.get(r.id) ?? []).map((b) => b.day),
      calendarUpdatedDaysAgo: r.calendar_days ?? 999,
      workStyle: {
        revisions: r.revisions ?? "2-3",
        involvement: r.involvement ?? "stages",
        channel: r.comm_channel ?? "telegram",
        pace: r.pace ?? "fast",
      },
      responseRate: r.response_rate ?? 0.8,
      medianResponseH: r.median_response_h ?? 6,
      platformProjects: r.reviews,
      rating,
      reviewQuote: r.quote ?? undefined,
      equipment: r.equipment ?? undefined,
      workedWith: edges.filter((e) => e.a === r.id || e.b === r.id).map((e) => (e.a === r.id ? e.b : e.a)),
      colleagues: edges
        .filter((e) => e.a === r.id || e.b === r.id)
        .map((e) =>
          e.a === r.id
            ? { id: e.b, name: e.b_name, roleId: e.b_role ? (d.roles.byId.get(e.b_role) ?? "") : "" }
            : { id: e.a, name: e.a_name, roleId: e.a_role ? (d.roles.byId.get(e.a_role) ?? "") : "" },
        ),
      portfolioVerified: r.verification_level > 0,
    } satisfies Specialist;
  });
}

/** Подбор по текущей версии брифа + сохранение трёх составов. */
export async function runMatching(userId: string, projectId: string): Promise<MatchingResponse> {
  const { row, brief } = await getBrief(userId, projectId);
  if (!["draft", "matching"].includes(row.status)) fail(409, "Команда уже выбрана", "locked");
  if (!brief.slots.length) fail(422, "В брифе нет ролей", "no_slots");

  const pool = await loadPool(brief.slots.map((s) => s.roleId));
  const results = matchSlots(brief, pool);
  const configs = buildConfigurations(results, brief);
  const recommended = recommendedTier(configs, brief);

  await tx(async (c) => {
    const sent = await c.query(`SELECT 1 FROM invitations WHERE project_id = $1 LIMIT 1`, [projectId]);
    if (sent.rowCount) fail(409, "Приглашения уже отправлены", "invited");

    // Перевод в matching проверит CHECK projects_ready_for_matching (бриф заполнен полностью)
    await c.query(`UPDATE projects SET status = 'matching' WHERE id = $1`, [projectId]).catch(() => fail(422, "Бриф заполнен не полностью", "incomplete"));
    await c.query(`UPDATE project_versions SET snapshot = $3 WHERE project_id = $1 AND version = $2`, [projectId, row.version, JSON.stringify(brief)]);
    await c.query(`DELETE FROM team_configurations WHERE project_id = $1 AND project_version = $2`, [projectId, row.version]);

    for (const tier of Object.keys(configs) as Tier[]) {
      const cfg = configs[tier];
      const { rows: ins } = await c.query<{ id: string }>(
        `INSERT INTO team_configurations (project_id, project_version, tier, total_cost, team_score, algorithm_version)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [projectId, row.version, tier, cfg.totalCost, cfg.teamScore, ALGORITHM_VERSION],
      );
      let rank = 0;
      for (const [slotKey, members] of Object.entries(cfg.members))
        for (const m of members)
          await c.query(
            `INSERT INTO configuration_members (configuration_id, project_id, project_version, slot_id, specialist_id, score, score_breakdown, cost, rank, relaxed, flags)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [ins[0].id, projectId, row.version, slotKey, m.specialist.id, m.score, JSON.stringify(m.breakdown), m.cost, ++rank, m.relaxed, JSON.stringify(m.reasons)],
          );
    }

    // Роли без кандидатов — в очередь ручного подбора (обещание заказчику: 24 часа)
    for (const r of results.filter((x) => x.manual))
      await c.query(
        `INSERT INTO manual_match_requests (project_id, slot_id, reason, due_at)
         SELECT $1, $2, $3, now() + interval '24 hours'
         WHERE NOT EXISTS (SELECT 1 FROM manual_match_requests WHERE slot_id = $2 AND status IN ('open', 'in_progress'))`,
        [projectId, r.slot.key, `Кандидатов после ослабления фильтров: ${r.candidates.length}`],
      );

    // Журнал «что показали» — с первого дня, это будущая обучающая выборка
    await c.query(
      `INSERT INTO recommendation_log (project_id, event, payload) VALUES ($1, 'shown', $2)`,
      [projectId, JSON.stringify({ version: row.version, algorithm: ALGORITHM_VERSION, recommended, totals: Object.fromEntries(Object.entries(configs).map(([t, c]) => [t, c.totalCost])) })],
    );
  });

  // В браузер отдаём не всех кандидатов роли, а лучших: участники составов + до 25 альтернатив.
  // Иначе при сотнях специалистов ответ весит мегабайты.
  const inTeams = new Set(Object.values(configs).flatMap((c) => Object.values(c.members).flat().map((m) => m.specialist.id)));
  const trimmed = results.map((r) => ({
    ...r,
    totalCandidates: r.candidates.length,
    candidates: r.candidates.filter((c, i) => i < MAX_ALTERNATIVES || inTeams.has(c.specialist.id)),
  }));
  return { projectId, brief, results: trimmed, configs, recommended };
}

const MAX_ALTERNATIVES = 25;
