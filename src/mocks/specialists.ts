import type { Level, LegalStatus, Specialist, WorkStyle } from "@/lib/team-search/types";

/**
 * Синтетические специалисты для демонстрации подбора.
 * TODO(API): подбор целиком переезжает на backend — фронт получит готовые конфигурации.
 */

const ws = (revisions: WorkStyle["revisions"], involvement: WorkStyle["involvement"], channel: WorkStyle["channel"], pace: WorkStyle["pace"]): WorkStyle => ({
  revisions,
  involvement,
  channel,
  pace,
});

type Seed = {
  id: string;
  name: string;
  roleId: string;
  level: Level;
  years: number;
  rate: number;
  tags: string[];
  formats: string[];
  style: WorkStyle;
  legal?: LegalStatus;
  city?: string;
  travel?: boolean;
  open?: boolean;
  busy?: string[];
  fresh?: number;
  resp?: number;
  respH?: number;
  projects?: number;
  rating?: [number, number, number] | null;
  quote?: string;
  equipment?: string;
  extra?: string[];
  workedWith?: string[];
  verified?: boolean;
};

/** Все дни с from по to включительно, YYYY-MM-DD. */
function range(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(from + "T00:00:00Z");
  const end = new Date(to + "T00:00:00Z");
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

const unitOf: Record<string, Specialist["rateUnit"]> = {
  director: "shift",
  dop: "shift",
  gaffer: "shift",
  sound: "shift",
  art: "shift",
  producer: "project",
  writer: "project",
  editor: "project",
  colorist: "project",
};

const workTitles: Record<string, string> = {
  ad: "Рекламный ролик",
  clip: "Музыкальный клип",
  corp: "Корпоративное видео",
  social: "Контент для соцсетей",
  image: "Имиджевый фильм",
  event: "Ивент-съёмка",
  short: "Короткий метр",
};

function make(s: Seed): Specialist {
  const projects = s.projects ?? 2;
  return {
    id: s.id,
    name: s.name,
    roleId: s.roleId,
    extraRoles: s.extra ?? [],
    level: s.level,
    years: s.years,
    city: s.city ?? "Санкт-Петербург",
    travelReady: s.travel ?? false,
    openToWork: s.open ?? true,
    legal: s.legal ?? "self_employed",
    rate: s.rate,
    rateUnit: unitOf[s.roleId],
    styleTags: s.tags,
    portfolio: s.formats.map((f, i) => ({
      title: workTitles[f],
      formatId: f,
      year: 2026 - Math.floor(i / 2),
      tags: s.tags.slice(i % 2, (i % 2) + 2),
    })),
    busy: s.busy ?? [],
    calendarUpdatedDaysAgo: s.fresh ?? 5,
    workStyle: s.style,
    responseRate: s.resp ?? 0.85,
    medianResponseH: s.respH ?? 4,
    platformProjects: projects,
    rating:
      s.rating === null || projects === 0
        ? null
        : s.rating
          ? { quality: s.rating[0], deadlines: s.rating[1], communication: s.rating[2] }
          : { quality: 4.5, deadlines: 4.5, communication: 4.5 },
    reviewQuote: s.quote,
    equipment: s.equipment,
    workedWith: s.workedWith ?? [],
    portfolioVerified: s.verified ?? true,
  };
}

const seeds: Seed[] = [
  // ---------- Режиссёры ----------
  { id: "d1", name: "Иван Т.", roleId: "director", level: "senior", years: 11, rate: 90000, tags: ["fashion", "urban", "dynamic", "handheld"], formats: ["ad", "ad", "clip", "image", "ad", "social"], style: ws("2-3", "stages", "telegram", "fast"), projects: 4, rating: [4.8, 4.6, 4.7], resp: 0.92, respH: 2, workedWith: ["o1", "e2"], quote: "Держит идею от брифа до монтажа, на площадке спокойно.", legal: "ip" },
  { id: "d2", name: "Алексей Н.", roleId: "director", level: "middle", years: 5, rate: 70000, tags: ["urban", "dynamic", "music"], formats: ["clip", "clip", "ad", "social"], style: ws("2-3", "stages", "telegram", "fast"), projects: 2, rating: [4.4, 4.5, 4.6], resp: 0.8 },
  { id: "d3", name: "Елена Б.", roleId: "director", level: "lead", years: 16, rate: 115000, tags: ["fashion", "staged_light", "minimal", "warm"], formats: ["ad", "image", "ad", "image", "ad"], style: ws("1", "freedom", "calls", "thorough"), projects: 6, rating: [4.9, 4.7, 4.5], resp: 0.75, respH: 9, workedWith: ["e3"], legal: "ip" },
  { id: "d4", name: "Константин Р.", roleId: "director", level: "senior", years: 9, rate: 95000, tags: ["doc", "warm", "handheld"], formats: ["image", "corp", "short", "corp"], style: ws("2-3", "stages", "email", "thorough"), projects: 3, rating: [4.6, 4.8, 4.6], busy: ["2026-12-11"] },
  { id: "d5", name: "Софья Л.", roleId: "director", level: "senior", years: 7, rate: 85000, tags: ["fashion", "urban", "night", "music"], formats: ["clip", "ad", "clip", "social"], style: ws("2-3", "every_step", "telegram", "fast"), projects: 0, rating: null, resp: 0.9, respH: 3, verified: true },
  { id: "d6", name: "Павел Ж.", roleId: "director", level: "middle", years: 4, rate: 55000, tags: ["product", "food", "minimal"], formats: ["social", "ad", "social"], style: ws("4+", "every_step", "telegram", "fast"), projects: 1, city: "Москва", travel: true },

  // ---------- Операторы-постановщики ----------
  { id: "o1", name: "Фича Багова", roleId: "dop", level: "senior", years: 9, rate: 60000, tags: ["handheld", "urban", "fashion", "night"], formats: ["ad", "ad", "clip", "image", "ad", "social"], style: ws("2-3", "stages", "telegram", "thorough"), projects: 3, rating: [4.8, 4.7, 4.6], resp: 0.9, respH: 3, workedWith: ["d1"], quote: "Сама предложила раскадровку под свет, на площадке быстро.", equipment: "Камера, комплект оптики", extra: ["Второй оператор"] },
  { id: "o2", name: "Дина В.", roleId: "dop", level: "middle", years: 4, rate: 48000, tags: ["handheld", "urban", "music"], formats: ["clip", "social", "clip"], style: ws("2-3", "stages", "telegram", "fast"), projects: 0, rating: null, resp: 0.95, respH: 1 },
  { id: "o3", name: "Арсений Г.", roleId: "dop", level: "lead", years: 14, rate: 75000, tags: ["staged_light", "fashion", "warm", "minimal"], formats: ["ad", "image", "ad", "image"], style: ws("1", "freedom", "calls", "thorough"), projects: 5, rating: [4.9, 4.6, 4.4], resp: 0.7, respH: 10, equipment: "Камера кино-класса" , legal: "ip"},
  { id: "o4", name: "Глеб С.", roleId: "dop", level: "senior", years: 8, rate: 58000, tags: ["doc", "handheld", "warm"], formats: ["image", "corp", "short", "event"], style: ws("2-3", "stages", "email", "thorough"), projects: 2, rating: [4.5, 4.7, 4.8], busy: ["2026-12-10"] },
  { id: "o5", name: "Ника П.", roleId: "dop", level: "middle", years: 5, rate: 45000, tags: ["product", "food", "staged_light"], formats: ["social", "ad", "social", "ad"], style: ws("4+", "every_step", "telegram", "fast"), projects: 2, rating: [4.3, 4.6, 4.7] },
  { id: "o6", name: "Роман Е.", roleId: "dop", level: "senior", years: 10, rate: 65000, tags: ["urban", "night", "dynamic"], formats: ["clip", "ad", "clip"], style: ws("2-3", "stages", "telegram", "fast"), projects: 1, rating: [4.6, 4.4, 4.5], resp: 0.6, respH: 20, fresh: 40, legal: "individual" },
  { id: "o7", name: "Ульяна Ф.", roleId: "dop", level: "middle", years: 3, rate: 40000, tags: ["urban", "fashion", "handheld"], formats: ["social", "clip"], style: ws("2-3", "stages", "telegram", "fast"), projects: 0, rating: null, open: false },

  // ---------- Гафферы ----------
  { id: "g1", name: "Тимур А.", roleId: "gaffer", level: "senior", years: 10, rate: 38000, tags: ["staged_light", "night", "urban"], formats: ["ad", "clip", "image", "ad"], style: ws("2-3", "stages", "telegram", "fast"), projects: 4, rating: [4.8, 4.8, 4.7], equipment: "Свой световой комплект" },
  { id: "g2", name: "Олег С.", roleId: "gaffer", level: "middle", years: 5, rate: 30000, tags: ["staged_light", "warm"], formats: ["ad", "corp", "social"], style: ws("2-3", "stages", "telegram", "fast"), projects: 1, rating: [4.4, 4.2, 4.5], fresh: 25 },
  { id: "g3", name: "Вадим Ю.", roleId: "gaffer", level: "senior", years: 12, rate: 42000, tags: ["staged_light", "fashion", "minimal"], formats: ["ad", "image", "ad"], style: ws("1", "freedom", "calls", "thorough"), projects: 3, rating: [4.7, 4.5, 4.3], busy: ["2026-12-11"] },
  { id: "g4", name: "Степан Х.", roleId: "gaffer", level: "middle", years: 3, rate: 25000, tags: ["night", "urban"], formats: ["clip", "social"], style: ws("2-3", "stages", "telegram", "fast"), projects: 0, rating: null },
  { id: "g5", name: "Лев М.", roleId: "gaffer", level: "senior", years: 9, rate: 36000, tags: ["staged_light", "doc"], formats: ["image", "short", "corp"], style: ws("2-3", "stages", "email", "thorough"), projects: 2, rating: [4.6, 4.7, 4.6] },

  // ---------- Звукорежиссёры ----------
  { id: "s1", name: "Сергей П.", roleId: "sound", level: "senior", years: 12, rate: 30000, tags: ["doc", "music"], formats: ["ad", "corp", "short", "event"], style: ws("2-3", "stages", "telegram", "fast"), projects: 5, rating: [4.8, 4.9, 4.7] },
  { id: "s2", name: "Игорь Ш.", roleId: "sound", level: "middle", years: 4, rate: 22000, tags: ["doc"], formats: ["corp", "event"], style: ws("2-3", "stages", "telegram", "fast"), projects: 1, rating: [4.3, 4.5, 4.4] },
  { id: "s3", name: "Аня Д.", roleId: "sound", level: "junior", years: 1, rate: 15000, tags: ["music"], formats: ["clip"], style: ws("4+", "every_step", "telegram", "fast"), projects: 0, rating: null },
  { id: "s4", name: "Марк Ц.", roleId: "sound", level: "senior", years: 8, rate: 28000, tags: ["doc", "urban"], formats: ["ad", "short"], style: ws("2-3", "stages", "calls", "thorough"), projects: 2, rating: [4.6, 4.6, 4.8] },

  // ---------- Художники-постановщики ----------
  { id: "a1", name: "Яна О.", roleId: "art", level: "senior", years: 8, rate: 45000, tags: ["fashion", "minimal", "warm"], formats: ["ad", "image", "clip"], style: ws("2-3", "stages", "telegram", "thorough"), projects: 3, rating: [4.8, 4.6, 4.7] },
  { id: "a2", name: "Денис Щ.", roleId: "art", level: "middle", years: 4, rate: 32000, tags: ["urban", "music"], formats: ["clip", "social"], style: ws("2-3", "stages", "telegram", "fast"), projects: 1, rating: [4.4, 4.3, 4.5] },
  { id: "a3", name: "Ольга Т.", roleId: "art", level: "lead", years: 15, rate: 60000, tags: ["staged_light", "warm", "doc"], formats: ["image", "short", "ad"], style: ws("1", "freedom", "calls", "thorough"), projects: 4, rating: [4.9, 4.5, 4.4] },

  // ---------- Продюсеры ----------
  { id: "p1", name: "Кирилл З.", roleId: "producer", level: "senior", years: 10, rate: 150000, tags: ["doc", "warm"], formats: ["short", "image", "ad"], style: ws("2-3", "stages", "telegram", "thorough"), projects: 4, rating: [4.7, 4.8, 4.8], legal: "ip" },
  { id: "p2", name: "Дарья И.", roleId: "producer", level: "middle", years: 4, rate: 90000, tags: ["urban", "music"], formats: ["clip", "short"], style: ws("2-3", "stages", "telegram", "fast"), projects: 1, rating: [4.5, 4.4, 4.7] },
  { id: "p3", name: "Борис Ч.", roleId: "producer", level: "lead", years: 18, rate: 220000, tags: ["fashion", "staged_light"], formats: ["ad", "image"], style: ws("1", "freedom", "calls", "thorough"), projects: 5, rating: [4.8, 4.6, 4.3], legal: "ooo" },

  // ---------- Сценаристы ----------
  { id: "w1", name: "Лиза Н.", roleId: "writer", level: "senior", years: 7, rate: 90000, tags: ["doc", "warm"], formats: ["short", "image"], style: ws("2-3", "stages", "email", "thorough"), projects: 2, rating: [4.7, 4.4, 4.6] },
  { id: "w2", name: "Тимофей В.", roleId: "writer", level: "middle", years: 3, rate: 55000, tags: ["music", "urban"], formats: ["clip", "short"], style: ws("4+", "every_step", "telegram", "fast"), projects: 0, rating: null },
  { id: "w3", name: "Майя Р.", roleId: "writer", level: "senior", years: 9, rate: 110000, tags: ["fashion", "minimal"], formats: ["ad", "image", "short"], style: ws("2-3", "stages", "telegram", "fast"), projects: 3, rating: [4.8, 4.7, 4.7] },

  // ---------- Монтажёры ----------
  { id: "e1", name: "Полина Е.", roleId: "editor", level: "senior", years: 8, rate: 110000, tags: ["dynamic", "fashion", "music"], formats: ["ad", "ad", "clip", "social", "ad", "social"], style: ws("1", "stages", "telegram", "fast"), projects: 3, rating: [4.7, 4.8, 4.6] },
  { id: "e2", name: "Ксения Л.", roleId: "editor", level: "middle", years: 4, rate: 70000, tags: ["dynamic", "urban"], formats: ["social", "clip", "ad"], style: ws("2-3", "stages", "telegram", "fast"), projects: 2, rating: [4.5, 4.6, 4.7], workedWith: ["d1"] },
  { id: "e3", name: "Вера М.", roleId: "editor", level: "senior", years: 10, rate: 115000, tags: ["fashion", "minimal", "dynamic"], formats: ["ad", "image", "ad", "image"], style: ws("2-3", "stages", "telegram", "thorough"), projects: 4, rating: [4.9, 4.7, 4.7], workedWith: ["d3"] },
  { id: "e4", name: "Артём Б.", roleId: "editor", level: "middle", years: 3, rate: 60000, tags: ["doc", "warm"], formats: ["corp", "event", "short"], style: ws("2-3", "stages", "email", "thorough"), projects: 1, rating: [4.4, 4.5, 4.5] },
  { id: "e5", name: "Зоя К.", roleId: "editor", level: "senior", years: 6, rate: 85000, tags: ["dynamic", "urban", "music"], formats: ["clip", "social", "ad"], style: ws("2-3", "every_step", "telegram", "fast"), projects: 0, rating: null, resp: 0.95, respH: 2 },

  // ---------- Колористы (в окно постпродакшна примера сеньоры заняты — показывает ручной подбор) ----------
  { id: "c1", name: "Фёдор А.", roleId: "colorist", level: "senior", years: 9, rate: 70000, tags: ["fashion", "warm", "night"], formats: ["ad", "image", "clip"], style: ws("2-3", "stages", "telegram", "thorough"), projects: 3, rating: [4.8, 4.6, 4.6], busy: range("2026-12-12", "2026-12-20") },
  { id: "c2", name: "Нина Г.", roleId: "colorist", level: "lead", years: 13, rate: 90000, tags: ["fashion", "minimal", "staged_light"], formats: ["ad", "image"], style: ws("1", "freedom", "email", "thorough"), projects: 4, rating: [4.9, 4.5, 4.4], busy: range("2026-12-08", "2026-12-22") },
  { id: "c3", name: "Егор Л.", roleId: "colorist", level: "middle", years: 3, rate: 40000, tags: ["urban", "night"], formats: ["clip", "social"], style: ws("2-3", "stages", "telegram", "fast"), projects: 0, rating: null },
];

export const specialists: Specialist[] = seeds.map(make);
export const specialistById = (id: string) => specialists.find((s) => s.id === id);
