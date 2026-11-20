"use client";

import { useEffect, useState } from "react";
import { LinkButton } from "@/components/ui/button";
import { SentView } from "@/components/team-search/sent-view";
import { ApiError, api } from "@/lib/api/client";
import type { ProjectDetail } from "@/lib/api/types";
import { useHydrated, useTeamStore } from "@/lib/team-search/store";

/** Приглашения по текущему проекту (открытому из брифа или из «Моих проектов»). */
export default function TeamSearchSentPage() {
  const hydrated = useHydrated();
  const { projectId } = useTeamStore();
  const [data, setData] = useState<{ id: string; detail: ProjectDetail } | { id: string; error: string } | null>(null);

  useEffect(() => {
    if (!hydrated || !projectId) return;
    let alive = true;
    api
      .project(projectId)
      .then((detail) => alive && setData({ id: projectId, detail }))
      .catch((e) => alive && setData({ id: projectId, error: e instanceof ApiError ? e.message : "Не получилось загрузить проект" }));
    return () => {
      alive = false;
    };
  }, [hydrated, projectId]);

  const empty = (
    <div className="flex flex-col items-start gap-4 py-12">
      <h1 className="text-2xl font-semibold">Нет отправленных приглашений</h1>
      <LinkButton href="/team-search">Собрать команду</LinkButton>
    </div>
  );
  if (hydrated && !projectId) return empty;
  if (!data || data.id !== projectId) return <div className="h-96 animate-pulse rounded-3xl bg-surface-2" />;
  if ("error" in data) return <p className="text-danger">{data.error}</p>;
  if (data.detail.invitations.length === 0) return empty;
  return <SentView key={data.id} initial={data.detail} />;
}
