import type { Brief, Channel, Involvement, LegalStatus, Level, Pace, RateUnit, Revisions, RoleSlot } from "./types";

/**
 * Справочники раздела. TODO(API): брать из справочников cities / roles / formats / style_tags.
 * Пока свои id-строки, чтобы раздел не зависел от формы портфолио.
 */

export const cities = ["Санкт-Петербург", "Ленинградская область", "Москва"];

export const formats = [
  { id: "ad", name: "Рекламный ролик" },
  { id: "clip", name: "Музыкальный клип" },
  { id: "corp", name: "Корпоративное видео" },
  { id: "social", name: "Контент для соцсетей" },
  { id: "image", name: "Имиджевый фильм" },
  { id: "event", name: "Ивент-съёмка" },
  { id: "short", name: "Короткий метр" },
];

export const roles: { id: string; name: string; unit: RateUnit; share: number }[] = [
  // share — типовая доля бюджета для «рассчитаем», в процентах
  { id: "director", name: "Режиссёр", unit: "shift", share: 25 },
  { id: "dop", name: "Оператор-постановщик", unit: "shift", share: 18 },
  { id: "gaffer", name: "Гаффер", unit: "shift", share: 9 },
  { id: "sound", name: "Звукорежиссёр на площадке", unit: "shift", share: 5 },
  { id: "art", name: "Художник-постановщик", unit: "shift", share: 10 },
  { id: "producer", name: "Продюсер", unit: "project", share: 14 },
  { id: "writer", name: "Сценарист", unit: "project", share: 8 },
  { id: "editor", name: "Монтажёр", unit: "project", share: 14 },
  { id: "colorist", name: "Колорист", unit: "project", share: 7 },
];

export const roleName = (id: string) => roles.find((r) => r.id === id)?.name ?? id;
export const roleUnit = (id: string): RateUnit => roles.find((r) => r.id === id)?.unit ?? "shift";
export const formatName = (id: string) => formats.find((f) => f.id === id)?.name ?? id;

export const styleTags = [
  { id: "fashion", name: "Fashion" },
  { id: "urban", name: "Городская среда" },
  { id: "dynamic", name: "Динамичный монтаж" },
  { id: "minimal", name: "Минимализм" },
  { id: "warm", name: "Тёплая палитра" },
  { id: "handheld", name: "Ручная камера" },
  { id: "doc", name: "Документальный" },
  { id: "staged_light", name: "Постановочный свет" },
  { id: "night", name: "Ночная съёмка" },
  { id: "food", name: "Фуд" },
  { id: "product", name: "Предметная съёмка" },
  { id: "music", name: "Музыкальная эстетика" },
];
export const tagName = (id: string) => styleTags.find((t) => t.id === id)?.name ?? id;

export const levels: { id: Level; name: string }[] = [
  { id: "junior", name: "Начинающий" },
  { id: "middle", name: "Middle" },
  { id: "senior", name: "Senior" },
  { id: "lead", name: "Lead" },
];
export const levelIndex = (l: Level) => levels.findIndex((x) => x.id === l);
export const levelName = (l: Level | "any") => (l === "any" ? "Любой" : levels.find((x) => x.id === l)!.name);

export const legalStatuses: { id: LegalStatus; name: string; short: string }[] = [
  { id: "self_employed", name: "Самозанятые", short: "Самозанятый(ая)" },
  { id: "ip", name: "ИП", short: "ИП" },
  { id: "ooo", name: "ООО", short: "ООО" },
  { id: "individual", name: "Физлица без статуса", short: "Физлицо" },
];
export const legalShort = (s: LegalStatus) => legalStatuses.find((x) => x.id === s)!.short;

export const revisionsOptions: { id: Revisions; name: string }[] = [
  { id: "1", name: "1" },
  { id: "2-3", name: "2–3" },
  { id: "4+", name: "4 и больше" },
];
export const involvementOptions: { id: Involvement; name: string }[] = [
  { id: "freedom", name: "Даю свободу" },
  { id: "stages", name: "Согласую этапы" },
  { id: "every_step", name: "В каждом шаге" },
];
export const channelOptions: { id: Channel; name: string }[] = [
  { id: "telegram", name: "Telegram" },
  { id: "email", name: "Email" },
  { id: "calls", name: "Созвоны" },
];
export const paceOptions: { id: Pace; name: string }[] = [
  { id: "fast", name: "Быстрые итерации" },
  { id: "thorough", name: "Тщательная подготовка" },
];

let keySeq = 0;
export const newSlotKey = () => `s${Date.now().toString(36)}${(keySeq++).toString(36)}`;

export function makeSlot(roleId: string, patch: Partial<RoleSlot> = {}): RoleSlot {
  return {
    key: newSlotKey(),
    roleId,
    levelMin: "middle",
    qty: 1,
    shifts: roleUnit(roleId) === "shift" ? 1 : 0,
    budget: null,
    mustHave: true,
    ...patch,
  };
}

/** Типовой состав по формату — кнопка «Подставить состав». */
export const teamTemplates: Record<string, { roleId: string; levelMin?: Level | "any"; mustHave?: boolean; qty?: number }[]> = {
  ad: [
    { roleId: "director", levelMin: "senior" },
    { roleId: "dop" },
    { roleId: "gaffer" },
    { roleId: "sound", levelMin: "any", mustHave: false },
    { roleId: "editor" },
    { roleId: "colorist", levelMin: "senior", mustHave: false },
  ],
  clip: [{ roleId: "director" }, { roleId: "dop" }, { roleId: "gaffer" }, { roleId: "editor" }, { roleId: "colorist", mustHave: false }],
  corp: [{ roleId: "director" }, { roleId: "dop" }, { roleId: "sound", levelMin: "any" }, { roleId: "editor" }],
  social: [{ roleId: "dop" }, { roleId: "editor" }],
  image: [
    { roleId: "director", levelMin: "senior" },
    { roleId: "dop", levelMin: "senior" },
    { roleId: "gaffer" },
    { roleId: "art" },
    { roleId: "editor" },
    { roleId: "colorist", mustHave: false },
  ],
  event: [{ roleId: "dop", qty: 2 }, { roleId: "sound", levelMin: "any" }, { roleId: "editor" }],
  short: [
    { roleId: "producer" },
    { roleId: "director" },
    { roleId: "writer" },
    { roleId: "dop" },
    { roleId: "gaffer" },
    { roleId: "sound" },
    { roleId: "art" },
    { roleId: "editor" },
  ],
};

export function templateSlots(formatId: string, shootDays: number): RoleSlot[] {
  return (teamTemplates[formatId] ?? []).map((t) =>
    makeSlot(t.roleId, {
      levelMin: t.levelMin ?? "middle",
      mustHave: t.mustHave ?? true,
      qty: t.qty ?? 1,
      shifts: roleUnit(t.roleId) === "shift" ? Math.max(1, shootDays) : 0,
    }),
  );
}

export const emptyBrief = (): Brief => ({
  title: "",
  city: "Санкт-Петербург",
  formatId: "",
  goal: "",
  prepStart: "",
  shootDates: [],
  deliveryDate: "",
  slots: [],
  budgetMin: null,
  budgetMax: null,
  budgetFlex: "pm15",
  budgetScope: "fees",
  legal: ["self_employed", "ip"],
  styleTagIds: [],
  references: [{ url: "", comment: "" }],
  workStyle: { revisions: "2-3", involvement: "stages", channel: "telegram", pace: "fast" },
  consent: false,
});

/** Пример для демонстрации — кнопка «Заполнить примером». */
export const exampleBrief = (): Brief => ({
  ...emptyBrief(),
  title: "Ролик к запуску зимней коллекции",
  formatId: "ad",
  goal: "Ролик 30 сек + 3 вертикальные версии по 15 сек для соцсетей. Две локации: студия и вечерняя улица. Идея — коллекция в движении города.",
  prepStart: "2026-12-01",
  shootDates: ["2026-12-10", "2026-12-11"],
  deliveryDate: "2026-12-24",
  slots: [
    makeSlot("director", { levelMin: "senior", shifts: 2, budget: 180000 }),
    makeSlot("dop", { shifts: 2, budget: 120000 }),
    makeSlot("gaffer", { shifts: 2 }),
    makeSlot("sound", { levelMin: "any", shifts: 1, mustHave: false }),
    makeSlot("editor", { budget: 90000 }),
    makeSlot("colorist", { levelMin: "senior", mustHave: false }),
  ],
  budgetMin: 600000,
  budgetMax: 750000,
  styleTagIds: ["fashion", "urban", "dynamic", "handheld"],
  references: [
    { url: "https://vk.com/video-000000_000000", comment: "Нравится темп и переходы" },
    { url: "https://rutube.ru/video/000000/", comment: "Свет на улице, вечер" },
  ],
  consent: true,
});

const dateFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", timeZone: "UTC" });
/** «18 нояб» из YYYY-MM-DD, одинаково на сервере и в браузере. */
export const shortDate = (iso: string) => dateFmt.format(new Date(iso + "T00:00:00Z")).replace(".", "");
/** «10–11 дек» / «10 дек» / «30 нояб – 2 дек» */
export function shortDateRange(dates: string[]): string {
  if (dates.length === 0) return "";
  const s = [...dates].sort();
  const a = s[0];
  const b = s[s.length - 1];
  if (a === b) return shortDate(a);
  if (a.slice(0, 7) === b.slice(0, 7)) return `${Number(a.slice(8))}–${shortDate(b)}`;
  return `${shortDate(a)} – ${shortDate(b)}`;
}
