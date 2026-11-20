/**
 * Тестовые данные. Пока нет backend, все экраны берут данные отсюда.
 * Потом эти импорты заменятся запросами к API.
 */
import type {
  Availability,
  City,
  Format,
  PortfolioItem,
  Profile,
  Role,
  SpecialistRole,
  SpecialistSettings,
  StyleTag,
  WorkStyle,
} from "@/lib/types";

// ---------- Справочники ----------
export const cities: City[] = [
  { id: 1, name: "Санкт-Петербург" },
  { id: 2, name: "Москва" },
  { id: 3, name: "Казань" },
];

export const roles: Role[] = [
  { id: 1, name: "Режиссёр", category: "Постановка" },
  { id: 2, name: "Оператор", category: "Камера" },
  { id: 3, name: "Продюсер", category: "Продакшн" },
  { id: 4, name: "Монтажёр", category: "Пост-продакшн" },
  { id: 5, name: "Звукорежиссёр", category: "Звук" },
  { id: 6, name: "Художник-постановщик", category: "Арт" },
  { id: 7, name: "Колорист", category: "Пост-продакшн" },
  { id: 8, name: "Гаффер", category: "Свет" },
  { id: 9, name: "Сценарист", category: "Постановка" },
  { id: 10, name: "Фотограф", category: "Камера" },
];

export const formats: Format[] = [
  { id: 1, name: "Рекламный ролик" },
  { id: 2, name: "Музыкальный клип" },
  { id: 3, name: "Короткий метр" },
  { id: 4, name: "Документальный фильм" },
  { id: 5, name: "Корпоративное видео" },
  { id: 6, name: "Фотосъёмка" },
];

export const styleTags: StyleTag[] = [
  { id: 1, name: "минимализм" },
  { id: 2, name: "документальный" },
  { id: 3, name: "яркий цвет" },
  { id: 4, name: "нуар" },
  { id: 5, name: "ручная камера" },
  { id: 6, name: "fashion" },
  { id: 7, name: "lo-fi" },
  { id: 8, name: "кинематографичный" },
];

// ---------- Подписи для enum ----------
export const skillLevelLabels = {
  junior: "Начинающий",
  middle: "Опытный",
  senior: "Сильный",
  lead: "Ведущий",
} as const;

export const rateUnitLabels = {
  shift: "за смену",
  hour: "за час",
  project: "за проект",
} as const;

export const legalStatusLabels = {
  self_employed: "Самозанятый",
  ip: "ИП",
  individual: "Физлицо (ГПХ)",
  company: "ООО",
} as const;

// ---------- Текущий пользователь (специалист) ----------
export const me: Profile = {
  userId: "u-1",
  displayName: "Фича Багова",
  showFullLastName: false,
  cityId: 1,
  bio: "Оператор-постановщик. Снимаю рекламу и клипы, люблю естественный свет и ручную камеру.",
  slug: "the_feature_is_bugging",
  clientMode: false,
  specialistMode: true,
  contactsHidden: true,
};

export const mySettings: SpecialistSettings = {
  openToWork: true,
  travelReady: false,
  legalStatus: "self_employed",
  formatIds: [1, 2],
  styleTagIds: [5, 8],
  verificationLevel: 1,
  completeness: 65,
};

export const myRoles: SpecialistRole[] = [
  { id: "sr-1", roleId: 2, level: "senior", years: 7, isPrimary: true, rateMin: 25000, rateUnit: "shift" },
  { id: "sr-2", roleId: 7, level: "middle", years: 3, isPrimary: false, rateMin: 3000, rateUnit: "hour" },
];

export const myWorkStyle: WorkStyle = {
  commChannel: "messenger",
  responseExpectation: "same_day",
  feedbackStyle: "structured",
  revisionRoundsOk: "2",
  pace: "steady",
  briefPreference: "detailed",
  nightShiftsOk: true,
  weekendsOk: false,
};

export const myPortfolio: PortfolioItem[] = [
  {
    id: "p-1",
    title: "Северный ветер",
    formatId: 2,
    year: 2026,
    description: "Клип для инди-группы. Съёмка на Ладоге за два дня.",
    myRoleId: 2,
    clientName: "Лейбл «Пирс»",
    clientHidden: false,
    styleTagIds: [5, 8],
    externalUrl: "https://vk.com/video",
    visibility: "public",
    moderationStatus: "approved",
    isFeatured: true,
    coverColor: "#3b4a6b",
  },
  {
    id: "p-2",
    title: "Утро в городе",
    formatId: 1,
    year: 2025,
    description: "Рекламный ролик сети кофеен, 30 секунд.",
    myRoleId: 2,
    clientName: "",
    clientHidden: true,
    styleTagIds: [3],
    visibility: "public",
    moderationStatus: "approved",
    isFeatured: false,
    coverColor: "#b5683c",
  },
  {
    id: "p-3",
    title: "Мастерская",
    formatId: 4,
    year: 2026,
    description: "Короткий док о реставраторах камней.",
    myRoleId: 2,
    clientName: "",
    clientHidden: false,
    styleTagIds: [2, 5],
    visibility: "public",
    moderationStatus: "pending",
    isFeatured: false,
    coverColor: "#5d6b4e",
  },
];

export const myAvailability: Availability[] = [
  { id: "a-1", dateFrom: "2026-11-10", dateTo: "2026-11-12", status: "busy", source: "platform_project" },
  { id: "a-2", dateFrom: "2026-11-18", dateTo: "2026-11-18", status: "tentative", source: "manual" },
  { id: "a-3", dateFrom: "2026-11-24", dateTo: "2026-11-26", status: "busy", source: "manual", privateNote: "Съёмка вне платформы" },
];

/** Публичные профили для страницы /u/[slug]. */
export const publicProfiles = [{ profile: me, settings: mySettings, roles: myRoles, workStyle: myWorkStyle, portfolio: myPortfolio }];

// ---------- Утилиты ----------
export const byId = <T extends { id: number }>(list: T[], id: number) => list.find((x) => x.id === id);
export const formatRub = (n: number) => new Intl.NumberFormat("ru-RU").format(n) + " ₽";

/** 1 год, 3 года, 7 лет */
export const yearsLabel = (n: number) => {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return `${n} год`;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} года`;
  return `${n} лет`;
};
