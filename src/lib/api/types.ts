/**
 * Типы ответов API — общие для сервера (src/server, src/app/api) и фронта (src/lib/api).
 * Контракт целиком описан в api/openapi.yaml.
 */

import type { Brief, Configuration, InvitationStatus, SlotResult, Tier } from "@/lib/team-search/types";

export type ApiErrorBody = { error: { message: string; code?: string } };

export type Me = {
  user: { id: string; phone: string };
  profile: { displayName: string; slug: string; clientMode: boolean; specialistMode: boolean } | null;
};

export type OtpPurpose = "signup" | "login";

export type SendOtpResponse = {
  /** Через сколько секунд можно запросить код снова */
  resendIn: number;
  /** Только в режиме разработки: код, который «пришёл» бы по SMS */
  devCode?: string;
};

export type VerifyResponse = { needsOnboarding: boolean };

export type ProjectStatus = "draft" | "matching" | "team_selected" | "in_progress" | "delivered" | "cancelled";

export type ProjectListItem = {
  id: string;
  title: string;
  format: string;
  city: string;
  status: ProjectStatus;
  myPart: "client" | "specialist";
  myRole?: string;
  prepStart?: string;
  shootDates: string[];
  deliveryDate?: string;
  budgetMax?: number;
  teamFilled: number;
  teamTotal: number;
  /** Моё приглашение, если я в проекте как специалист */
  myInvitation?: { id: string; status: InvitationStatus };
};

export type InvitationView = {
  id: string;
  slotKey: string;
  specialistId: string;
  specialistName: string;
  cost: number;
  status: InvitationStatus;
  sentAt: string;
  expiresAt: string;
  declineReason?: string;
  replacesId?: string;
  /** Контакты открываются только после принятия приглашения */
  phone?: string;
};

export type ProjectDetail = {
  id: string;
  status: ProjectStatus;
  version: number;
  brief: Brief;
  tier?: Tier;
  invitations: InvitationView[];
  /** Слоты, ушедшие в ручной подбор (id слотов) */
  manualSlots: string[];
};

export type MatchingResponse = {
  projectId: string;
  brief: Brief;
  results: SlotResult[];
  configs: Record<Tier, Configuration>;
  recommended: Tier;
};

export type SendInvitationsRequest = {
  tier: Tier;
  members: { slotKey: string; specialistId: string }[];
};

export type RateUnitDb = "shift" | "day" | "project" | "hour";

export type MyProfile = {
  displayName: string;
  showFullLastName: boolean;
  city: string | null;
  bio: string;
  slug: string;
  links: { telegram: string; vk: string; site: string };
  clientMode: boolean;
  specialistMode: boolean;
  /** 0–100, считается при сохранении */
  completeness: number;
  specialist: {
    openToWork: boolean;
    travelReady: boolean;
    legalStatus: "self_employed" | "ip" | "ooo" | "individual" | null;
    formatIds: string[];
    styleTagIds: string[];
    roles: {
      roleId: string;
      level: "junior" | "middle" | "senior" | "lead";
      years: number;
      isPrimary: boolean;
      rateMin: number;
      rateUnit: RateUnitDb;
    }[];
  };
};

export type MyWorkStyle = {
  channel: "telegram" | "email" | "calls" | null;
  revisions: "1" | "2-3" | "4+" | null;
  involvement: "freedom" | "stages" | "every_step" | null;
  pace: "fast" | "thorough" | null;
  nightShiftsOk: boolean;
  weekendsOk: boolean;
  testTask: {
    policy: "no_test" | "paid_only" | "free_small" | "discuss" | null;
    price: number | null;
    maxHours: number | null;
    maxDays: number | null;
    /** Платный тест засчитывается в гонорар, если взяли в проект */
    credited: boolean | null;
    note: string;
  };
};
