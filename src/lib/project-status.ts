import type { ProjectStatus } from "@/lib/api/types";

export type ProjectBucket = "current" | "past" | "upcoming";

/**
 * Раздел в «Моих проектах» — только по статусу, без сравнения дат:
 * текущие — идёт производство; предстоящие — бриф, подбор или собранная команда до старта;
 * прошедшие — сдан или отменён.
 */
export function projectBucket(status: ProjectStatus): ProjectBucket {
  if (status === "in_progress") return "current";
  if (status === "delivered" || status === "cancelled") return "past";
  return "upcoming";
}

export const statusLabel: Record<ProjectStatus, string> = {
  draft: "Черновик брифа",
  matching: "Идёт подбор",
  team_selected: "Команда собрана",
  in_progress: "В работе",
  delivered: "Сдан",
  cancelled: "Отменён",
};
