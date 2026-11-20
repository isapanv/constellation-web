/**
 * Типы раздела «Поиск команды».
 * Поля названы близко к таблицам projects, role_slots, team_configurations,
 * configuration_members, invitations из db-structure.md.
 */

export type Level = "junior" | "middle" | "senior" | "lead";
export type LegalStatus = "self_employed" | "ip" | "ooo" | "individual";
export type RateUnit = "shift" | "project";
export type BudgetFlex = "strict" | "pm15" | "negotiable";
export type BudgetScope = "fees" | "fees_equipment";

/** Рабочий стиль: одни и те же варианты у заказчика и у специалиста (открытый вопрос №4 в БД). */
export type Revisions = "1" | "2-3" | "4+";
export type Involvement = "freedom" | "stages" | "every_step";
export type Channel = "telegram" | "email" | "calls";
export type Pace = "fast" | "thorough";

export type WorkStyle = {
  revisions: Revisions;
  involvement: Involvement;
  channel: Channel;
  pace: Pace;
};

export type RoleSlot = {
  key: string; // локальный id строки формы
  roleId: string;
  levelMin: Level | "any";
  qty: number;
  shifts: number; // для ролей «за смену»
  budget: number | null; // null — «рассчитаем»
  mustHave: boolean;
};

export type Reference = { url: string; comment: string };

export type Brief = {
  title: string;
  city: string;
  formatId: string;
  goal: string;
  prepStart: string; // YYYY-MM-DD или ""
  shootDates: string[];
  deliveryDate: string;
  slots: RoleSlot[];
  budgetMin: number | null;
  budgetMax: number | null;
  budgetFlex: BudgetFlex;
  budgetScope: BudgetScope;
  legal: LegalStatus[];
  styleTagIds: string[];
  references: Reference[];
  workStyle: WorkStyle;
  consent: boolean;
};

export type PortfolioWork = { title: string; formatId: string; year: number; tags: string[] };

export type Specialist = {
  id: string;
  name: string; // «Мария К.» — фамилия скрыта до принятия приглашения
  roleId: string;
  extraRoles: string[];
  level: Level;
  years: number;
  city: string;
  travelReady: boolean;
  openToWork: boolean;
  legal: LegalStatus;
  rate: number; // ₽ за единицу
  rateUnit: RateUnit;
  styleTags: string[];
  portfolio: PortfolioWork[];
  /** Дни, занятые в календаре */
  busy: string[];
  calendarUpdatedDaysAgo: number;
  workStyle: WorkStyle;
  responseRate: number; // 0..1
  medianResponseH: number;
  /** Проекты на платформе; 0 — новичок (нет истории) */
  platformProjects: number;
  rating: { quality: number; deadlines: number; communication: number } | null;
  reviewQuote?: string;
  equipment?: string;
  /** С кем работал(а) раньше: id специалистов */
  workedWith: string[];
  /** Имена и роли тех, с кем работал(а), — для карточки (сервер заполняет сам) */
  colleagues?: { id: string; name: string; roleId: string }[];
  portfolioVerified: boolean;
};

export type ScoreBreakdown = {
  portfolio: number;
  role: number;
  budget: number;
  reliability: number;
  availability: number;
  workStyle: number;
};

export type Candidate = {
  specialist: Specialist;
  slotKey: string;
  cost: number;
  score: number;
  breakdown: ScoreBreakdown;
  reasons: string[];
  /** Попал после ослабления фильтров (уровень ниже запрошенного) */
  relaxed: boolean;
};

export type SlotResult = {
  slot: RoleSlot;
  slotBudget: number; // явный или рассчитанный
  budgetEstimated: boolean;
  candidates: Candidate[]; // по убыванию балла
  /** Сколько всего подошло (с сервера приходят только лучшие) */
  totalCandidates?: number;
  manual: boolean; // < 2 кандидатов после ослаблений — ручной подбор
  relaxedLevel: boolean;
};

export type Tier = "economy" | "optimum" | "premium";

export type Flag = { tone: "good" | "warn" | "info"; text: string };

export type Configuration = {
  tier: Tier;
  /** slotKey → выбранные кандидаты (длина = qty) */
  members: Record<string, Candidate[]>;
  totalCost: number;
  teamScore: number;
  flags: Flag[];
};

export type InvitationStatus = "sent" | "viewed" | "accepted" | "declined" | "expired" | "withdrawn" | "cancelled";

export type Invitation = {
  id: string;
  slotKey: string;
  specialistId: string;
  cost: number;
  status: InvitationStatus;
  sentAt: string; // ISO
  declineReason?: string;
};

export type CreatedProject = {
  id: string;
  brief: Brief;
  status: "draft" | "matching" | "team_selected";
  tier?: Tier;
  invitations: Invitation[];
  createdAt: string;
};
