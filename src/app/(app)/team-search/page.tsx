"use client";

import { useEffect, useState } from "react";
import { Button, LinkButton } from "@/components/ui/button";
import { BriefForm } from "@/components/team-search/brief-form";
import { ApiError, api } from "@/lib/api/client";
import type { ProjectDetail } from "@/lib/api/types";
import { emptyBrief } from "@/lib/team-search/dictionaries";
import { teamActions, useHydrated, useTeamStore } from "@/lib/team-search/store";

/**
 * Поиск команды, шаг 1: бриф.
 * Открыт существующий проект — бриф берём с сервера (если нет несохранённого черновика в браузере).
 */
export default function TeamSearchPage() {
  const hydrated = useHydrated();
  const { draft, projectId } = useTeamStore();
  const needServer = hydrated && !!projectId && !draft;
  const [loaded, setLoaded] = useState<{ id: string; detail: ProjectDetail } | { id: string; error: string } | null>(null);

  useEffect(() => {
    if (!needServer || !projectId) return;
    let alive = true;
    api
      .project(projectId)
      .then((detail) => alive && setLoaded({ id: projectId, detail }))
      .catch((e) => {
        if (!alive) return;
        if (e instanceof ApiError && e.status === 404) teamActions.reset(); // проект удалён или чужой — начинаем новый
        else setLoaded({ id: projectId, error: e instanceof ApiError ? e.message : "Не получилось загрузить бриф" });
      });
    return () => {
      alive = false;
    };
  }, [needServer, projectId]);

  if (!hydrated) return <Skeleton />;
  if (!needServer) return <BriefForm key={projectId ?? "new"} initial={draft ?? emptyBrief()} projectId={projectId} />;
  if (!loaded || loaded.id !== projectId) return <Skeleton />;
  if ("error" in loaded) return <p className="text-danger">{loaded.error}</p>;

  const { detail } = loaded;
  if (detail.invitations.length > 0 || !["draft", "matching"].includes(detail.status))
    return (
      <div className="flex flex-col items-start gap-4 py-12">
        <h1 className="text-2xl font-semibold">По этому проекту уже отправлены приглашения</h1>
        <p className="text-muted">Бриф больше не меняется. Следите за ответами или начните новый проект.</p>
        <div className="flex gap-2">
          <LinkButton href="/team-search/sent">К приглашениям</LinkButton>
          <Button variant="secondary" onClick={() => teamActions.reset()}>
            Новый проект
          </Button>
        </div>
      </div>
    );
  return <BriefForm key={detail.id} initial={detail.brief} projectId={detail.id} />;
}

const Skeleton = () => <div className="h-96 animate-pulse rounded-3xl bg-surface-2" />;
