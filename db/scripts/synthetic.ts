/**
 * Синтетические специалисты для нагрузочного демо: детерминированно (один и тот же seed → те же люди),
 * чтобы у всей команды была одинаковая база и одинаковые результаты подбора.
 * Распределения — правдоподобные прикидки для Петербурга, а не рыночные данные.
 */
import type { Level, LegalStatus, Specialist, WorkStyle } from "../../src/lib/team-search/types";

/** Генератор псевдослучайных чисел mulberry32 — воспроизводимый. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FEMALE = ["Анна", "Мария", "Екатерина", "Ольга", "Дарья", "Полина", "Алиса", "Вера", "Ксения", "Софья", "Ульяна", "Яна", "Алёна", "Ирина", "Наталья", "Евгения", "Василиса", "Варвара", "Лиза", "Майя", "Ника", "Таисия", "Злата", "Арина", "Кира", "Милана", "Регина", "Юлия", "Маргарита", "Диана"];
const MALE = ["Алексей", "Иван", "Дмитрий", "Сергей", "Максим", "Артём", "Глеб", "Егор", "Кирилл", "Никита", "Павел", "Роман", "Тимур", "Фёдор", "Степан", "Лев", "Марк", "Денис", "Матвей", "Георгий", "Арсений", "Илья", "Олег", "Вадим", "Константин", "Ярослав", "Даниил", "Савва", "Тимофей", "Богдан"];
const INITIALS = "АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЭЮЯ".split("");

const TAGS = ["fashion", "urban", "dynamic", "minimal", "warm", "handheld", "doc", "staged_light", "night", "food", "product", "music"];
const FORMATS = ["ad", "clip", "corp", "social", "image", "event", "short"];
const TITLES: Record<string, string> = {
  ad: "Рекламный ролик",
  clip: "Музыкальный клип",
  corp: "Корпоративное видео",
  social: "Контент для соцсетей",
  image: "Имиджевый фильм",
  event: "Ивент-съёмка",
  short: "Короткий метр",
};
const QUOTES = [
  "Спокойно держит площадку, сроки не срывает.",
  "Предложил(а) решение, о котором мы не думали, — получилось лучше брифа.",
  "Быстро отвечает, правки делает в тот же день.",
  "Сильный визуал, с подготовкой стоит закладывать запас по времени.",
  "Работали второй раз — снова без сюрпризов.",
  "Очень внимательно к деталям, на постпродакшне всё сошлось с первого раза.",
];

/** Сколько людей каждой роли (в сумме 461) и типичная ставка Middle: смена или проект, ₽. */
const ROLES: { id: string; count: number; mid: number; shift: boolean; gear?: string }[] = [
  { id: "director", count: 60, mid: 70000, shift: true },
  { id: "dop", count: 90, mid: 48000, shift: true, gear: "Камера и комплект оптики" },
  { id: "gaffer", count: 50, mid: 28000, shift: true, gear: "Свой световой комплект" },
  { id: "sound", count: 40, mid: 22000, shift: true, gear: "Рекордер и петлички" },
  { id: "art", count: 35, mid: 35000, shift: true },
  { id: "producer", count: 40, mid: 100000, shift: false },
  { id: "writer", count: 30, mid: 70000, shift: false },
  { id: "editor", count: 80, mid: 75000, shift: false },
  { id: "colorist", count: 36, mid: 50000, shift: false },
];

const LEVEL_MULT: Record<Level, number> = { junior: 0.6, middle: 1, senior: 1.3, lead: 1.65 };
const YEARS: Record<Level, [number, number]> = { junior: [0, 2], middle: [3, 6], senior: [7, 12], lead: [12, 22] };

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function generateSynthetic(seed = 20261119): Specialist[] {
  const r = rng(seed);
  const pick = <T>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const between = (a: number, b: number) => a + Math.floor(r() * (b - a + 1));
  const weighted = <T>(pairs: [T, number][]) => {
    let x = r() * pairs.reduce((s, [, w]) => s + w, 0);
    for (const [v, w] of pairs) if ((x -= w) <= 0) return v;
    return pairs[pairs.length - 1][0];
  };
  const sample = <T>(xs: T[], n: number) => [...xs].sort(() => r() - 0.5).slice(0, n);

  const out: Specialist[] = [];
  let n = 0;
  for (const role of ROLES) {
    for (let k = 0; k < role.count; k++) {
      n++;
      const female = r() < 0.5;
      const name = `${pick(female ? FEMALE : MALE)} ${pick(INITIALS)}.`;
      const level = weighted<Level>([
        ["junior", 15],
        ["middle", 45],
        ["senior", 30],
        ["lead", 10],
      ]);
      const city = weighted<string>([
        ["Санкт-Петербург", 75],
        ["Ленинградская область", 7],
        ["Москва", 18],
      ]);
      const rate = Math.round((role.mid * LEVEL_MULT[level] * (0.85 + r() * 0.3)) / 1000) * 1000;
      const tags = sample(TAGS, between(2, 5));
      const works = between(2, 6);
      const projects = r() < 0.4 ? 0 : between(1, 6);
      const avg = () => Math.round((4 + r()) * 10) / 10;

      // Занятость: 0–3 периода по 1–7 дней в ближайшие три месяца
      const busy: string[] = [];
      for (let b = between(0, 3); b > 0; b--) {
        const start = new Date(Date.UTC(2026, 10, 20) + between(0, 100) * 86400000);
        for (let d = between(1, 7); d > 0; d--) {
          busy.push(iso(start));
          start.setUTCDate(start.getUTCDate() + 1);
        }
      }

      const style: WorkStyle = {
        revisions: weighted([
          ["1", 25],
          ["2-3", 60],
          ["4+", 15],
        ]),
        involvement: weighted([
          ["freedom", 25],
          ["stages", 55],
          ["every_step", 20],
        ]),
        channel: weighted([
          ["telegram", 70],
          ["email", 15],
          ["calls", 15],
        ]),
        pace: r() < 0.55 ? "fast" : "thorough",
      };

      out.push({
        id: `x${n}`,
        name,
        roleId: role.id,
        extraRoles: [],
        level,
        years: between(...YEARS[level]),
        city,
        travelReady: city === "Москва" ? r() < 0.5 : r() < 0.2,
        openToWork: r() < 0.92,
        legal: weighted<LegalStatus>([
          ["self_employed", 60],
          ["ip", 25],
          ["individual", 10],
          ["ooo", 5],
        ]),
        rate,
        rateUnit: role.shift ? "shift" : "project",
        styleTags: tags,
        portfolio: Array.from({ length: works }, (_, i) => {
          const f = pick(FORMATS);
          return { title: TITLES[f], formatId: f, year: 2026 - Math.floor(i / 2), tags: sample(tags, Math.min(2, tags.length)) };
        }),
        busy,
        calendarUpdatedDaysAgo: between(0, 60),
        workStyle: style,
        responseRate: Math.round((0.5 + r() * 0.48) * 100) / 100,
        medianResponseH: between(1, 24),
        platformProjects: projects,
        rating: projects ? { quality: avg(), deadlines: avg(), communication: avg() } : null,
        reviewQuote: projects && r() < 0.35 ? pick(QUOTES) : undefined,
        equipment: role.gear && r() < 0.3 ? role.gear : undefined,
        workedWith: [],
        portfolioVerified: r() < 0.85,
      });
    }
  }

  // Около 300 пар «работали вместе», чаще между разными ролями
  for (let e = 0; e < 300; e++) {
    const a = pick(out);
    const b = pick(out);
    if (a === b || a.roleId === b.roleId || a.workedWith.includes(b.id)) continue;
    a.workedWith.push(b.id);
  }
  return out;
}
