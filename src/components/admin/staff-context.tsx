"use client";

import { createContext, useContext } from "react";
import { type Permission, can } from "@/lib/admin";
import type { StaffMe } from "@/lib/api/admin-types";

const StaffContext = createContext<StaffMe | null>(null);

export const StaffProvider = StaffContext.Provider;

/**
 * Страница админки рисуется сразу (иначе Next.js считает сегмент выпавшим),
 * но её содержимое — только когда сервер подтвердил роль.
 */
export function StaffOnly({ children }: { children: React.ReactNode }) {
  const s = useContext(StaffContext);
  if (!s) return <div className="h-48 animate-pulse rounded-3xl bg-surface-2" />;
  return <>{children}</>;
}

/** Текущий сотрудник. Внутри /admin всегда есть: без роли страницы не рисуются. */
export function useStaff(): StaffMe {
  const s = useContext(StaffContext);
  if (!s) throw new Error("useStaff вне админки");
  return s;
}

/** Показать кнопку или раздел. Решает всё равно сервер. */
export function useCan(perm: Permission): boolean {
  return can(useStaff().role, perm);
}
