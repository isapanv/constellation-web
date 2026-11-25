/**
 * Роли сотрудников платформы и их права. Общий файл для сервера (проверка) и фронта (что показывать).
 * Решает сервер: фронт только прячет кнопки, которые всё равно вернут 403.
 */

export const STAFF_ROLES = ["admin", "moderator", "matcher"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const staffRoleLabel: Record<StaffRole, string> = {
  admin: "Администратор",
  moderator: "Модератор",
  matcher: "Подборщик",
};

export const staffRoleHint: Record<StaffRole, string> = {
  admin: "Всё, включая роли сотрудников, статусы проектов и журнал действий",
  moderator: "Пользователи (блокировка) и аватары",
  matcher: "Очередь ручного подбора, просмотр проектов и карточек людей",
};

const ALL: readonly StaffRole[] = STAFF_ROLES;

export const PERMISSIONS = {
  "dashboard.read": ALL,
  "queue.read": ALL,
  "queue.work": ["admin", "matcher"],
  "users.read": ALL,
  "users.block": ["admin", "moderator"],
  "projects.read": ALL,
  "projects.status": ["admin"],
  "avatars.moderate": ["admin", "moderator"],
  "audit.read": ["admin"],
  "staff.manage": ["admin"],
} as const satisfies Record<string, readonly StaffRole[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: StaffRole | null | undefined, perm: Permission): boolean {
  return !!role && (PERMISSIONS[perm] as readonly StaffRole[]).includes(role);
}

/** Подписи действий в журнале. Неизвестный код показываем как есть. */
export const auditActionLabel: Record<string, string> = {
  "user.view": "Открыл карточку пользователя",
  "user.block": "Заблокировал пользователя",
  "user.unblock": "Разблокировал пользователя",
  "project.view": "Открыл проект",
  "project.status": "Сменил статус проекта",
  "match_request.view": "Открыл заявку ручного подбора",
  "match_request.take": "Взял заявку ручного подбора",
  "match_request.release": "Вернул заявку в очередь",
  "match_request.invite": "Пригласил специалиста вручную",
  "match_request.done": "Закрыл заявку: подобрали",
  "match_request.cancel": "Закрыл заявку: отменена",
  "avatar.approve": "Одобрил аватар",
  "avatar.reset": "Сбросил аватар",
  "staff.grant": "Выдал роль сотрудника",
  "staff.revoke": "Отозвал роль сотрудника",
};

/** «+79991234567» → «+7 999 ***-**-67»: в списках телефон не показываем целиком. */
export function maskPhone(phone: string | null): string {
  if (!phone) return "—";
  const m = /^\+7(\d{3})\d{5}(\d{2})$/.exec(phone);
  return m ? `+7 ${m[1]} ***-**-${m[2]}` : phone.slice(0, 4) + "…" + phone.slice(-2);
}

/** «+79991234567» → «+7 999 123-45-67» */
export function formatPhone(phone: string | null): string {
  if (!phone) return "—";
  const m = /^\+7(\d{3})(\d{3})(\d{2})(\d{2})$/.exec(phone);
  return m ? `+7 ${m[1]} ${m[2]}-${m[3]}-${m[4]}` : phone;
}
