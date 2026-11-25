/**
 * Типы данных для фронта. Повторяют таблицы из db-structure.md.
 * Когда появится openapi.yaml, эти типы заменятся сгенерированными.
 */

export type Id = string;

// ---------- Справочники ----------
export type City = { id: number; name: string };
export type Role = { id: number; name: string; category: string };
export type Format = { id: number; name: string };
export type StyleTag = { id: number; name: string };

// ---------- Профиль и режимы ----------
export type SkillLevel = "junior" | "middle" | "senior" | "lead";
export type RateUnit = "shift" | "hour" | "project";
export type LegalStatus = "self_employed" | "ip" | "individual" | "company";

export type SpecialistRole = {
  id: Id;
  roleId: number;
  level: SkillLevel;
  years: number;
  isPrimary: boolean;
  rateMin: number;
  rateUnit: RateUnit;
};

export type Profile = {
  userId: Id;
  displayName: string;
  showFullLastName: boolean;
  cityId: number;
  bio: string;
  slug: string;
  clientMode: boolean;
  specialistMode: boolean;
  contactsHidden: boolean;
};

export type SpecialistSettings = {
  openToWork: boolean;
  travelReady: boolean;
  legalStatus: LegalStatus;
  formatIds: number[];
  styleTagIds: number[];
  verificationLevel: number;
  completeness: number; // 0–100
};

/** Заявленные предпочтения, не психотест. Значения — enum (см. открытый вопрос №4). */
export type WorkStyle = {
  commChannel: "messenger" | "calls" | "email" | "meetings";
  responseExpectation: "1h" | "same_day" | "24h";
  feedbackStyle: "direct" | "structured" | "discussion";
  revisionRoundsOk: "1" | "2" | "3" | "more";
  pace: "sprint" | "steady" | "flexible";
  briefPreference: "detailed" | "freedom";
  nightShiftsOk: boolean;
  weekendsOk: boolean;
};

// ---------- Портфолио ----------
export type Visibility = "public" | "link" | "private";
export type ModerationStatus = "pending" | "approved" | "rejected";

export type PortfolioItem = {
  id: Id;
  title: string;
  formatId: number;
  year: number;
  description: string;
  myRoleId: number;
  clientName: string;
  clientHidden: boolean;
  styleTagIds: number[];
  externalUrl?: string;
  visibility: Visibility;
  moderationStatus: ModerationStatus;
  isFeatured: boolean;
  coverColor: string; // заглушка вместо обложки, пока нет хранилища медиа
};

// ---------- Календарь ----------
export type AvailabilityStatus = "free" | "tentative" | "busy";
export type AvailabilitySource = "manual" | "platform_project";

export type Availability = {
  id: Id;
  dateFrom: string; // YYYY-MM-DD
  dateTo: string;
  status: AvailabilityStatus;
  source: AvailabilitySource;
  privateNote?: string;
};
