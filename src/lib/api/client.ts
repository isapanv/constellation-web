/**
 * Все запросы фронта к API — только через эти функции.
 * Экраны не знают, где живёт сервер: если backend переедет, меняется только этот файл.
 */
import type { AvatarPresetId, AvatarRef } from "@/lib/avatars";
import type { StaffRole } from "@/lib/admin";
import type { Brief } from "@/lib/team-search/types";
import type {
  AdminProjectDetail,
  AdminProjectListItem,
  AdminSummary,
  AdminUserDetail,
  AdminUserListItem,
  AuditEntry,
  AvatarReviewItem,
  MatchQueueFilter,
  MatchRequestDetail,
  MatchRequestItem,
  StaffMe,
  StaffMemberItem,
} from "./admin-types";
import type {
  ApiErrorBody,
  Me,
  MyProfile,
  MyWorkStyle,
  MatchingResponse,
  OtpPurpose,
  ProjectDetail,
  ProjectListItem,
  ProjectStatus,
  SendInvitationsRequest,
  SendOtpResponse,
  VerifyResponse,
} from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: init.method ?? "GET",
      headers: init.body !== undefined ? { "content-type": "application/json" } : undefined,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new ApiError("Нет связи с сервером. Проверьте интернет и попробуйте ещё раз", 0, "network");
  }
  const data = (await res.json().catch(() => null)) as (T & Partial<ApiErrorBody>) | null;
  if (!res.ok) throw new ApiError(data?.error?.message ?? `Ошибка ${res.status}`, res.status, data?.error?.code);
  return data as T;
}

/** Загрузка файла: multipart/form-data, поле file (+ дополнительные поля). */
async function upload<T>(path: string, file: File, fields: Record<string, string> = {}): Promise<T> {
  const fd = new FormData();
  fd.append("file", file);
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { method: "POST", body: fd, cache: "no-store" });
  } catch {
    throw new ApiError("Нет связи с сервером. Проверьте интернет и попробуйте ещё раз", 0, "network");
  }
  const data = (await res.json().catch(() => null)) as (T & Partial<ApiErrorBody>) | null;
  if (!res.ok) throw new ApiError(data?.error?.message ?? (res.status === 413 ? "Файл слишком большой" : `Ошибка ${res.status}`), res.status, data?.error?.code);
  return data as T;
}

type AvatarResponse = { avatar: AvatarRef; avatarUrl: string | null };

export const api = {
  // Вход
  sendOtp: (phone: string, purpose: OtpPurpose) => request<SendOtpResponse>("/auth/otp", { method: "POST", body: { phone, purpose } }),
  verify: (body: { phone: string; code: string; purpose: OtpPurpose; consents?: { adult: boolean; terms: boolean; pdn: boolean; marketing: boolean } }) =>
    request<VerifyResponse>("/auth/verify", { method: "POST", body }),
  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),
  me: () => request<{ me: Me | null }>("/me"),
  onboarding: (body: { displayName: string; client: boolean; specialist: boolean }) => request<{ me: Me }>("/me/onboarding", { method: "POST", body }),
  myProfile: () => request<{ profile: MyProfile }>("/me/profile"),
  saveMyProfile: (profile: Omit<MyProfile, "slug" | "completeness" | "avatar" | "avatarUrl">) => request<{ profile: MyProfile; me: Me }>("/me/profile", { method: "PUT", body: profile }),
  /** Своя картинка в аватар. Файл уходит как multipart/form-data. */
  uploadAvatar: (file: File) => upload<AvatarResponse>("/me/avatar", file),
  /** Готовая медведица или null — убрать аватар */
  setAvatarPreset: (preset: AvatarPresetId | null) => request<AvatarResponse>("/me/avatar", { method: "PUT", body: { preset } }),
  myWorkStyle: () => request<{ workStyle: MyWorkStyle }>("/me/work-style"),
  saveMyWorkStyle: (ws: MyWorkStyle) => request<{ workStyle: MyWorkStyle }>("/me/work-style", { method: "PUT", body: ws }),

  // Проекты и подбор
  projects: () => request<{ projects: ProjectListItem[] }>("/projects"),
  createProject: (brief: Brief) => request<{ id: string }>("/projects", { method: "POST", body: brief }),
  project: (id: string) => request<ProjectDetail>(`/projects/${id}`),
  saveProject: (id: string, brief: Brief) => request<ProjectDetail>(`/projects/${id}`, { method: "PUT", body: brief }),
  matching: (id: string) => request<MatchingResponse>(`/projects/${id}/matching`, { method: "POST" }),
  sendInvitations: (id: string, body: SendInvitationsRequest) => request<ProjectDetail>(`/projects/${id}/invitations`, { method: "POST", body }),
  confirmTeam: (id: string) => request<ProjectDetail>(`/projects/${id}/team`, { method: "POST" }),
  replaceInvitation: (invitationId: string) => request<{ ok: true }>(`/invitations/${invitationId}/replace`, { method: "POST" }),
  respond: (invitationId: string, accept: boolean, reason?: string) =>
    request<{ ok: true }>(`/invitations/${invitationId}/respond`, { method: "POST", body: { accept, reason } }),
  /** Только в режиме разработки */
  simulateResponses: (id: string) => request<ProjectDetail>(`/dev/projects/${id}/simulate`, { method: "POST" }),

  /** Админка: только для сотрудников платформы, остальным сервер отвечает 404 */
  admin: {
    me: () => request<{ staff: StaffMe }>("/admin/me"),
    summary: () => request<{ summary: AdminSummary }>("/admin/summary"),

    queue: (filter: MatchQueueFilter) => request<{ requests: MatchRequestItem[] }>(`/admin/queue?filter=${filter}`),
    matchRequest: (id: string) => request<{ request: MatchRequestDetail }>(`/admin/queue/${id}`),
    actOnRequest: (id: string, body: AdminQueueAction) => request<{ request: MatchRequestDetail }>(`/admin/queue/${id}`, { method: "POST", body }),

    users: (params: { q?: string; status?: string; kind?: string; page?: number }) =>
      request<{ users: AdminUserListItem[]; hasMore: boolean }>(`/admin/users?${qs(params)}`),
    user: (id: string) => request<{ user: AdminUserDetail }>(`/admin/users/${id}`),
    blockUser: (id: string, reason: string) => request<{ user: AdminUserDetail; withdrawn: number }>(`/admin/users/${id}/block`, { method: "POST", body: { reason } }),
    unblockUser: (id: string, reason: string) => request<{ user: AdminUserDetail }>(`/admin/users/${id}/unblock`, { method: "POST", body: { reason } }),

    projects: (params: { q?: string; status?: string; page?: number }) =>
      request<{ projects: AdminProjectListItem[]; hasMore: boolean }>(`/admin/projects?${qs(params)}`),
    project: (id: string) => request<{ project: AdminProjectDetail }>(`/admin/projects/${id}`),
    setProjectStatus: (id: string, status: ProjectStatus, reason: string) =>
      request<{ project: AdminProjectDetail }>(`/admin/projects/${id}/status`, { method: "POST", body: { status, reason } }),

    avatars: (all: boolean) => request<{ avatars: AvatarReviewItem[] }>(`/admin/avatars${all ? "?all=1" : ""}`),
    approveAvatar: (userId: string) => request<{ ok: true }>(`/admin/avatars/${userId}`, { method: "POST", body: { action: "approve" } }),
    resetAvatar: (userId: string, reason: string) => request<{ ok: true }>(`/admin/avatars/${userId}`, { method: "POST", body: { action: "reset", reason } }),

    staff: () => request<{ staff: StaffMemberItem[] }>("/admin/staff"),
    grantRole: (phone: string, role: StaffRole) => request<{ staff: StaffMemberItem[] }>("/admin/staff", { method: "POST", body: { phone, role } }),
    revokeRole: (userId: string) => request<{ staff: StaffMemberItem[] }>(`/admin/staff/${userId}`, { method: "DELETE" }),

    audit: (params: { entityType?: string; entityId?: string; actorId?: string; before?: string; views?: "0" | "1" }) =>
      request<{ entries: AuditEntry[]; nextBefore: string | null }>(`/admin/audit?${qs(params)}`),
  },
};

export type AdminQueueAction =
  | { action: "take" }
  | { action: "release" }
  | { action: "invite"; specialistId: string }
  | { action: "done"; note: string }
  | { action: "cancel"; note: string };

/** Параметры запроса без пустых значений. */
function qs(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") sp.set(k, String(v));
  return sp.toString();
}
