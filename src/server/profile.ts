/**
 * Мой профиль и стиль работы: чтение и сохранение.
 * Таблицы: profiles, specialist_settings, specialist_roles, work_style (db-structure.md, группа «Профиль и режимы»).
 */
import { z } from "zod";
import type { MyProfile, MyWorkStyle } from "@/lib/api/types";
import { one, q, tx } from "./db";
import { dicts } from "./dictionaries";
import { fail } from "./http";

const LEVELS = ["junior", "middle", "senior", "lead"] as const;
const UNITS = ["shift", "day", "project", "hour"] as const;
const LEGAL = ["self_employed", "ip", "ooo", "individual"] as const;

export const profileSchema = z.object({
  displayName: z.string().trim().min(2, "Имя — от 2 символов").max(80),
  showFullLastName: z.boolean(),
  city: z.string().max(80).nullable(),
  bio: z.string().max(2000, "«О себе» — до 2000 символов"),
  links: z.object({
    telegram: z.string().trim().max(100, "Telegram — слишком длинно"),
    vk: z.string().trim().max(200, "VK — слишком длинная ссылка"),
    site: z.string().trim().max(300, "Сайт — слишком длинная ссылка"),
  }),
  clientMode: z.boolean(),
  specialistMode: z.boolean(),
  specialist: z.object({
    openToWork: z.boolean(),
    travelReady: z.boolean(),
    legalStatus: z.enum(LEGAL).nullable(),
    formatIds: z.array(z.string().max(40)).max(10),
    styleTagIds: z.array(z.string().max(40)).max(5, "Не больше 5 тегов стиля"),
    roles: z
      .array(
        z.object({
          roleId: z.string().max(40),
          level: z.enum(LEVELS),
          years: z.number().int().min(0).max(70, "Опыт — не больше 70 лет"),
          isPrimary: z.boolean(),
          rateMin: z.number().int().positive("Укажите ставку").max(10_000_000, "Ставка — не больше 10 млн ₽. Проверьте, нет ли лишних цифр"),
          rateUnit: z.enum(UNITS),
        }),
      )
      .max(4, "Не больше 4 ролей: 1 основная и 3 дополнительные"),
  }),
});

const nullable = <T extends readonly [string, ...string[]]>(vals: T) => z.enum(vals).nullable();

export const workStyleSchema = z
  .object({
    channel: nullable(["telegram", "email", "calls"] as const),
    revisions: nullable(["1", "2-3", "4+"] as const),
    involvement: nullable(["freedom", "stages", "every_step"] as const),
    pace: nullable(["fast", "thorough"] as const),
    nightShiftsOk: z.boolean(),
    weekendsOk: z.boolean(),
    testTask: z.object({
      policy: nullable(["no_test", "paid_only", "free_small", "discuss"] as const),
      price: z.number().int().min(0).max(10_000_000, "Цена теста — не больше 10 млн ₽").nullable(),
      maxHours: z.number().int().min(1, "Объём — от 1 часа").max(80, "Объём — не больше 80 часов").nullable(),
      maxDays: z.number().int().min(1, "Срок — от 1 дня").max(30, "Срок — не больше 30 дней").nullable(),
      credited: z.boolean().nullable(),
      note: z.string().max(1000, "Пояснение — до 1000 символов"),
    }),
  })
  .refine((w) => w.testTask.policy !== "paid_only" || (w.testTask.price ?? 0) > 0, { message: "Для платного теста укажите цену", path: ["testTask", "price"] });

/** Заполненность профиля специалиста, 0–100: от неё зависит, насколько уверенно человека показывать в подборе. */
function completeness(p: z.infer<typeof profileSchema>, works: number, hasStyle: boolean): number {
  const s = p.specialist;
  const checks = [
    p.displayName.length >= 2,
    !!p.city,
    p.bio.trim().length >= 30,
    s.roles.length > 0,
    !!s.legalStatus,
    s.formatIds.length > 0,
    s.styleTagIds.length > 0,
    works >= 3,
    hasStyle,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export async function getMyProfile(userId: string): Promise<MyProfile> {
  const d = await dicts();
  const p = await one<{
    display_name: string;
    show_full_last_name: boolean;
    city_id: number | null;
    bio: string | null;
    slug: string;
    links: Record<string, string>;
    client_mode: boolean;
    specialist_mode: boolean;
    open_to_work: boolean | null;
    travel_ready: boolean | null;
    legal_status: (typeof LEGAL)[number] | null;
    format_ids: number[] | null;
    style_tag_ids: number[] | null;
    completeness: number | null;
  }>(
    `SELECT p.display_name, p.show_full_last_name, p.city_id, p.bio, p.slug, p.links, p.client_mode, p.specialist_mode,
            ss.open_to_work, ss.travel_ready, ss.legal_status, ss.format_ids, ss.style_tag_ids, ss.completeness
     FROM profiles p LEFT JOIN specialist_settings ss ON ss.user_id = p.user_id WHERE p.user_id = $1`,
    [userId],
  );
  if (!p) fail(404, "Профиль ещё не создан", "no_profile");
  const roles = await q<{ role_id: number; level: (typeof LEVELS)[number]; years: number; is_primary: boolean; rate_min: number; rate_unit: (typeof UNITS)[number] }>(
    `SELECT role_id, level, years, is_primary, rate_min, rate_unit FROM specialist_roles WHERE user_id = $1 ORDER BY is_primary DESC, role_id`,
    [userId],
  );
  return {
    displayName: p!.display_name,
    showFullLastName: p!.show_full_last_name,
    city: p!.city_id ? (d.cities.byId.get(p!.city_id) ?? null) : null,
    bio: p!.bio ?? "",
    slug: p!.slug,
    links: { telegram: p!.links?.telegram ?? "", vk: p!.links?.vk ?? "", site: p!.links?.site ?? "" },
    clientMode: p!.client_mode,
    specialistMode: p!.specialist_mode,
    completeness: p!.completeness ?? 0,
    specialist: {
      openToWork: p!.open_to_work ?? true,
      travelReady: p!.travel_ready ?? false,
      legalStatus: p!.legal_status,
      formatIds: (p!.format_ids ?? []).map((id) => d.formats.byId.get(id)!).filter(Boolean),
      styleTagIds: (p!.style_tag_ids ?? []).map((id) => d.tags.byId.get(id)!).filter(Boolean),
      roles: roles.map((r) => ({
        roleId: d.roles.byId.get(r.role_id)!,
        level: r.level,
        years: r.years,
        isPrimary: r.is_primary,
        rateMin: r.rate_min,
        rateUnit: r.rate_unit,
      })),
    },
  };
}

export async function saveMyProfile(userId: string, p: z.infer<typeof profileSchema>): Promise<MyProfile> {
  if (!p.clientMode && !p.specialistMode) fail(422, "Выберите хотя бы один режим: специалист или заказчик");
  const d = await dicts();
  const cityId = p.city ? (d.cities.byName.get(p.city) ?? fail(400, "Неизвестный город")) : null;
  const s = p.specialist;
  const roleIds = s.roles.map((r) => d.roles.byCode.get(r.roleId) ?? fail(400, `Неизвестная роль «${r.roleId}»`));
  if (new Set(roleIds).size !== roleIds.length) fail(422, "Одна и та же роль указана дважды");
  if (s.roles.length && s.roles.filter((r) => r.isPrimary).length !== 1) fail(422, "Отметьте одну основную роль");
  const formatIds = s.formatIds.map((f) => d.formats.byCode.get(f) ?? fail(400, "Неизвестный формат"));
  const tagIds = s.styleTagIds.map((t) => d.tags.byCode.get(t) ?? fail(400, "Неизвестный тег"));
  if (p.links.site && !/^https?:\/\/\S+\.\S+/i.test(p.links.site)) fail(422, "Сайт — полная ссылка, начиная с https://");

  await tx(async (c) => {
    await c.query(
      `UPDATE profiles SET display_name = $2, show_full_last_name = $3, city_id = $4, bio = $5, links = $6,
         client_mode = $7, specialist_mode = $8 WHERE user_id = $1`,
      [userId, p.displayName, p.showFullLastName, cityId, p.bio.trim() || null, JSON.stringify(p.links), p.clientMode, p.specialistMode],
    );

    // Роли: заменяем целиком (их максимум 4)
    await c.query(`DELETE FROM specialist_roles WHERE user_id = $1`, [userId]);
    for (const [i, r] of s.roles.entries())
      await c.query(
        `INSERT INTO specialist_roles (user_id, role_id, level, years, is_primary, rate_min, rate_unit) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, roleIds[i], r.level, r.years, r.isPrimary, r.rateMin, r.rateUnit],
      );

    // Настройки специалиста: юр. статус обязателен в таблице, поэтому строку создаём, когда он выбран
    const works = await c.query<{ n: number }>(`SELECT count(*)::int AS n FROM portfolio_items WHERE user_id = $1`, [userId]);
    const hasStyle = await c.query(`SELECT 1 FROM work_style WHERE user_id = $1 AND revisions IS NOT NULL`, [userId]);
    const score = completeness(p, works.rows[0].n, !!hasStyle.rowCount);
    if (s.legalStatus) {
      await c.query(
        `INSERT INTO specialist_settings (user_id, open_to_work, travel_ready, legal_status, format_ids, style_tag_ids, completeness)
         VALUES ($1, $2, $3, $4, $5::smallint[], $6::smallint[], $7)
         ON CONFLICT (user_id) DO UPDATE SET open_to_work = $2, travel_ready = $3, legal_status = $4,
           format_ids = $5::smallint[], style_tag_ids = $6::smallint[], completeness = $7`,
        [userId, s.openToWork, s.travelReady, s.legalStatus, formatIds, tagIds, score],
      );
    }
  });
  return getMyProfile(userId);
}

export async function getMyWorkStyle(userId: string): Promise<MyWorkStyle> {
  const w = await one<{
    comm_channel: MyWorkStyle["channel"];
    revisions: MyWorkStyle["revisions"];
    involvement: MyWorkStyle["involvement"];
    pace: MyWorkStyle["pace"];
    night_shifts_ok: boolean;
    weekends_ok: boolean;
    test_task_policy: MyWorkStyle["testTask"]["policy"];
    test_task_price: number | null;
    test_task_max_hours: number | null;
    test_task_max_days: number | null;
    test_task_credited: boolean | null;
    test_task_note: string | null;
  }>(`SELECT * FROM work_style WHERE user_id = $1`, [userId]);
  return {
    channel: w?.comm_channel ?? null,
    revisions: w?.revisions ?? null,
    involvement: w?.involvement ?? null,
    pace: w?.pace ?? null,
    nightShiftsOk: w?.night_shifts_ok ?? false,
    weekendsOk: w?.weekends_ok ?? false,
    testTask: {
      policy: w?.test_task_policy ?? null,
      price: w?.test_task_price ?? null,
      maxHours: w?.test_task_max_hours ?? null,
      maxDays: w?.test_task_max_days ?? null,
      credited: w?.test_task_credited ?? null,
      note: w?.test_task_note ?? "",
    },
  };
}

export async function saveMyWorkStyle(userId: string, w: z.infer<typeof workStyleSchema>): Promise<MyWorkStyle> {
  const t = w.testTask;
  const paidOnly = t.policy === "paid_only";
  await q(
    `INSERT INTO work_style (user_id, comm_channel, revisions, involvement, pace, night_shifts_ok, weekends_ok,
       test_task_policy, test_task_price, test_task_max_hours, test_task_max_days, test_task_credited, test_task_note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     ON CONFLICT (user_id) DO UPDATE SET comm_channel = $2, revisions = $3, involvement = $4, pace = $5, night_shifts_ok = $6,
       weekends_ok = $7, test_task_policy = $8, test_task_price = $9, test_task_max_hours = $10, test_task_max_days = $11,
       test_task_credited = $12, test_task_note = $13`,
    [
      userId,
      w.channel,
      w.revisions,
      w.involvement,
      w.pace,
      w.nightShiftsOk,
      w.weekendsOk,
      t.policy,
      paidOnly ? t.price : null,
      t.policy && t.policy !== "no_test" ? t.maxHours : null,
      t.policy && t.policy !== "no_test" ? t.maxDays : null,
      paidOnly ? t.credited : null,
      t.note.trim() || null,
    ],
  );
  await refreshCompleteness(userId);
  return getMyWorkStyle(userId);
}

/** Пересчитать заполненность после изменений не в самом профиле (стиль работы, позже — портфолио). */
export async function refreshCompleteness(userId: string): Promise<void> {
  const p = await getMyProfile(userId).catch(() => null);
  if (!p) return;
  const works = await one<{ n: number }>(`SELECT count(*)::int AS n FROM portfolio_items WHERE user_id = $1`, [userId]);
  const style = await one(`SELECT 1 FROM work_style WHERE user_id = $1 AND revisions IS NOT NULL`, [userId]);
  await q(`UPDATE specialist_settings SET completeness = $2 WHERE user_id = $1`, [userId, completeness(p, works?.n ?? 0, !!style)]);
}
