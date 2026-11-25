/** Типы API админки (/api/admin/*). */
import type { StaffRole } from "@/lib/admin";
import type { InvitationStatus } from "@/lib/team-search/types";
import type { ProjectStatus } from "./types";

export type StaffMe = { userId: string; role: StaffRole; displayName: string };

export type AdminSummary = {
  queue: { open: number; inProgress: number; overdue: number; mine: number };
  users: { total: number; blocked: number; new7d: number; staff: number };
  projects: Record<ProjectStatus, number>;
  avatarsPending: number;
};

export type AuditEntry = {
  id: string;
  at: string;
  actor: { id: string; name: string } | null;
  action: string;
  entityType: string;
  entityId: string | null;
  details: Record<string, unknown>;
};

// ---------- Ручной подбор ----------

export type MatchRequestStatus = "open" | "in_progress" | "done" | "cancelled";
export type MatchQueueFilter = "active" | "mine" | "closed";

export type MatchRequestItem = {
  id: string;
  status: MatchRequestStatus;
  reason: string;
  dueAt: string;
  createdAt: string;
  closedAt: string | null;
  resultNote: string | null;
  assignee: { id: string; name: string } | null;
  project: { id: string; title: string; status: ProjectStatus; city: string | null; clientName: string };
  slot: {
    id: string;
    role: string;
    qty: number;
    levelMin: string | null;
    budget: number | null;
    shifts: number | null;
    accepted: number;
    /** false — бриф с тех пор изменили, слот устарел */
    current: boolean;
  };
};

export type MatchCandidate = {
  specialistId: string;
  name: string;
  phone: string;
  level: string;
  cost: number;
  rateMin: number;
  rateUnit: string;
  /** Прошёл только с понижением уровня */
  relaxed: boolean;
  /** Доля занятых дней в окне проекта, 0–1 */
  busyShare: number;
  openInvitations: number;
  /** Статус приглашения в этот слот, если уже звали */
  invited: InvitationStatus | null;
};

export type MatchRequestDetail = MatchRequestItem & {
  client: { id: string; name: string; phone: string };
  brief: { format: string | null; goal: string | null; shootDates: string[]; deliveryDate: string | null; budgetMax: number | null };
  invitations: { id: string; specialistName: string; status: InvitationStatus; cost: number; sentAt: string }[];
  candidates: MatchCandidate[];
};

// ---------- Пользователи ----------

export type UserStatus = "active" | "blocked" | "deleted";

export type AdminUserListItem = {
  id: string;
  name: string | null;
  phoneMasked: string;
  status: UserStatus;
  createdAt: string;
  lastSeenAt: string | null;
  client: boolean;
  specialist: boolean;
  primaryRole: string | null;
  staffRole: StaffRole | null;
};

export type AdminUserDetail = {
  id: string;
  name: string | null;
  slug: string | null;
  phone: string | null;
  status: UserStatus;
  blocked: { at: string; reason: string; by: string | null } | null;
  createdAt: string;
  lastSeenAt: string | null;
  signupSource: string | null;
  client: boolean;
  specialist: boolean;
  city: string | null;
  avatarUrl: string | null;
  staffRole: StaffRole | null;
  roles: { name: string; level: string; rateMin: number; rateUnit: string; isPrimary: boolean }[];
  stats: { projectsOwned: number; invitations: number; accepted: number; openInvitations: number; activeSessions: number };
  projects: { id: string; title: string; status: ProjectStatus; part: "client" | "specialist" }[];
  history: AuditEntry[];
};

// ---------- Проекты ----------

export type AdminProjectListItem = {
  id: string;
  title: string;
  status: ProjectStatus;
  clientName: string;
  city: string | null;
  format: string | null;
  createdAt: string;
  shootFrom: string | null;
  slots: number;
  filled: number;
  manualOpen: number;
};

export type AdminProjectDetail = {
  id: string;
  title: string;
  status: ProjectStatus;
  version: number;
  client: { id: string; name: string; phone: string | null };
  format: string | null;
  city: string | null;
  goal: string | null;
  shootDates: string[];
  deliveryDate: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  createdAt: string;
  slots: {
    id: string;
    role: string;
    qty: number;
    levelMin: string | null;
    budget: number | null;
    status: string;
    accepted: number;
    manual: { id: string; status: MatchRequestStatus } | null;
  }[];
  invitations: { id: string; slotId: string; specialistId: string; specialistName: string; status: InvitationStatus; cost: number; sentAt: string; reason: string | null }[];
  /** Куда сотрудник с правом projects.status может перевести проект */
  nextStatuses: ProjectStatus[];
  history: AuditEntry[];
};

// ---------- Аватары и сотрудники ----------

export type AvatarReviewItem = {
  userId: string;
  name: string;
  slug: string;
  url: string;
  uploadedAt: string;
  decision: "approve" | "reject" | null;
};

export type StaffMemberItem = {
  id: string;
  userId: string;
  name: string | null;
  phoneMasked: string;
  role: StaffRole;
  grantedAt: string;
  grantedBy: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
};
