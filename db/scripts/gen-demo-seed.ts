/**
 * Генерирует db/seeds/0002_demo.sql из тех же тестовых данных, что использует фронт.
 * Запуск из корня constellation-web:  npx tsx db/scripts/gen-demo-seed.ts
 * Так моки на фронте и демо-данные в БД не разъезжаются.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { exampleBrief, roleUnit } from "../../src/lib/team-search/dictionaries";
import { specialists as handmade } from "../../src/mocks/specialists";
import { generateSynthetic } from "./synthetic";

/** 39 «ручных» специалистов (как во фронтовых моках) + 461 синтетический = 500. */
const specialists = [...handmade, ...generateSynthetic()];

const q = (v: string | null | undefined) => (v == null ? "NULL" : `'${v.replace(/'/g, "''")}'`);
const arr = (xs: string[]) => `ARRAY[${xs.map(q).join(", ")}]::text[]`;
const uuid = (prefix: string, n: number) => `${prefix}000000-0000-4000-8000-${n.toString().padStart(12, "0")}`;

const tr: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p",
  р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};
const slugify = (name: string) =>
  "demo-" +
  name
    .toLowerCase()
    .split("")
    .map((c) => tr[c] ?? (/[a-z0-9]/.test(c) ? c : "-"))
    .join("")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

/** Подряд идущие даты → диапазоны [from, to]. */
function ranges(dates: string[]): [string, string][] {
  const s = [...new Set(dates)].sort();
  const out: [string, string][] = [];
  for (const d of s) {
    const last = out.at(-1);
    if (last) {
      const next = new Date(last[1] + "T00:00:00Z");
      next.setUTCDate(next.getUTCDate() + 1);
      if (next.toISOString().slice(0, 10) === d) {
        last[1] = d;
        continue;
      }
    }
    out.push([d, d]);
  }
  return out;
}

const ids = new Map(specialists.map((s, i) => [s.id, uuid("5a", i + 1)]));

// Имена повторяются («Иван Т.» может быть не один) — адрес профиля делаем уникальным суффиксом
const usedSlugs = new Set<string>();
const uniqueSlug = (name: string) => {
  const base = slugify(name);
  let slug = base;
  for (let i = 2; usedSlugs.has(slug); i++) slug = `${base}-${i}`;
  usedSlugs.add(slug);
  return slug;
};
const sql: string[] = [
  "-- СГЕНЕРИРОВАНО db/scripts/gen-demo-seed.ts — не править руками.",
  "-- Демо-данные: 500 специалистов (39 из src/mocks/specialists.ts + 461 из db/scripts/synthetic.ts), заказчик, пример брифа, архивные проекты с отзывами.",
  "-- Вход за демо-заказчика: телефон +7 999 100-99-99.",
  "-- Только для локальной разработки и стенда. Телефоны вымышленные (+7 999 100-xx-xx).",
  "BEGIN;",
  "",
];

specialists.forEach((s, i) => {
  const id = ids.get(s.id)!;
  const formatsUsed = [...new Set(s.portfolio.map((p) => p.formatId))];
  sql.push(`-- ${s.name}, ${s.roleId}`);
  sql.push(
    `INSERT INTO users (id, phone, phone_verified_at, adult_confirmed_at, signup_source) VALUES (${q(id)}, '+7999100${(i + 1)
      .toString()
      .padStart(4, "0")}', now(), now(), 'demo_seed');`,
  );
  sql.push(`INSERT INTO consents (user_id, consent_type, text_version) VALUES (${q(id)}, 'pdn_processing', 'demo'), (${q(id)}, 'terms', 'demo');`);
  sql.push(
    `INSERT INTO profiles (user_id, display_name, slug, city_id, specialist_mode) VALUES (${q(id)}, ${q(s.name)}, ${q(uniqueSlug(s.name))}, (SELECT id FROM cities WHERE name = ${q(s.city)}), true);`,
  );
  sql.push(
    `INSERT INTO specialist_settings (user_id, open_to_work, travel_ready, legal_status, format_ids, style_tag_ids, verification_level, completeness, response_rate, median_response_h, calendar_updated_at) VALUES (${q(id)}, ${s.openToWork}, ${s.travelReady}, '${s.legal}', ARRAY(SELECT id FROM formats WHERE code = ANY(${arr(formatsUsed)})), ARRAY(SELECT id FROM style_tags WHERE code = ANY(${arr(s.styleTags)})), ${s.portfolioVerified ? 1 : 0}, 80, ${s.responseRate}, ${s.medianResponseH}, now() - interval '${s.calendarUpdatedDaysAgo} days');`,
  );
  sql.push(
    `INSERT INTO specialist_roles (user_id, role_id, level, years, is_primary, rate_min, rate_unit, role_attrs) VALUES (${q(id)}, (SELECT id FROM roles WHERE code = '${s.roleId}'), '${s.level}', ${s.years}, true, ${s.rate}, '${s.rateUnit}', ${q(JSON.stringify(s.equipment ? { equipment: s.equipment } : {}))}::jsonb);`,
  );
  sql.push(
    `INSERT INTO work_style (user_id, comm_channel, revisions, involvement, pace) VALUES (${q(id)}, '${s.workStyle.channel}', '${s.workStyle.revisions}', '${s.workStyle.involvement}', '${s.workStyle.pace}');`,
  );
  for (const [from, to] of ranges(s.busy))
    sql.push(`INSERT INTO availability (user_id, date_from, date_to, status, source) VALUES (${q(id)}, '${from}', '${to}', 'busy', 'manual');`);
  s.portfolio.forEach((w, k) =>
    sql.push(
      `INSERT INTO portfolio_items (user_id, title, format_id, year, my_role_id, style_tag_ids, moderation_status, sort_order) VALUES (${q(id)}, ${q(w.title)}, (SELECT id FROM formats WHERE code = '${w.formatId}'), ${w.year}, (SELECT id FROM roles WHERE code = '${s.roleId}'), ARRAY(SELECT id FROM style_tags WHERE code = ANY(${arr(w.tags)})), '${s.portfolioVerified ? "approved" : "pending"}', ${k});`,
    ),
  );
  sql.push("");
});

// Пары «работали вместе»
const seen = new Set<string>();
for (const s of specialists)
  for (const other of s.workedWith) {
    const a = ids.get(s.id)!;
    const b = ids.get(other);
    if (!b) continue;
    const key = [a, b].sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    sql.push(
      `INSERT INTO collaboration_edges (user_a, user_b, portfolio_projects, platform_projects, mutual_yes) VALUES (LEAST(${q(a)}::uuid, ${q(b)}::uuid), GREATEST(${q(a)}::uuid, ${q(b)}::uuid), 1, 1, true);`,
    );
  }

// Заказчик и пример брифа (как кнопка «Заполнить примером»)
const client = uuid("c1", 1);
const project = uuid("b0", 1);
const b = exampleBrief();
sql.push("", "-- Заказчик и пример брифа");
sql.push(`INSERT INTO users (id, phone, phone_verified_at, adult_confirmed_at, signup_source) VALUES (${q(client)}, '+79991009999', now(), now(), 'demo_seed');`);
sql.push(`INSERT INTO profiles (user_id, display_name, slug, city_id, client_mode) VALUES (${q(client)}, 'Анна Миронова', 'demo-anna-mironova', 1, true);`);
sql.push(
  `INSERT INTO projects (id, owner_user_id, created_by, title, format_id, goal, city_id, prep_start, shoot_dates, delivery_date, budget_min, budget_max, budget_flex, budget_scope, style_tag_ids, expected_revisions, client_involvement, comm_channel, pace, required_legal_status, status) VALUES (${q(project)}, ${q(client)}, ${q(client)}, ${q(b.title)}, (SELECT id FROM formats WHERE code = '${b.formatId}'), ${q(b.goal)}, (SELECT id FROM cities WHERE name = ${q(b.city)}), '${b.prepStart}', ARRAY[${b.shootDates.map((d) => `'${d}'`).join(", ")}]::date[], '${b.deliveryDate}', ${b.budgetMin}, ${b.budgetMax}, '${b.budgetFlex}', '${b.budgetScope}', ARRAY(SELECT id FROM style_tags WHERE code = ANY(${arr(b.styleTagIds)})), '${b.workStyle.revisions}', '${b.workStyle.involvement}', '${b.workStyle.channel}', '${b.workStyle.pace}', ARRAY[${b.legal.map((l) => `'${l}'`).join(", ")}]::legal_status[], 'matching');`,
);
sql.push(`INSERT INTO project_versions (project_id, version, snapshot) VALUES (${q(project)}, 1, ${q(JSON.stringify(b))}::jsonb);`);
b.references.forEach((r, k) =>
  sql.push(`INSERT INTO project_references (project_id, url, comment, sort_order) VALUES (${q(project)}, ${q(r.url)}, ${q(r.comment)}, ${k});`),
);
b.slots.forEach((s, k) =>
  sql.push(
    `INSERT INTO role_slots (id, project_id, project_version, role_id, qty, level_min, shifts, slot_budget, budget_estimated, must_have, sort_order) VALUES (${q(uuid("51", k + 1))}, ${q(project)}, 1, (SELECT id FROM roles WHERE code = '${s.roleId}'), ${s.qty}, ${s.levelMin === "any" ? "NULL" : `'${s.levelMin}'`}, ${roleUnit(s.roleId) === "shift" ? s.shifts : "NULL"}, ${s.budget ?? "NULL"}, ${s.budget == null}, ${s.mustHave}, ${k});`,
  ),
);

// Архив прошлых демо-проектов и отзывы по ним: из отзывов считаются надёжность,
// «N проектов на платформе» и метка «новичок» — как в моках фронта.
const maxProjects = Math.max(...specialists.map((s) => s.platformProjects));
sql.push("", "-- Архивные демо-проекты и отзывы");
for (let k = 1; k <= maxProjects; k++) {
  const day = String(k * 3).padStart(2, "0");
  sql.push(
    `INSERT INTO projects (id, owner_user_id, created_by, title, format_id, city_id, shoot_dates, delivery_date, budget_max, status) VALUES (${q(uuid("a0", k))}, ${q(client)}, ${q(client)}, 'Архивный демо-проект ${k}', (SELECT id FROM formats WHERE code = 'ad'), 1, ARRAY['2026-06-${day}']::date[], '2026-07-${day}', 500000, 'delivered');`,
  );
  sql.push(`INSERT INTO project_versions (project_id, version, snapshot) VALUES (${q(uuid("a0", k))}, 1, '{}'::jsonb);`);
}
/** k целых оценок 4–5 со средним как можно ближе к target. */
const scores = (target: number, k: number) => {
  const fives = Math.max(0, Math.min(k, Math.round((target - 4) * k)));
  return Array.from({ length: k }, (_, i) => (i < fives ? 5 : 4));
};
for (const s of specialists) {
  if (!s.rating || s.platformProjects === 0) continue;
  const k = s.platformProjects;
  const qa = scores(s.rating.quality, k);
  const dl = scores(s.rating.deadlines, k);
  const cm = scores(s.rating.communication, k);
  for (let i = 0; i < k; i++) {
    const comment = i === 0 && s.reviewQuote ? q(s.reviewQuote) : "NULL";
    sql.push(
      `INSERT INTO reviews (project_id, author_id, target_id, direction, quality, deadlines, communication, would_work_again, comment, comment_moderation) VALUES (${q(uuid("a0", i + 1))}, ${q(client)}, ${q(ids.get(s.id)!)}, 'client_to_specialist', ${qa[i]}, ${dl[i]}, ${cm[i]}, 'yes', ${comment}, 'approved');`,
    );
  }
}

sql.push("", "COMMIT;", "");
const out = join(__dirname, "..", "seeds", "0002_demo.sql");
writeFileSync(out, sql.join("\n"));
console.log(`Записано: ${out} (${sql.length} строк)`);
